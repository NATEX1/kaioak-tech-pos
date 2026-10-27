"use client";

import Link from "next/link";
import {
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Barcode,
  CheckCircle2,
  CircleAlert,
  Clock,
  PackagePlus,
  Plus,
  ReceiptText,
  Save,
  ScanBarcode,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Wrench,
} from "lucide-react";

import {
  ActionFeedback,
  FieldError,
} from "@/components/forms/form-feedback";
import { SubmitButton } from "@/components/forms/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/action-state";
import {
  billItemKindLabel,
  discountTypeLabel,
  repairStatusLabel,
} from "@/lib/bill-labels";
import { calculateBillTotals, calculateLineTotals } from "@/lib/bill-calculations";
import { inputClassName, selectClassName } from "@/lib/form-styles";
import { formatThaiDate } from "@/lib/labels";
import { formatTHB } from "@/lib/money";
import { cn } from "@/lib/utils";
import {
  createBillAction,
  updateBillAction,
} from "@/server/actions/bills";
import {
  checkClaimEligibilityAction,
  lookupSerialWarrantyAction,
} from "@/server/actions/warranty";
import type { ClaimEligibilityResult } from "@/server/services/warranty";

export type BillFormBillType = {
  id: string;
  code: string;
  name: string;
  prefix: string;
  requiresRepairDetail: boolean;
  requiresWarrantyCheck: boolean;
};

export type BillFormCustomer = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
};

export type BillFormTechnician = {
  id: string;
  name: string;
  email: string;
};

export type BillFormProduct = {
  id: string;
  sku: string;
  name: string;
  brand: string | null;
  model: string | null;
  salePrice: string;
  stockQty: number;
  warrantyMonths: number;
  trackSerial: boolean;
  barcodes: string[];
  serials: Array<{ id: string; serialNumber: string }>;
};

export type BillFormItem = {
  kind: "PRODUCT" | "SERVICE";
  productId: string | null;
  description: string;
  quantity: number;
  unitPrice: string;
  discountType: "PERCENT" | "AMOUNT" | null;
  discountValue: string;
  serialIds: string[];
};

export type BillFormRepair = {
  deviceBrand?: string;
  deviceModel?: string;
  deviceSerial?: string;
  reportedSymptoms?: string;
  diagnosis?: string;
  resolution?: string;
  repairStatus?:
    | "RECEIVED"
    | "INSPECTING"
    | "WAITING_PARTS"
    | "REPAIRING"
    | "COMPLETED"
    | "DELIVERED";
};

export type BillFormClaim = {
  productId?: string;
  serialNumber?: string;
  note?: string;
};

export type BillFormInitial = {
  id?: string;
  billNumber?: string;
  billTypeId?: string;
  customerId?: string;
  technicianId?: string;
  title?: string;
  description?: string;
  note?: string;
  discountType?: "PERCENT" | "AMOUNT" | null;
  discountValue?: string;
  items?: BillFormItem[];
  repair?: BillFormRepair;
  claim?: BillFormClaim;
};

type Settings = {
  vatEnabled: boolean;
  vatRate: string;
  vatIncluded: boolean;
};

type LineState = {
  key: string;
  kind: "PRODUCT" | "SERVICE";
  productId: string;
  description: string;
  quantity: string;
  unitPrice: string;
  discountType: "" | "PERCENT" | "AMOUNT";
  discountValue: string;
  serialIds: string[];
};

type RepairState = {
  deviceBrand: string;
  deviceModel: string;
  deviceSerial: string;
  reportedSymptoms: string;
  diagnosis: string;
  resolution: string;
  repairStatus:
    | "RECEIVED"
    | "INSPECTING"
    | "WAITING_PARTS"
    | "REPAIRING"
    | "COMPLETED"
    | "DELIVERED";
};

type ClaimState = {
  productId: string;
  serialNumber: string;
  note: string;
};

