"use client";

import { useActionState, useMemo, useState } from "react";
import {
  Barcode,
  CircleAlert,
  ClipboardList,
  Plus,
  Save,
  ScanBarcode,
  Trash2,
} from "lucide-react";

import { ActionFeedback, FieldError } from "@/components/forms/form-feedback";
import { SubmitButton } from "@/components/forms/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
import { splitSerialNumbers } from "@/lib/barcode";
import { inputClassName, selectClassName } from "@/lib/form-styles";
import { Decimal, formatTHB } from "@/lib/money";
import { cn } from "@/lib/utils";
import { createGoodsReceiptAction } from "@/server/actions/goods-receipts";

export type ReceiptProductOption = {
  id: string;
  sku: string;
  name: string;
  costPrice: string;
  stockQty: number;
  trackSerial: boolean;
  barcodes: string[];
};

type SupplierOption = { id: string; name: string };

type Line = {
  key: string;
  productId: string;
  quantity: string;
  unitCost: string;
  serialText: string;
};

type ReceiptFormBodyProps = {
  formAction: (formData: FormData) => void;
  state: typeof INITIAL_ACTION_STATE;
  suppliers: SupplierOption[];
  products: ReceiptProductOption[];
  defaultReceivedDate: string;
};

function safeMoney(value: string): Decimal {
  try {
    return new Decimal(value || 0);
  } catch {
    return new Decimal(0);
  }
}

function createLineKey(): string {
  return globalThis.crypto?.randomUUID?.() ?? `line-${Math.random()}`;
}

function createEmptyLine(key = createLineKey()): Line {
  return {
    key,
    productId: "",
    quantity: "1",
    unitCost: "",
    serialText: "",
  };
}

export function GoodsReceiptForm({
  suppliers,
  products,
  defaultReceivedDate,
}: {
  suppliers: SupplierOption[];
  products: ReceiptProductOption[];
  defaultReceivedDate: string;
}) {
  const [state, formAction] = useActionState(
    createGoodsReceiptAction,
    INITIAL_ACTION_STATE,
  );

  return (
    <ReceiptFormBody
      key={state.submissionId ?? 0}
      formAction={formAction}
      state={state}
      suppliers={suppliers}
      products={products}
      defaultReceivedDate={defaultReceivedDate}
    />
  );
}