function parseJson(value: string | undefined): unknown {
  if (!value) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function normalizeDiscountType(
  value: unknown,
): "" | "PERCENT" | "AMOUNT" {
  return value === "PERCENT" || value === "AMOUNT" ? value : "";
}

function normalizeLines(
  value: unknown,
  fallback?: BillFormItem[],
): LineState[] {
  const source = Array.isArray(value) ? value : (fallback ?? []);

  return source.map((raw, index) => {
    const item = raw as Partial<BillFormItem>;
    return {
      key: `initial-${index}`,
      kind: item.kind === "SERVICE" ? "SERVICE" : "PRODUCT",
      productId: item.productId ?? "",
      description: item.description ?? "",
      quantity: String(item.quantity ?? 1),
      unitPrice: String(item.unitPrice ?? "0"),
      discountType: normalizeDiscountType(item.discountType),
      discountValue: String(item.discountValue ?? "0"),
      serialIds: Array.isArray(item.serialIds)
        ? item.serialIds.filter(
            (serialId): serialId is string => typeof serialId === "string",
          )
        : [],
    };
  });
}

function repairFrom(value: unknown, fallback?: BillFormRepair): RepairState {
  const source = (
    value && typeof value === "object" ? value : (fallback ?? {})
  ) as BillFormRepair;

  return {
    deviceBrand: source.deviceBrand ?? "",
    deviceModel: source.deviceModel ?? "",
    deviceSerial: source.deviceSerial ?? "",
    reportedSymptoms: source.reportedSymptoms ?? "",
    diagnosis: source.diagnosis ?? "",
    resolution: source.resolution ?? "",
    repairStatus: source.repairStatus ?? "RECEIVED",
  };
}

function claimFrom(value: unknown, fallback?: BillFormClaim): ClaimState {
  const source = (
    value && typeof value === "object" ? value : (fallback ?? {})
  ) as BillFormClaim;

  return {
    productId: source.productId ?? "",
    serialNumber: source.serialNumber ?? "",
    note: source.note ?? "",
  };
}

function linePayload(line: LineState) {
  return {
    kind: line.kind,
    ...(line.kind === "PRODUCT" ? { productId: line.productId } : {}),
    description: line.kind === "SERVICE" ? line.description : undefined,
    quantity: Number(line.quantity),
    unitPrice: line.unitPrice || "0",
    discountType: line.discountType || null,
    discountValue: line.discountValue || "0",
    serialIds: line.kind === "PRODUCT" ? line.serialIds : [],
  };
}

export function BillForm({
  mode,
  billId,
  billTypes,
  customers,
  technicians,
  products,
  settings,
  isAdmin,
  currentUserId,
  currentUserName,
  initial,
}: {
  mode: "create" | "edit";
  billId?: string;
  billTypes: BillFormBillType[];
  customers: BillFormCustomer[];
  technicians: BillFormTechnician[];
  products: BillFormProduct[];
  settings: Settings;
  isAdmin: boolean;
  currentUserId: string;
  currentUserName: string;
  initial?: BillFormInitial;
}) {
  const action = mode === "create" ? createBillAction : updateBillAction;
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);

  return (
    <form key={state.submissionId ?? 0} action={formAction}>
      {billId ? <input type="hidden" name="billId" value={billId} /> : null}
      <BillFormFields
        mode={mode}
        billId={billId}
        billTypes={billTypes}
        customers={customers}
        technicians={technicians}
        products={products}
        settings={settings}
        isAdmin={isAdmin}
        currentUserId={currentUserId}
        currentUserName={currentUserName}
        initial={initial}
        state={state}
      />
    </form>
  );
}

function BillFormFields({
  mode,
  billId,
  billTypes,
  customers,
  technicians,
  products,
  settings,
  isAdmin,
  currentUserId,
  currentUserName,
  initial,
  state,
}: {
  mode: "create" | "edit";
  billId?: string;
  billTypes: BillFormBillType[];
  customers: BillFormCustomer[];
  technicians: BillFormTechnician[];
  products: BillFormProduct[];
  settings: Settings;
  isAdmin: boolean;
  currentUserId: string;
  currentUserName: string;
  initial?: BillFormInitial;
  state: ActionState;
}) {
  const values = state.values;
  const value = (key: string) => values?.[key] ?? "";
  const lineCounter = useRef(0);
  const scanRef = useRef<HTMLInputElement>(null);

  const [billTypeId, setBillTypeId] = useState(
    value("billTypeId") || initial?.billTypeId || billTypes[0]?.id || "",
  );
  const [customerId, setCustomerId] = useState(
    value("customerId") || initial?.customerId || "",
  );
  const [technicianId, setTechnicianId] = useState(
    value("technicianId") ||
      initial?.technicianId ||
      (isAdmin ? (technicians[0]?.id ?? "") : currentUserId),
  );
  const [title, setTitle] = useState(value("title") || initial?.title || "");
  const [description, setDescription] = useState(
    value("description") || initial?.description || "",
  );
  const [note, setNote] = useState(value("note") || initial?.note || "");
  const [discountType, setDiscountType] = useState<"" | "PERCENT" | "AMOUNT">(
    normalizeDiscountType(
      value("discountType") || initial?.discountType || "",
    ),
  );
  const [discountValue, setDiscountValue] = useState(
    value("discountValue") || initial?.discountValue || "0",
  );
  const [lines, setLines] = useState<LineState[]>(() =>
    normalizeLines(
      parseJson(value("items")),
      initial?.items ?? [],
    ),
  );
  const [repair, setRepair] = useState<RepairState>(() =>
    repairFrom(parseJson(value("repair")), initial?.repair),
  );
  const [claim, setClaim] = useState<ClaimState>(() =>
    claimFrom(parseJson(value("claim")), initial?.claim),
  );
  const [claimCheckResult, setClaimCheckResult] =
    useState<ClaimEligibilityResult | null>(null);
  const [isCheckingClaim, setIsCheckingClaim] = useState(false);
  const [claimSerialLookupMessage, setClaimSerialLookupMessage] = useState<
    string | null
  >(null);
  const [scanValue, setScanValue] = useState("");
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [manualProductId, setManualProductId] = useState("");

  const productMap = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );
  const selectedType = billTypes.find((type) => type.id === billTypeId);
  const selectedCustomer = customers.find(
    (customer) => customer.id === customerId,
  );

  // Live warranty claim checking
  useEffect(() => {
    let cancelled = false;

    if (
      !selectedType?.requiresWarrantyCheck ||
      (!customerId && !claim.serialNumber?.trim()) ||
      (!claim.productId && !claim.serialNumber?.trim())
    ) {
      const clearTimer = setTimeout(() => {
        if (!cancelled) setClaimCheckResult(null);
      }, 0);
      return () => {
        cancelled = true;
        clearTimeout(clearTimer);
      };
    }

    const timer = setTimeout(async () => {
      setIsCheckingClaim(true);
      try {
        const res = await checkClaimEligibilityAction({
          customerId: customerId || null,
          productId: claim.productId || null,
          serialNumber: claim.serialNumber?.trim() || null,
        });
        if (!cancelled) {
          setClaimCheckResult(res);
        }
      } catch (err) {
        console.error("Failed to check claim eligibility:", err);
      } finally {
        if (!cancelled) {
          setIsCheckingClaim(false);
        }
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    selectedType?.requiresWarrantyCheck,
    customerId,
    claim.productId,
    claim.serialNumber,
  ]);

  async function handleReverseSerialLookup() {
    const sn = claim.serialNumber?.trim();
    if (!sn) return;

    setIsCheckingClaim(true);
    setClaimSerialLookupMessage(null);
    try {
      const lookup = await lookupSerialWarrantyAction(sn);
      if (lookup.found) {
        let msg = `พบ Serial ${sn} ในระบบ`;
        if (lookup.product && lookup.product.id !== claim.productId) {
          setClaim((prev) => ({ ...prev, productId: lookup.product!.id }));
          msg += ` · เลือกสินค้า "${lookup.product.name}" ให้แล้ว`;
        }
        if (lookup.customer && lookup.customer.id !== customerId) {
          setCustomerId(lookup.customer.id);
          msg += ` · เลือกลูกค้า "${lookup.customer.name}" ให้แล้ว`;
        }
        if (lookup.restricted) {
          msg +=
            " · บิลซื้อเป็นของช่างคนอื่น จึงไม่แสดงข้อมูลลูกค้า กรุณาให้ Admin เปิดเคลมแทน";
        }
        setClaimSerialLookupMessage(msg);
      } else {
        setClaimSerialLookupMessage(`ไม่พบ Serial ${sn} ในฐานข้อมูลร้าน`);
      }
    } catch (err) {
      console.error(err);
      setClaimSerialLookupMessage("เกิดข้อผิดพลาดในการค้นหา Serial");
    } finally {
      setIsCheckingClaim(false);
    }
  }

  useEffect(() => {
    if (!window.matchMedia("(min-width: 768px)").matches) return;
    scanRef.current?.focus({ preventScroll: true });
  }, []);

  function addProduct(product: BillFormProduct) {
    setScanMessage(null);
    const existing = lines.find(
      (line) => line.kind === "PRODUCT" && line.productId === product.id,
    );

    if (existing) {
      if (product.trackSerial) {
        setScanMessage(
          `${product.name} อยู่ในบิลแล้ว กรุณาเลือก Serial เพิ่มในรายการเดิม`,
        );
        return;
      }

      setLines((current) =>
        current.map((line) =>
          line.key === existing.key
            ? {
                ...line,
                quantity: String(Math.min(Number(line.quantity) + 1, 10_000)),
              }
            : line,
        ),
      );
      setScanMessage(`เพิ่มจำนวน ${product.name} ในรายการเดิมแล้ว`);
      return;
    }

    const key = `line-${lineCounter.current++}`;
    setLines((current) => [
      ...current,
      {
        key,
        kind: "PRODUCT",
        productId: product.id,
        description: product.name,
        quantity: "1",
        unitPrice: product.salePrice,
        discountType: "",
        discountValue: "0",
        serialIds: [],
      },
    ]);
    setScanMessage(`เพิ่ม ${product.name} แล้ว`);
  }

  function submitScan() {
    const query = scanValue.trim();
    if (!query) return;

    const normalized = query.toLowerCase();
    const product = products.find(
      (item) =>
        item.barcodes.some((barcode) => barcode === query) ||
        item.sku.toLowerCase() === normalized,
    );

    if (!product) {
      setScanMessage("ไม่พบสินค้าจากบาร์โค้ดหรือ SKU นี้");
      scanRef.current?.select();
      return;
    }

    addProduct(product);
    setScanValue("");
    requestAnimationFrame(() => scanRef.current?.focus());
  }

  function addManualProduct() {
    const product = productMap.get(manualProductId);
    if (!product) {
      setScanMessage("กรุณาเลือกสินค้า");
      return;
    }
    addProduct(product);
    setManualProductId("");
  }

  function addServiceLine() {
    const key = `line-${lineCounter.current++}`;
    setLines((current) => [
      ...current,
      {
        key,
        kind: "SERVICE",
        productId: "",
        description: "",
        quantity: "1",
        unitPrice: "0",
        discountType: "",
        discountValue: "0",
        serialIds: [],
      },
    ]);
  }

  function updateLine(key: string, patch: Partial<LineState>) {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  }

  function removeLine(key: string) {
    setLines((current) => current.filter((line) => line.key !== key));
  }

  function toggleSerial(key: string, serialId: string) {
    setLines((current) =>
      current.map((line) => {
        if (line.key !== key) return line;
        const selected = line.serialIds.includes(serialId);
        const serialIds = selected
          ? line.serialIds.filter((id) => id !== serialId)
          : [...line.serialIds, serialId];

        return {
          ...line,
          serialIds,
          quantity: String(serialIds.length),
        };
      }),
    );
  }

  const lineCalculations = lines.map((line) => {
    try {
      const result = calculateLineTotals({
        quantity: Number(line.quantity),
        unitPrice: line.unitPrice || "0",
        discountType: line.discountType || null,
        discountValue: line.discountValue || "0",
      });
      return { line, result, error: null };
    } catch (error) {
      return {
        line,
        result: null,
        error: error instanceof Error ? error.message : "ยอดเงินไม่ถูกต้อง",
      };
    }
  });

  let totals: ReturnType<typeof calculateBillTotals> | null = null;
  let totalsError: string | null = null;

  if (
    lineCalculations.length > 0 &&
    lineCalculations.every((entry) => entry.result !== null)
  ) {
    try {
      totals = calculateBillTotals({
        lineTotals: lineCalculations.map((entry) => ({
          lineTotal: entry.result!.lineTotal,
          discountAmount: entry.result!.discountAmount,
        })),
        discountType: discountType || null,
        discountValue,
        vatEnabled: settings.vatEnabled,
        vatIncluded: settings.vatIncluded,
        vatRate: settings.vatRate,
      });
    } catch (error) {
      totalsError =
        error instanceof Error ? error.message : "ยอดรวมไม่ถูกต้อง";
    }
  } else if (lines.length > 0) {
    totalsError = "มีรายการที่ข้อมูลไม่ครบหรือไม่ถูกต้อง";
  }

  const itemsPayload = JSON.stringify(lines.map(linePayload));
  const repairPayload = selectedType?.requiresRepairDetail
    ? JSON.stringify({
        deviceBrand: repair.deviceBrand,
        deviceModel: repair.deviceModel,
        deviceSerial: repair.deviceSerial,
        reportedSymptoms: repair.reportedSymptoms,
        diagnosis: repair.diagnosis,
        resolution: repair.resolution,
        repairStatus: repair.repairStatus,
      })
    : "";
  const claimPayload = selectedType?.requiresWarrantyCheck
    ? JSON.stringify({
        productId: claim.productId || undefined,
        serialNumber: claim.serialNumber,
        note: claim.note,
      })
    : "";

  return (
    <div className="space-y-5">
      <input type="hidden" name="items" value={itemsPayload} readOnly />
      <input type="hidden" name="repair" value={repairPayload} readOnly />
      <input type="hidden" name="claim" value={claimPayload} readOnly />
      <input
        type="hidden"
        name="discountType"
        value={discountType}
        readOnly
      />
      <input
        type="hidden"
        name="discountValue"
        value={discountValue}
        readOnly
      />

      <ActionFeedback state={state} />
      {state.details?.length ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <ul className="list-disc space-y-1 pl-5">
            {state.details.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <Card>
            <CardHeader className="border-b">
              <div className="flex items-center gap-2">
                <ReceiptText className="size-4 text-primary" aria-hidden />
                <div>
                  <CardTitle>ข้อมูลบิล</CardTitle>
                  <CardDescription>
                    เลือกประเภทบิล ลูกค้า และช่างผู้รับผิดชอบ
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="billTypeId">ประเภทบิล *</Label>
                <select
                  id="billTypeId"
                  name="billTypeId"
                  required
                  value={billTypeId}
                  onChange={(event) => setBillTypeId(event.target.value)}
                  className={selectClassName}
                >
                  <option value="">เลือกประเภทบิล</option>
                  {billTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name} ({type.prefix})
                    </option>
                  ))}
                </select>
                <FieldError fieldErrors={state.fieldErrors} field="billTypeId" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="customerId">ลูกค้า *</Label>
                <select
                  id="customerId"
                  name="customerId"
                  required
                  value={customerId}
                  onChange={(event) => setCustomerId(event.target.value)}
                  className={selectClassName}
                >
                  <option value="">เลือกลูกค้า</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name} · {customer.phone}
                    </option>
                  ))}
                </select>
                <FieldError fieldErrors={state.fieldErrors} field="customerId" />
                {selectedCustomer ? (
                  <Link
                    href={`/customers/${selectedCustomer.id}`}
                    target="_blank"
                    className="text-[11px] font-medium text-primary hover:underline"
                  >
                    เปิดโปรไฟล์ลูกค้า
                  </Link>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    ยังไม่มีลูกค้าในรายการ?{" "}
                    <Link
                      href="/customers/new"
                      target="_blank"
                      className="font-medium text-primary hover:underline"
                    >
                      เพิ่มลูกค้าใหม่
                    </Link>
                  </p>
                )}
              </div>

              {isAdmin ? (
                <div className="space-y-2">
                  <Label htmlFor="technicianId">ช่างผู้รับผิดชอบ *</Label>
                  <select
                    id="technicianId"
                    name="technicianId"
                    required
                    value={technicianId}
                    onChange={(event) => setTechnicianId(event.target.value)}
                    className={selectClassName}
                  >
                    <option value="">เลือกช่างเทคนิค</option>
                    {technicians.map((technician) => (
                      <option key={technician.id} value={technician.id}>
                        {technician.name}
                      </option>
                    ))}
                  </select>
                  <FieldError
                    fieldErrors={state.fieldErrors}
                    field="technicianId"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>ช่างผู้รับผิดชอบ</Label>
                  <div className="flex h-10 items-center rounded-lg border bg-muted/30 px-3 text-sm">
                    {currentUserName}
                  </div>
                  <input
                    type="hidden"
                    name="technicianId"
                    value={currentUserId}
                    readOnly
                  />
                </div>
              )}

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="title">ชื่อบิล *</Label>
                <Input
                  id="title"
                  name="title"
                  required
                  maxLength={200}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className={inputClassName}
                  placeholder="เช่น ขายคอมประกอบชุดทำงาน / ซ่อมเมนบอร์ดลูกค้า"
                />
                <FieldError fieldErrors={state.fieldErrors} field="title" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">รายละเอียด</Label>
                <Textarea
                  id="description"
                  name="description"
                  maxLength={2000}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="min-h-20"
                  placeholder="รายละเอียดงานหรือสินค้า (ถ้ามี)"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="note">หมายเหตุ</Label>
                <Textarea
                  id="note"
                  name="note"
                  maxLength={2000}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  className="min-h-20"
                  placeholder="หมายเหตุภายในหรือข้อตกลงกับลูกค้า"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <div className="flex items-center gap-2">
                <Barcode className="size-4 text-primary" aria-hidden />
                <div>
                  <CardTitle>รายการสินค้าและบริการ</CardTitle>
                  <CardDescription>
                    สแกนบาร์โค้ด/SKU แล้วกด Enter หรือเลือกสินค้าจากรายการ
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border bg-muted/20 p-3">
                <div className="flex flex-col gap-2 lg:flex-row">
                  <div className="relative flex-1">
                    <ScanBarcode
                      className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden
                    />
                    <Input
                      ref={scanRef}
                      value={scanValue}
                      onChange={(event) => {
                        setScanValue(event.target.value);
                        setScanMessage(null);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          submitScan();
                        }
                      }}
                      className={cn(inputClassName, "pl-9")}
                      placeholder="สแกนบาร์โค้ด หรือพิมพ์ SKU แล้วกด Enter"
                    />
                  </div>
                  <div className="flex gap-2">
                    <select
                      value={manualProductId}
                      onChange={(event) =>
                        setManualProductId(event.target.value)
                      }
                      className={cn(selectClassName, "min-w-48 flex-1 lg:w-64")}
                    >
                      <option value="">เลือกสินค้าด้วยชื่อ/SKU</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name} · {product.sku} · คงเหลือ{" "}
                          {product.stockQty}
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={addManualProduct}
                    >
                      <PackagePlus aria-hidden />
                      เพิ่ม
                    </Button>
                  </div>
                </div>
                {scanMessage ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {scanMessage}
                  </p>
                ) : null}
              </div>

              {lines.length === 0 ? (
                <div className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
                  <ScanBarcode
                    className="mx-auto mb-2 size-7 text-muted-foreground/60"
                    aria-hidden
                  />
                  ยังไม่มีรายการ สแกนบาร์โค้ดหรือเพิ่มค่าบริการเพื่อเริ่มต้น
                </div>
              ) : (
                <div className="space-y-3">
                  {lineCalculations.map(({ line, result, error }, index) => {
                    const product =
                      line.kind === "PRODUCT"
                        ? productMap.get(line.productId)
                        : null;
                    const stockShort =
                      product && Number(line.quantity) > product.stockQty;
                    const unknownSerials =
                      product?.trackSerial
                        ? line.serialIds.filter(
                            (serialId) =>
                              !product.serials.some(
                                (serial) => serial.id === serialId,
                              ),
                          )
                        : [];

                    return (
                      <div
                        key={line.key}
                        className="rounded-xl border bg-background p-3 shadow-xs"
                      >
                        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="secondary">
                                {index + 1}. {billItemKindLabel(line.kind)}
                              </Badge>
                              {product ? (
                                <>
                                  <p className="font-medium">{product.name}</p>
                                  <span className="font-mono text-[11px] text-muted-foreground">
                                    {product.sku}
                                  </span>
                                </>
                              ) : product === null &&
                                line.kind === "PRODUCT" ? (
                                <p className="text-sm font-medium text-destructive">
                                  ไม่พบสินค้าในระบบ
                                </p>
                              ) : null}
                            </div>
                            {product ? (
                              <p className="mt-1 text-[11px] text-muted-foreground">
                                คงเหลือ {product.stockQty.toLocaleString("th-TH")}{" "}
                                ชิ้น · ประกัน {product.warrantyMonths} เดือน
                                {product.trackSerial ? " · ติดตาม Serial" : ""}
                              </p>
                            ) : null}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => removeLine(line.key)}
                            aria-label="ลบรายการ"
                            className="text-destructive"
                          >
                            <Trash2 aria-hidden />
                          </Button>
                        </div>

                        {line.kind === "SERVICE" ? (
                          <div className="mt-3 space-y-2">
                            <Label htmlFor={`service-${line.key}`}>
                              รายละเอียดค่าบริการ *
                            </Label>
                            <Input
                              id={`service-${line.key}`}
                              value={line.description}
                              onChange={(event) =>
                                updateLine(line.key, {
                                  description: event.target.value,
                                })
                              }
                              className={inputClassName}
                              placeholder="เช่น ค่าบริการติดตั้ง Windows / ค่าตรวจเช็ค"
                            />
                            {!line.description.trim() ? (
                              <p className="text-[11px] text-destructive">
                                กรุณาระบุรายละเอียดค่าบริการ
                              </p>
                            ) : null}
                          </div>
                        ) : null}

                        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                          <div className="space-y-1.5">
                            <Label>จำนวน</Label>
                            <Input
                              type="number"
                              min={1}
                              max={10_000}
                              value={line.quantity}
                              onChange={(event) =>
                                updateLine(line.key, {
                                  quantity: event.target.value,
                                })
                              }
                              disabled={Boolean(product?.trackSerial)}
                              className={inputClassName}
                            />
                            {stockShort ? (
                              <p className="text-[11px] text-amber-700 dark:text-amber-300">
                                เกินสต๊อกที่มี
                              </p>
                            ) : null}
                          </div>
                          <div className="space-y-1.5">
                            <Label>ราคาต่อหน่วย (incl. VAT)</Label>
                            <Input
                              type="text"
                              inputMode="decimal"
                              value={line.unitPrice}
                              onChange={(event) =>
                                updateLine(line.key, {
                                  unitPrice: event.target.value,
                                })
                              }
                              className={inputClassName}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label>ส่วนลด</Label>
                            <select
                              value={line.discountType}
                              onChange={(event) =>
                                updateLine(line.key, {
                                  discountType: event.target
                                    .value as LineState["discountType"],
                                  discountValue:
                                    event.target.value === ""
                                      ? "0"
                                      : line.discountValue,
                                })
                              }
                              className={selectClassName}
                            >
                              <option value="">ไม่มี</option>
                              <option value="PERCENT">เปอร์เซ็นต์</option>
                              <option value="AMOUNT">จำนวนเงิน</option>
                            </select>
                          </div>
                          <div className="space-y-1.5">
                            <Label>มูลค่าส่วนลด</Label>
                            <Input
                              type="text"
                              inputMode="decimal"
                              value={line.discountValue}
                              onChange={(event) =>
                                updateLine(line.key, {
                                  discountValue: event.target.value,
                                })
                              }
                              disabled={!line.discountType}
                              className={inputClassName}
                              placeholder={
                                line.discountType === "PERCENT" ? "%" : "฿"
                              }
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label>รวมรายการ</Label>
                            <div className="flex h-10 items-center justify-end rounded-lg border bg-muted/30 px-3 text-sm font-semibold tabular-nums">
                              {result
                                ? formatTHB(result.lineTotal)
                                : "—"}
                            </div>
                          </div>
                        </div>

                        {error ? (
                          <p className="mt-2 text-xs text-destructive">
                            {error}
                          </p>
                        ) : null}

                        {product?.trackSerial ? (
                          <div className="mt-3 rounded-lg border bg-muted/20 p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <p className="text-xs font-medium">
                                  เลือก Serial ที่จะขาย *
                                </p>
                                <p className="mt-0.5 text-[11px] text-muted-foreground">
                                  เลือก {line.serialIds.length} /{" "}
                                  {line.quantity || 0} รายการ
                                </p>
                              </div>
                              <Badge variant="outline">
                                พร้อมขาย {product.serials.length}
                              </Badge>
                            </div>
                            {product.serials.length === 0 ? (
                              <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                                ไม่มี Serial พร้อมขายสำหรับสินค้านี้
                              </p>
                            ) : (
                              <div className="mt-2 grid max-h-44 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2">
                                {product.serials.map((serial) => (
                                  <label
                                    key={serial.id}
                                    className="flex cursor-pointer items-center gap-2 rounded-md border bg-background px-2 py-1.5 text-xs"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={line.serialIds.includes(
                                        serial.id,
                                      )}
                                      onChange={() =>
                                        toggleSerial(line.key, serial.id)
                                      }
                                      className="size-3.5 accent-primary"
                                    />
                                    <span className="font-mono">
                                      {serial.serialNumber}
                                    </span>
                                  </label>
                                ))}
                              </div>
                            )}
                            {unknownSerials.length > 0 ? (
                              <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-300">
                                มี Serial ที่เคยเลือกแต่ไม่พร้อมขายแล้ว{" "}
                                {unknownSerials.length} รายการ
                                กรุณาลบรายการหรือเลือกใหม่
                              </p>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}

              <Button type="button" variant="outline" onClick={addServiceLine}>
                <Plus aria-hidden />
                เพิ่มค่าบริการ
              </Button>
            </CardContent>
          </Card>

          {selectedType?.requiresRepairDetail ? (
            <Card>
              <CardHeader className="border-b">
                <div className="flex items-center gap-2">
                  <Wrench className="size-4 text-primary" aria-hidden />
                  <div>
                    <CardTitle>ข้อมูลงานซ่อม</CardTitle>
                    <CardDescription>
                      ต้องระบุอาการเสียก่อนส่งบิลขออนุมัติ
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="deviceBrand">ยี่ห้อเครื่อง</Label>
                  <Input
                    id="deviceBrand"
                    value={repair.deviceBrand}
                    onChange={(event) =>
                      setRepair((current) => ({
                        ...current,
                        deviceBrand: event.target.value,
                      }))
                    }
                    className={inputClassName}
                    placeholder="เช่น ASUS, Dell"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deviceModel">รุ่น</Label>
                  <Input
                    id="deviceModel"
                    value={repair.deviceModel}
                    onChange={(event) =>
                      setRepair((current) => ({
                        ...current,
                        deviceModel: event.target.value,
                      }))
                    }
                    className={inputClassName}
                    placeholder="เช่น Vivobook 15"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deviceSerial">Serial เครื่อง</Label>
                  <Input
                    id="deviceSerial"
                    value={repair.deviceSerial}
                    onChange={(event) =>
                      setRepair((current) => ({
                        ...current,
                        deviceSerial: event.target.value,
                      }))
                    }
                    className={inputClassName}
                    placeholder="ถ้ามี"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="repairStatus">สถานะงานซ่อม</Label>
                  <select
                    id="repairStatus"
                    value={repair.repairStatus}
                    onChange={(event) =>
                      setRepair((current) => ({
                        ...current,
                        repairStatus: event.target
                          .value as RepairState["repairStatus"],
                      }))
                    }
                    className={selectClassName}
                  >
                    {(
                      [
                        "RECEIVED",
                        "INSPECTING",
                        "WAITING_PARTS",
                        "REPAIRING",
                        "COMPLETED",
                        "DELIVERED",
                      ] as const
                    ).map((status) => (
                      <option key={status} value={status}>
                        {repairStatusLabel(status)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="reportedSymptoms">อาการเสีย *</Label>
                  <Textarea
                    id="reportedSymptoms"
                    value={repair.reportedSymptoms}
                    onChange={(event) =>
                      setRepair((current) => ({
                        ...current,
                        reportedSymptoms: event.target.value,
                      }))
                    }
                    className="min-h-24"
                    placeholder="อธิบายอาการที่ลูกค้าแจ้ง เช่น เปิดไม่ติด มีเสียงดัง บูตไม่ขึ้น"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="diagnosis">ผลตรวจ/วินิจฉัย</Label>
                  <Textarea
                    id="diagnosis"
                    value={repair.diagnosis}
                    onChange={(event) =>
                      setRepair((current) => ({
                        ...current,
                        diagnosis: event.target.value,
                      }))
                    }
                    className="min-h-20"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="resolution">วิธีแก้ไข/ผลซ่อม</Label>
                  <Textarea
                    id="resolution"
                    value={repair.resolution}
                    onChange={(event) =>
                      setRepair((current) => ({
                        ...current,
                        resolution: event.target.value,
                      }))
                    }
                    className="min-h-20"
                  />
                </div>
              </CardContent>
            </Card>
          ) : null}

          {selectedType?.requiresWarrantyCheck ? (
            <Card>
              <CardHeader className="border-b">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-primary" aria-hidden />
                  <div>
                    <CardTitle>ข้อมูลการเคลม</CardTitle>
                    <CardDescription>
                      ระบบจะตรวจประวัติซื้ออีกครั้งตอนส่งและอนุมัติ
                      หากไม่พบหรือหมดประกัน
                      ต้องให้ผู้ดูแลระบบระบุเหตุผลอนุมัติ
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="claimSerialNumber">
                      Serial ที่เคลม (ถ้ามี)
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="claimSerialNumber"
                        value={claim.serialNumber}
                        onChange={(event) => {
                          setClaimSerialLookupMessage(null);
                          setClaim((current) => ({
                            ...current,
                            serialNumber: event.target.value,
                          }));
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleReverseSerialLookup();
                          }
                        }}
                        className={inputClassName}
                        placeholder="พิมพ์หรือยิงบาร์โค้ด Serial..."
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleReverseSerialLookup}
                        disabled={!claim.serialNumber?.trim() || isCheckingClaim}
                        title="ค้นหาข้อมูลจาก Serial (Reverse Lookup)"
                        className="shrink-0 gap-1.5"
                      >
                        <Search className="size-3.5" aria-hidden />
                        ค้นหา
                      </Button>
                    </div>
                    {claimSerialLookupMessage && (
                      <p className="text-xs text-primary font-medium">
                        💡 {claimSerialLookupMessage}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="claimProductId">สินค้าที่เคลม *</Label>
                    <select
                      id="claimProductId"
                      value={claim.productId}
                      onChange={(event) =>
                        setClaim((current) => ({
                          ...current,
                          productId: event.target.value,
                        }))
                      }
                      className={selectClassName}
                    >
                      <option value="">เลือกสินค้าที่เคลม</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name} · {product.sku}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="claimNote">รายละเอียดการเคลม</Label>
                    <Textarea
                      id="claimNote"
                      value={claim.note}
                      onChange={(event) =>
                        setClaim((current) => ({
                          ...current,
                          note: event.target.value,
                        }))
                      }
                      className="min-h-20"
                      placeholder="อาการเสีย / สิ่งที่ลูกค้าต้องการให้เคลม"
                    />
                  </div>
                </div>

                {/* Live Warranty Inspection Card */}
                {isCheckingClaim ? (
                  <div className="rounded-lg border border-muted bg-muted/30 p-3 text-xs text-muted-foreground flex items-center gap-2 animate-pulse">
                    <Clock className="size-4 animate-spin" />
                    กำลังตรวจสอบประวัติการซื้อและระยะเวลารับประกัน...
                  </div>
                ) : claimCheckResult ? (
                  <div
                    className={cn(
                      "rounded-lg border p-4 text-xs space-y-2 animate-in fade-in-50",
                      claimCheckResult.result === "FOUND_IN_WARRANTY" &&
                        "border-emerald-200 bg-emerald-50/80 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-200",
                      claimCheckResult.result === "FOUND_OUT_OF_WARRANTY" &&
                        "border-amber-200 bg-amber-50/80 text-amber-950 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-200",
                      claimCheckResult.result === "NOT_FOUND" &&
                        "border-rose-200 bg-rose-50/80 text-rose-950 dark:border-rose-900 dark:bg-rose-950/20 dark:text-rose-200",
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      {claimCheckResult.result === "FOUND_IN_WARRANTY" && (
                        <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-300 shrink-0 mt-0.5" />
                      )}
                      {claimCheckResult.result === "FOUND_OUT_OF_WARRANTY" && (
                        <ShieldAlert className="size-5 text-amber-600 dark:text-amber-300 shrink-0 mt-0.5" />
                      )}
                      {claimCheckResult.result === "NOT_FOUND" && (
                        <CircleAlert className="size-5 text-rose-600 dark:text-rose-300 shrink-0 mt-0.5" />
                      )}
                      <div className="space-y-1">
                        <div className="font-semibold text-sm">
                          {claimCheckResult.result === "FOUND_IN_WARRANTY" &&
                            "✅ พบประวัติการซื้อ — ยังอยู่ในระยะเวลารับประกัน"}
                          {claimCheckResult.result === "FOUND_OUT_OF_WARRANTY" &&
                            "⚠️ พบประวัติการซื้อ — แต่หมดระยะเวลารับประกันแล้ว"}
                          {claimCheckResult.result === "NOT_FOUND" &&
                            (claimCheckResult.restricted
                              ? "🔒 ประวัติการซื้อถูกจำกัดสิทธิ์ (บิลของช่างคนอื่น)"
                              : "❌ ไม่พบประวัติการซื้อของลูกค้ารายนี้จากทางร้าน")}
                        </div>
                        <p className="leading-relaxed">
                          {claimCheckResult.message}
                        </p>
                        {claimCheckResult.originalBill && (
                          <div className="pt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] opacity-90">
                            <span>
                              เลขที่บิลเดิม:{" "}
                              <strong>
                                {claimCheckResult.originalBill.billNumber}
                              </strong>
                            </span>
                            <span>
                              วันที่ซื้อ:{" "}
                              {formatThaiDate(claimCheckResult.originalBill.date)}
                            </span>
                            {claimCheckResult.warrantyEndsAt && (
                              <span>
                                วันสิ้นสุดประกัน:{" "}
                                <strong>
                                  {formatThaiDate(claimCheckResult.warrantyEndsAt)}
                                </strong>
                              </span>
                            )}
                          </div>
                        )}
                        {claimCheckResult.requiresAdminOverride && (
                          <p className="pt-1 font-medium text-amber-800 dark:text-amber-300">
                            🚨 หมายเหตุ: บิลนี้จะต้องให้ผู้ดูแลระบบ (Admin)
                            ระบุเหตุผลอนุมัติเป็นกรณีพิเศษ (Admin Override)
                            ตอนอนุมัติ
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <Card>
            <CardHeader className="border-b">
              <CardTitle>สรุปยอด</CardTitle>
              <CardDescription>
                คำนวณด้วยทศนิยมและตรวจซ้ำที่เซิร์ฟเวอร์
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label>ส่วนลดท้ายบิล</Label>
                  <select
                    value={discountType}
                    onChange={(event) => {
                      const next = event.target
                        .value as LineState["discountType"];
                      setDiscountType(next);
                      if (!next) setDiscountValue("0");
                    }}
                    className={selectClassName}
                  >
                    <option value="">ไม่มี</option>
                    <option value="PERCENT">เปอร์เซ็นต์</option>
                    <option value="AMOUNT">จำนวนเงิน</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>มูลค่า</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={discountValue}
                    onChange={(event) => setDiscountValue(event.target.value)}
                    disabled={!discountType}
                    className={inputClassName}
                  />
                </div>
              </div>
              <FieldError
                fieldErrors={state.fieldErrors}
                field="discountValue"
              />

              <dl className="space-y-2 border-t pt-3">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">ยอดรายการ</dt>
                  <dd className="tabular-nums">
                    {totals ? formatTHB(totals.subtotal) : "—"}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">ส่วนลดรายการ</dt>
                  <dd className="tabular-nums">
                    {totals ? formatTHB(totals.lineDiscountTotal) : "—"}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">ส่วนลดท้ายบิล</dt>
                  <dd className="tabular-nums">
                    {totals ? formatTHB(totals.discountAmount) : "—"}
                  </dd>
                </div>
                {settings.vatEnabled ? (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-muted-foreground">
                        ยอดก่อน VAT
                      </dt>
                      <dd className="tabular-nums">
                        {totals ? formatTHB(totals.netAmountBeforeVat) : "—"}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-muted-foreground">
                        VAT {settings.vatRate}%
                      </dt>
                      <dd className="tabular-nums">
                        {totals ? formatTHB(totals.vatAmount) : "—"}
                      </dd>
                    </div>
                  </>
                ) : null}
                <div className="flex items-end justify-between gap-3 border-t pt-3">
                  <dt className="font-semibold">ยอดรวมทั้งสิ้น</dt>
                  <dd className="text-xl font-semibold tabular-nums">
                    {totals ? formatTHB(totals.grandTotal) : "—"}
                  </dd>
                </div>
              </dl>
              {totalsError ? (
                <p className="flex gap-1.5 rounded-lg bg-destructive/5 p-2 text-xs text-destructive">
                  <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  {totalsError}
                </p>
              ) : null}
              <p className="text-[11px] leading-5 text-muted-foreground">
                {discountType
                  ? `ส่วนลดท้ายบิล: ${discountTypeLabel(discountType)}`
                  : "ไม่มีส่วนลดท้ายบิล"}{" "}
                ·{" "}
                {settings.vatEnabled
                  ? `VAT ${settings.vatRate}% ${settings.vatIncluded ? "รวมในราคา" : "แยกนอก"}`
                  : "VAT ปิดใช้งาน"}
              </p>

              <div className="flex flex-col gap-2 border-t pt-3">
                <SubmitButton className="h-10" pendingText="กำลังบันทึกบิล...">
                  <Save aria-hidden />
                  {mode === "create" ? "บันทึกเป็นร่าง" : "บันทึกการแก้ไข"}
                </SubmitButton>
                <Link
                  href={mode === "edit" && billId ? `/bills/${billId}` : "/bills"}
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    "h-10 justify-center",
                  )}
                >
                  ยกเลิก
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card size="sm" className="bg-muted/30">
            <CardContent className="space-y-2 text-[11px] leading-5 text-muted-foreground">
              <p className="flex gap-2">
                <ShieldCheck
                  className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-300"
                  aria-hidden
                />
                บิลจะไม่ตัดสต๊อกจนกว่าผู้ดูแลระบบจะอนุมัติ
              </p>
              <p className="flex gap-2">
                <CircleAlert
                  className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-300"
                  aria-hidden
                />
                หลังบันทึกร่างแล้ว ให้เปิดหน้ารายละเอียดบิลเพื่อส่งขออนุมัติ
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