function ReceiptFormBody({
  formAction,
  state,
  suppliers,
  products,
  defaultReceivedDate,
}: ReceiptFormBodyProps) {
  const [scanValue, setScanValue] = useState("");
  const [scanMessage, setScanMessage] = useState<{
    tone: "error" | "success";
    text: string;
  } | null>(null);
  const [lines, setLines] = useState<Line[]>(() => {
    const raw = state.values?.items;
    if (!raw) {
      return [createEmptyLine("initial-0")];
    }

    try {
      const parsed = JSON.parse(raw) as Array<{
        productId?: string;
        quantity?: number | string;
        unitCost?: string;
        serialNumbers?: string[];
      }>;
      const mapped = parsed
        .filter((item) => item && typeof item.productId === "string")
        .map((item, index) => ({
          key: `initial-${index}`,
          productId: item.productId ?? "",
          quantity: String(item.quantity ?? "1"),
          unitCost: item.unitCost ?? "",
          serialText: (item.serialNumbers ?? []).join("\n"),
        }));

      return mapped.length > 0 ? mapped : [createEmptyLine("initial-0")];
    } catch {
      return [createEmptyLine("initial-0")];
    }
  });

  const productMap = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );
  const scanMap = useMemo(() => {
    const map = new Map<string, ReceiptProductOption>();
    for (const product of products) {
      map.set(product.sku.toUpperCase(), product);
      for (const barcode of product.barcodes) {
        map.set(barcode, product);
      }
    }
    return map;
  }, [products]);

  const supplierValue = state.values?.supplierId ?? "";
  const receivedDateValue =
    state.values?.receivedDate ?? defaultReceivedDate;
  const noteValue = state.values?.note ?? "";

  function updateLine(key: string, patch: Partial<Line>) {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  }

  function addLine(product?: ReceiptProductOption) {
    const key = createLineKey();
    setLines((current) => [
      ...current,
      {
        ...createEmptyLine(key),
        ...(product
          ? {
              productId: product.id,
              unitCost: product.costPrice,
            }
          : {}),
      },
    ]);
  }

  function removeLine(key: string) {
    setLines((current) => current.filter((line) => line.key !== key));
  }

  function scanProduct() {
    const query = scanValue.trim();
    if (!query) {
      return;
    }

    const product = scanMap.get(query) ?? scanMap.get(query.toUpperCase());
    if (!product) {
      setScanMessage({
        tone: "error",
        text: `ไม่พบสินค้าจาก “${query}”`,
      });
      return;
    }

    if (lines.some((line) => line.productId === product.id)) {
      setScanMessage({
        tone: "error",
        text: `${product.name} อยู่ในรายการแล้ว`,
      });
      setScanValue("");
      return;
    }

    const emptyLine = lines.find((line) => !line.productId);
    if (emptyLine) {
      setLines((current) =>
        current.map((line) =>
          line.key === emptyLine.key
            ? {
                ...line,
                productId: product.id,
                unitCost: product.costPrice,
                serialText: "",
              }
            : line,
        ),
      );
    } else {
      addLine(product);
    }
    setScanValue("");
    setScanMessage({
      tone: "success",
      text: `เพิ่ม ${product.name} แล้ว`,
    });
  }

  const validLines = lines.filter((line) => line.productId);
  const itemsPayload = validLines.map((line) => ({
    productId: line.productId,
    quantity: Number(line.quantity || 0),
    unitCost: line.unitCost,
    serialNumbers: splitSerialNumbers(line.serialText),
  }));
  const totalUnits = validLines.reduce(
    (sum, line) => sum + (Number(line.quantity) || 0),
    0,
  );
  const totalCost = validLines.reduce((sum, line) => {
    const quantity = Number(line.quantity) || 0;
    return sum.plus(safeMoney(line.unitCost).times(quantity));
  }, new Decimal(0));

  return (
    <form action={formAction} className="space-y-5">
      <ActionFeedback state={state} />
      <input type="hidden" name="items" value={JSON.stringify(itemsPayload)} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
        <div className="space-y-5">
          <section className="rounded-xl border bg-background p-4 shadow-xs sm:p-5">
            <div className="mb-4 flex items-center gap-2">
              <ClipboardList className="size-4 text-primary" aria-hidden />
              <div>
                <h3 className="font-semibold">ข้อมูลใบรับสินค้า</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  ผู้จัดจำหน่ายและวันที่รับเข้าคลัง
                </p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="supplierId">ผู้จัดจำหน่าย *</Label>
                <select
                  id="supplierId"
                  name="supplierId"
                  required
                  defaultValue={supplierValue}
                  className={selectClassName}
                  aria-invalid={Boolean(state.fieldErrors?.supplierId)}
                >
                  <option value="">เลือกผู้จัดจำหน่าย</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
                <FieldError
                  fieldErrors={state.fieldErrors}
                  field="supplierId"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="receivedDate">วันที่รับสินค้า *</Label>
                <Input
                  id="receivedDate"
                  name="receivedDate"
                  type="date"
                  required
                  defaultValue={receivedDateValue}
                  className={inputClassName}
                  aria-invalid={Boolean(state.fieldErrors?.receivedDate)}
                />
                <FieldError
                  fieldErrors={state.fieldErrors}
                  field="receivedDate"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="note">หมายเหตุ</Label>
                <Textarea
                  id="note"
                  name="note"
                  maxLength={1000}
                  defaultValue={noteValue}
                  className="min-h-16"
                  placeholder="เช่น เลขที่ใบกำกับภาษีผู้ขาย หรือเงื่อนไขเครดิต"
                />
                <FieldError fieldErrors={state.fieldErrors} field="note" />
              </div>
            </div>
          </section>

          <section className="rounded-xl border bg-background p-4 shadow-xs sm:p-5">
            <div className="mb-4">
              <h3 className="font-semibold">รายการสินค้า</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                สแกนบาร์โค้ดหรือ SKU แล้วกด Enter เพื่อเพิ่มรายการอย่างรวดเร็ว
              </p>
            </div>

            <div className="rounded-lg border bg-muted/20 p-3">
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <ScanBarcode
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <Input
                    value={scanValue}
                    onChange={(event) => {
                      setScanValue(event.target.value);
                      setScanMessage(null);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        scanProduct();
                      }
                    }}
                    autoFocus
                    autoComplete="off"
                    className={cn(inputClassName, "pl-9 font-mono")}
                    placeholder="สแกนบาร์โค้ด / พิมพ์ SKU"
                    aria-label="สแกนบาร์โค้ดหรือ SKU เพื่อเพิ่มรายการ"
                  />
                </div>
                <Button type="button" variant="outline" onClick={scanProduct}>
                  <Barcode aria-hidden />
                  เพิ่มจากบาร์โค้ด
                </Button>
              </div>
              {scanMessage ? (
                <p
                  className={cn(
                    "mt-2 text-xs",
                    scanMessage.tone === "error"
                      ? "text-destructive"
                      : "text-emerald-700 dark:text-emerald-300",
                  )}
                >
                  {scanMessage.text}
                </p>
              ) : null}
            </div>

            <div className="mt-4 space-y-3">
              {lines.length === 0 ? (
                <div className="rounded-lg border border-dashed p-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    ยังไม่มีรายการสินค้า
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-3"
                    onClick={() => addLine()}
                  >
                    <Plus aria-hidden />
                    เพิ่มรายการ
                  </Button>
                </div>
              ) : (
                lines.map((line, index) => {
                  const product = productMap.get(line.productId);
                  const lineTotal = safeMoney(line.unitCost).times(
                    Number(line.quantity) || 0,
                  );
                  const serialCount = splitSerialNumbers(line.serialText).length;

                  return (
                    <div
                      key={line.key}
                      className="rounded-lg border bg-card p-3 shadow-xs"
                    >
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-muted-foreground">
                          รายการที่ {index + 1}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => removeLine(line.key)}
                          aria-label={`ลบรายการที่ ${index + 1}`}
                        >
                          <Trash2 aria-hidden />
                        </Button>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_90px_130px]">
                        <div className="space-y-1.5">
                          <Label htmlFor={`product-${line.key}`}>สินค้า</Label>
                          <select
                            id={`product-${line.key}`}
                            value={line.productId}
                            onChange={(event) => {
                              const selected = productMap.get(
                                event.target.value,
                              );
                              updateLine(line.key, {
                                productId: event.target.value,
                                unitCost: selected?.costPrice ?? "",
                                serialText: "",
                              });
                            }}
                            className={selectClassName}
                          >
                            <option value="">เลือกสินค้า</option>
                            {products.map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.sku} · {option.name}
                                {option.trackSerial ? " [Serial]" : ""}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor={`quantity-${line.key}`}>จำนวน</Label>
                          <Input
                            id={`quantity-${line.key}`}
                            type="number"
                            min={1}
                            max={10000}
                            step={1}
                            required={Boolean(line.productId)}
                            value={line.quantity}
                            onChange={(event) =>
                              updateLine(line.key, {
                                quantity: event.target.value,
                              })
                            }
                            className={inputClassName}
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor={`cost-${line.key}`}>
                            ต้นทุน/หน่วย
                          </Label>
                          <Input
                            id={`cost-${line.key}`}
                            inputMode="decimal"
                            required={Boolean(line.productId)}
                            value={line.unitCost}
                            onChange={(event) =>
                              updateLine(line.key, {
                                unitCost: event.target.value,
                              })
                            }
                            className={inputClassName}
                            placeholder="0.00"
                          />
                        </div>
                      </div>

                      {product ? (
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                          <span>คงเหลือ {product.stockQty} ชิ้น</span>
                          {product.trackSerial ? (
                            <Badge variant="outline">
                              ต้องระบุ Serial {Number(line.quantity) || 0}{" "}
                              รายการ
                            </Badge>
                          ) : (
                            <span>ไม่ติดตาม Serial</span>
                          )}
                          <span className="ml-auto font-medium text-foreground">
                            รวม {formatTHB(lineTotal.toString())}
                          </span>
                        </div>
                      ) : null}

                      {product?.trackSerial ? (
                        <div className="mt-3 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <Label htmlFor={`serials-${line.key}`}>
                              Serial Number (หนึ่งบรรทัดต่อหนึ่งเครื่อง)
                            </Label>
                            <span
                              className={cn(
                                "text-[11px]",
                                serialCount ===
                                  (Number(line.quantity) || 0)
                                  ? "text-emerald-700 dark:text-emerald-300"
                                  : "text-amber-700 dark:text-amber-300",
                              )}
                            >
                              {serialCount}/{Number(line.quantity) || 0}
                            </span>
                          </div>
                          <Textarea
                            id={`serials-${line.key}`}
                            value={line.serialText}
                            onChange={(event) =>
                              updateLine(line.key, {
                                serialText: event.target.value,
                              })
                            }
                            className="min-h-20 font-mono text-xs"
                            placeholder={"SN-000001\nSN-000002"}
                          />
                          {serialCount !== (Number(line.quantity) || 0) ? (
                            <p className="flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-300">
                              <CircleAlert className="size-3" aria-hidden />
                              จำนวน Serial ต้องตรงกับจำนวนสินค้า
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>

            {lines.length > 0 ? (
              <Button
                type="button"
                variant="outline"
                className="mt-3"
                onClick={() => addLine()}
              >
                <Plus aria-hidden />
                เพิ่มอีกรายการ
              </Button>
            ) : null}
          </section>
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border bg-background p-4 shadow-xs">
            <h3 className="font-semibold">สรุปใบรับ</h3>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">รายการ</dt>
                <dd className="font-medium">{validLines.length}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">จำนวนรวม</dt>
                <dd className="font-medium">
                  {totalUnits.toLocaleString("th-TH")} ชิ้น
                </dd>
              </div>
              <div className="flex justify-between gap-2 border-t pt-2">
                <dt className="font-medium">ต้นทุนรวม</dt>
                <dd className="text-lg font-semibold">
                  {formatTHB(totalCost.toString())}
                </dd>
              </div>
            </dl>
            <SubmitButton className="mt-4 h-10 w-full" pendingText="กำลังบันทึก...">
              <Save aria-hidden />
              บันทึกรับสินค้า
            </SubmitButton>
            <p className="mt-2 text-[11px] text-muted-foreground">
              เมื่อบันทึกแล้ว สต๊อกและต้นทุนเฉลี่ยจะเปลี่ยนทันที
              และไม่สามารถแก้ไขใบรับย้อนหลังได้
            </p>
          </div>

          <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-900 dark:text-amber-200">
            <div className="flex gap-2">
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <p>
                กรุณาตรวจจำนวนและ Serial ก่อนบันทึก หากผิดพลาดให้ใช้การปรับสต๊อกพร้อมเหตุผล
              </p>
            </div>
          </div>
        </aside>
      </div>
    </form>
  );
}
