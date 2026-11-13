"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import {
  Banknote,
  CheckCircle2,
  Copy,
  CreditCard,
  FileText,
  Minus,
  MessageCircle,
  PauseCircle,
  PlayCircle,
  Plus,
  Printer,
  QrCode,
  ScanBarcode,
  Search,
  ShoppingCart,
  Trash2,
  WalletCards,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  calculateBillTotals,
  calculateLineTotals,
} from "@/lib/bill-calculations";
import { paymentMethodLabel } from "@/lib/bill-labels";
import { selectClassName } from "@/lib/form-styles";
import { buildPromptPayPayload } from "@/lib/promptpay";
import {
  buildQuoteMessage,
  buildReceiptMessage,
  lineShareUrl,
  whatsAppUrl,
} from "@/lib/messaging";
import { Decimal, formatTHB } from "@/lib/money";
import { cn } from "@/lib/utils";
import {
  createPosQuoteAction,
  createPosSaleAction,
} from "@/server/actions/pos";

type PosProduct = {
  id: string;
  sku: string;
  name: string;
  brand: string | null;
  model: string | null;
  salePrice: string;
  stockQty: number;
  warrantyMonths: number;
  trackSerial: boolean;
  category: { id: string; name: string };
  barcodes: string[];
  serials: Array<{ id: string; serialNumber: string }>;
};

type PosCustomer = {
  id: string;
  name: string;
  phone: string;
  lineId: string | null;
  whatsapp: string | null;
};

type PosTechnician = { id: string; name: string };

type PosSettings = {
  shopName: string;
  vatEnabled: boolean;
  vatRate: string;
  vatIncluded: boolean;
  promptpayId: string | null;
  bankInfo: string | null;
  lineId: string | null;
  whatsapp: string | null;
};

type PosData = {
  products: PosProduct[];
  customers: PosCustomer[];
  technicians: PosTechnician[];
  settings: PosSettings;
  walkIn: PosCustomer | null;
  isAdmin: boolean;
};

type CartLine = {
  key: string;
  kind: "PRODUCT" | "SERVICE";
  productId?: string;
  sku?: string;
  description: string;
  quantity: number;
  unitPrice: string;
  discountType: "" | "PERCENT" | "AMOUNT";
  discountValue: string;
  serialIds: string[];
  trackSerial?: boolean;
  stockQty?: number;
};

type PaymentMethod = "CASH" | "TRANSFER" | "CARD" | "QR";

type Receipt = {
  billId: string;
  billNumber: string;
  status: string;
  grandTotal: string;
  changeAmount: string;
  requiresApproval: boolean;
  paymentMethod: PaymentMethod;
  customerName: string;
  customerPhone: string;
};

type QuoteResult = {
  quoteId: string;
  quoteNumber: string;
  grandTotal: string;
  validUntil: string;
  customerName: string;
  customerPhone: string;
  note: string;
};

type HeldBill = {
  id: string;
  label: string;
  createdAt: string;
  lines: CartLine[];
  customerId: string;
  discountType: "" | "PERCENT" | "AMOUNT";
  discountValue: string;
  note: string;
};

const HELD_KEY = "compos.pos.held.v1";

function safeDecimal(value: string | null | undefined): Decimal {
  try {
    return new Decimal(value?.trim() || "0");
  } catch {
    return new Decimal(0);
  }
}

function lineTotal(line: CartLine): Decimal {
  try {
    return calculateLineTotals({
      quantity: line.quantity,
      unitPrice: line.unitPrice || "0",
      discountType: line.discountType || null,
      discountValue: line.discountValue || "0",
    }).lineTotal;
  } catch {
    return new Decimal(0);
  }
}

function makeLine(product: PosProduct): CartLine {
  return {
    key: `${product.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    kind: "PRODUCT",
    productId: product.id,
    sku: product.sku,
    description: product.name,
    quantity: 1,
    unitPrice: product.salePrice,
    discountType: "",
    discountValue: "0",
    serialIds: [],
    trackSerial: product.trackSerial,
    stockQty: product.stockQty,
  };
}

export function PosTerminal({
  data,
  currentUserName,
}: {
  data: PosData;
  currentUserName: string;
}) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [customerId, setCustomerId] = useState("walkin");
  const [technicianId, setTechnicianId] = useState(
    data.technicians[0]?.id ?? "",
  );
  const [discountType, setDiscountType] = useState<"" | "PERCENT" | "AMOUNT">(
    "",
  );
  const [discountValue, setDiscountValue] = useState("0");
  const [note, setNote] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("ALL");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [received, setReceived] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);

  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [quoteResult, setQuoteResult] = useState<QuoteResult | null>(null);

  const [serialPicker, setSerialPicker] = useState<{
    product: PosProduct;
    selected: string[];
  } | null>(null);

  const [customOpen, setCustomOpen] = useState(false);
  const [customDescription, setCustomDescription] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [customQuantity, setCustomQuantity] = useState("1");

  const [heldBills, setHeldBills] = useState<HeldBill[]>([]);
  const [heldOpen, setHeldOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(HELD_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as HeldBill[];
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (Array.isArray(parsed)) setHeldBills(parsed);
      }
    } catch {
      // ignore malformed local data
    }
  }, []);

  const categories = useMemo(() => {
    const map = new Map<string, string>();
    for (const product of data.products) {
      map.set(product.category.id, product.category.name);
    }
    return [...map.entries()];
  }, [data.products]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return data.products.filter((product) => {
      if (category !== "ALL" && product.category.id !== category) {
        return false;
      }
      if (!query) return true;
      return (
        product.name.toLowerCase().includes(query) ||
        product.sku.toLowerCase().includes(query) ||
        product.barcodes.some((barcode) => barcode.toLowerCase() === query) ||
        (product.brand ?? "").toLowerCase().includes(query) ||
        (product.model ?? "").toLowerCase().includes(query)
      );
    });
  }, [data.products, search, category]);

  const totals = useMemo(() => {
    try {
      return calculateBillTotals({
        lineTotals: lines.map((line) => ({
          lineTotal: lineTotal(line),
          discountAmount: (() => {
            try {
              return calculateLineTotals({
                quantity: line.quantity,
                unitPrice: line.unitPrice || "0",
                discountType: line.discountType || null,
                discountValue: line.discountValue || "0",
              }).discountAmount;
            } catch {
              return new Decimal(0);
            }
          })(),
        })),
        discountType: discountType || null,
        discountValue,
        vatEnabled: data.settings.vatEnabled,
        vatIncluded: data.settings.vatIncluded,
        vatRate: data.settings.vatRate,
      });
    } catch {
      return null;
    }
  }, [lines, discountType, discountValue, data.settings]);

  const grandTotal = useMemo(
    () => totals?.grandTotal ?? new Decimal(0),
    [totals],
  );
  const change = safeDecimal(received).minus(grandTotal);

  const selectedCustomer = useMemo(() => {
    if (customerId === "walkin") {
      return (
        data.walkIn ?? {
          id: "walkin",
          name: "ลูกค้าทั่วไป",
          phone: "",
          lineId: null,
          whatsapp: null,
        }
      );
    }
    return data.customers.find((customer) => customer.id === customerId);
  }, [customerId, data.customers, data.walkIn]);

  useEffect(() => {
    let cancelled = false;

    if (paymentMethod !== "QR" || !data.settings.promptpayId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQrSvg(null);
      setQrError(null);
      return;
    }

    try {
      const payload = buildPromptPayPayload({
        promptpayId: data.settings.promptpayId,
        amount: grandTotal,
      });
      import("qrcode")
        .then((module) => {
          const QRCode = module.default ?? module;
          return QRCode.toString(payload, {
            type: "svg",
            margin: 1,
            width: 220,
            errorCorrectionLevel: "M",
          });
        })
        .then((svg) => {
          if (!cancelled) {
            setQrSvg(svg);
            setQrError(null);
          }
        })
        .catch(() => {
          if (!cancelled) setQrError("สร้าง QR ไม่สำเร็จ");
        });
    } catch (qrFailure) {
      setQrError(
        qrFailure instanceof Error ? qrFailure.message : "สร้าง QR ไม่สำเร็จ",
      );
    }

    return () => {
      cancelled = true;
    };
  }, [paymentMethod, data.settings.promptpayId, grandTotal]);

  function persistHeld(next: HeldBill[]) {
    setHeldBills(next);
    try {
      window.localStorage.setItem(HELD_KEY, JSON.stringify(next));
    } catch {
      // ignore storage errors
    }
  }

  function resetCart() {
    setLines([]);
    setCustomerId("walkin");
    setTechnicianId(data.technicians[0]?.id ?? "");
    setDiscountType("");
    setDiscountValue("0");
    setNote("");
    setError(null);
    setMessage(null);
  }

  function addProduct(product: PosProduct) {
    setError(null);
    setMessage(null);

    if (product.stockQty <= 0) {
      setError(`${product.name} สต๊อกหมด`);
      return;
    }

    const existing = lines.find(
      (line) => line.kind === "PRODUCT" && line.productId === product.id,
    );

    if (product.trackSerial) {
      setSerialPicker({
        product,
        selected: existing?.serialIds ?? [],
      });
      return;
    }

    if (existing) {
      if (existing.quantity >= product.stockQty) {
        setError(`สต๊อก ${product.name} ไม่พอ`);
        return;
      }
      setLines((current) =>
        current.map((line) =>
          line.key === existing.key
            ? { ...line, quantity: line.quantity + 1 }
            : line,
        ),
      );
      return;
    }

    setLines((current) => [...current, makeLine(product)]);
  }

  function submitScan() {
    const query = search.trim();
    if (!query) return;
    const normalized = query.toLowerCase();
    const product = data.products.find(
      (item) =>
        item.barcodes.some((barcode) => barcode.toLowerCase() === normalized) ||
        item.sku.toLowerCase() === normalized,
    );

    if (!product) {
      setError("ไม่พบสินค้าจากบาร์โค้ดหรือ SKU นี้");
      return;
    }

    addProduct(product);
    setSearch("");
  }

  function updateLine(key: string, patch: Partial<CartLine>) {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  }

  function removeLine(key: string) {
    setLines((current) => current.filter((line) => line.key !== key));
  }

  function changeQuantity(line: CartLine, delta: number) {
    if (line.trackSerial) return;
    const next = Math.max(1, line.quantity + delta);
    if (line.stockQty !== undefined && next > line.stockQty) {
      setError(`สต๊อก ${line.description} ไม่พอ`);
      return;
    }
    updateLine(line.key, { quantity: next });
  }

  function addSerialSelection() {
    if (!serialPicker) return;
    const selected = serialPicker.selected;
    if (selected.length === 0) {
      setError("กรุณาเลือก Serial อย่างน้อย 1 รายการ");
      return;
    }

    const existing = lines.find(
      (line) =>
        line.kind === "PRODUCT" &&
        line.productId === serialPicker.product.id,
    );

    if (existing) {
      updateLine(existing.key, {
        serialIds: selected,
        quantity: selected.length,
      });
    } else {
      setLines((current) => [
        ...current,
        {
          ...makeLine(serialPicker.product),
          serialIds: selected,
          quantity: selected.length,
        },
      ]);
    }

    setSerialPicker(null);
    setError(null);
  }

  function addCustomItem() {
    const price = customPrice.trim();
    const quantity = Number(customQuantity);
    if (!customDescription.trim() || !price || !Number.isFinite(quantity)) {
      setError("กรุณากรอกรายละเอียด ราคา และจำนวน");
      return;
    }

    setLines((current) => [
      ...current,
      {
        key: `custom-${Date.now()}`,
        kind: "SERVICE",
        description: customDescription.trim(),
        quantity: Math.max(1, Math.trunc(quantity)),
        unitPrice: price,
        discountType: "",
        discountValue: "0",
        serialIds: [],
      },
    ]);
    setCustomOpen(false);
    setCustomDescription("");
    setCustomPrice("");
    setCustomQuantity("1");
    setError(null);
  }

  function holdBill() {
    if (lines.length === 0) {
      setError("ยังไม่มีรายการให้พักบิล");
      return;
    }

    const held: HeldBill = {
      id: `held-${Date.now()}`,
      label: `${selectedCustomer?.name ?? "ลูกค้าทั่วไป"} · ${formatTHB(grandTotal)}`,
      createdAt: new Date().toISOString(),
      lines,
      customerId,
      discountType,
      discountValue,
      note,
    };
    persistHeld([held, ...heldBills].slice(0, 20));
    resetCart();
    setMessage("พักบิลแล้ว กดปุ่มพักบิลเพื่อเปิดรายการที่พักไว้");
  }

  function resumeBill(held: HeldBill) {
    setLines(held.lines);
    setCustomerId(held.customerId);
    setDiscountType(held.discountType);
    setDiscountValue(held.discountValue);
    setNote(held.note);
    persistHeld(heldBills.filter((item) => item.id !== held.id));
    setHeldOpen(false);
    setMessage(`เปิดบิลที่พักไว้: ${held.label}`);
  }

  function removeHeld(id: string) {
    persistHeld(heldBills.filter((item) => item.id !== id));
  }

  function validateCart(
    options: { requireTechnician?: boolean; requireSerials?: boolean } = {},
  ): boolean {
    if (lines.length === 0) {
      setError("ตะกร้าว่าง กรุณาเพิ่มสินค้า");
      return false;
    }

    if (options.requireSerials !== false) {
      for (const line of lines) {
        if (line.kind === "PRODUCT" && line.trackSerial) {
          if (line.serialIds.length !== line.quantity) {
            setError(`กรุณาเลือก Serial ของ ${line.description} ให้ครบ`);
            return false;
          }
        }
      }
    }

    if (
      options.requireTechnician !== false &&
      data.isAdmin &&
      data.technicians.length > 0 &&
      !technicianId
    ) {
      setError("กรุณาเลือกช่างผู้รับผิดชอบ");
      return false;
    }

    return true;
  }

  function openPayment() {
    if (!validateCart()) return;
    setPaymentMethod("CASH");
    setReceived(grandTotal.toFixed(2));
    setPaymentReference("");
    setPaymentOpen(true);
    setError(null);
  }

  function payloadItems() {
    return lines.map((line) => ({
      kind: line.kind,
      productId: line.productId,
      description: line.description,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      discountType: line.discountType || null,
      discountValue: line.discountValue || "0",
      serialIds: line.serialIds,
    }));
  }

  function submitPayment() {
    if (!validateCart()) return;
    setError(null);

    const receivedAmount =
      paymentMethod === "CASH"
        ? received || grandTotal.toFixed(2)
        : grandTotal.toFixed(2);

    if (
      paymentMethod === "CASH" &&
      safeDecimal(receivedAmount).lessThan(grandTotal)
    ) {
      setError("ยอดรับเงินสดน้อยกว่ายอดที่ต้องชำระ");
      return;
    }

    startTransition(async () => {
      const result = await createPosSaleAction({
        customerId,
        technicianId: data.isAdmin ? technicianId : undefined,
        note,
        items: payloadItems(),
        discountType: discountType || null,
        discountValue,
        paymentMethod,
        receivedAmount,
        changeAmount:
          paymentMethod === "CASH"
            ? safeDecimal(receivedAmount).minus(grandTotal).toFixed(2)
            : "0",
        paymentReference: paymentReference.trim() || undefined,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      const billId = String(result.data.billId ?? "");
      const billNumber = String(result.data.billNumber ?? "");
      const status = String(result.data.status ?? "");
      const requiresApproval = Boolean(result.data.requiresApproval);

      setReceipt({
        billId,
        billNumber,
        status,
        grandTotal: String(result.data.grandTotal ?? grandTotal.toFixed(2)),
        changeAmount: String(result.data.changeAmount ?? "0.00"),
        requiresApproval,
        paymentMethod,
        customerName: selectedCustomer?.name ?? "ลูกค้าทั่วไป",
        customerPhone: selectedCustomer?.phone ?? "",
      });
      setPaymentOpen(false);
      resetCart();
    });
  }

  function submitQuote() {
    if (
      !validateCart({ requireTechnician: false, requireSerials: false })
    ) {
      return;
    }
    setError(null);

    startTransition(async () => {
      const result = await createPosQuoteAction({
        customerId,
        note,
        items: payloadItems(),
        discountType: discountType || null,
        discountValue,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setQuoteResult({
        quoteId: String(result.data.quoteId ?? ""),
        quoteNumber: String(result.data.quoteNumber ?? ""),
        grandTotal: String(result.data.grandTotal ?? "0.00"),
        validUntil: String(result.data.validUntil ?? ""),
        customerName: selectedCustomer?.name ?? "ลูกค้าทั่วไป",
        customerPhone: selectedCustomer?.phone ?? "",
        note,
      });
      resetCart();
    });
  }

  async function copyText(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setMessage("คัดลอกข้อความแล้ว");
    } catch {
      setError("คัดลอกไม่สำเร็จ กรุณาเลือกข้อความด้วยตนเอง");
    }
  }

  const receiptMessage = receipt
    ? buildReceiptMessage({
        shopName: data.settings.shopName,
        customerName: receipt.customerName,
        billNumber: receipt.billNumber,
        amount: formatTHB(receipt.grandTotal),
      })
    : "";

  const quoteMessage = quoteResult
    ? buildQuoteMessage({
        shopName: data.settings.shopName,
        customerName: quoteResult.customerName,
        quoteNumber: quoteResult.quoteNumber,
        amount: formatTHB(quoteResult.grandTotal),
        validUntil: quoteResult.validUntil,
        note: quoteResult.note,
      })
    : "";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            ขายหน้าร้าน (POS)
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            สแกนสินค้า เพิ่มรายการ และรับชำระเงินได้ในหน้าเดียว
            {data.isAdmin
              ? " · ผู้ดูแลระบบชำระเงินและตัดสต๊อกทันที"
              : ` · ${currentUserName} ส่งบิลเพื่อขออนุมัติ`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setHeldOpen(true)}
          >
            <PauseCircle aria-hidden />
            บิลที่พักไว้ ({heldBills.length})
          </Button>
          <Link
            href="/quotes"
            className={cn(
              "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border bg-background px-3 text-sm font-medium hover:bg-muted",
            )}
          >
            <FileText className="size-4" aria-hidden />
            ใบเสนอราคา
          </Link>
        </div>
      </div>

      {message ? (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">
          <span>{message}</span>
          <button
            type="button"
            onClick={() => setMessage(null)}
            aria-label="ปิดข้อความ"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      ) : null}
      {error ? (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            aria-label="ปิดข้อความ"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card className="min-w-0">
          <CardContent className="space-y-3 p-3 sm:p-4">
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <ScanBarcode
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setError(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      submitScan();
                    }
                  }}
                  className="h-11 pl-9"
                  placeholder="สแกนบาร์โค้ด / ค้นหาชื่อหรือ SKU แล้วกด Enter"
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11"
                  onClick={() => setCustomOpen(true)}
                >
                  <Plus aria-hidden />
                  รายการกำหนดเอง
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11"
                  onClick={holdBill}
                >
                  <PauseCircle aria-hidden />
                  พักบิล
                </Button>
              </div>
            </div>

            <div className="flex gap-1.5 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setCategory("ALL")}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium",
                  category === "ALL"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-muted",
                )}
              >
                ทั้งหมด
              </button>
              {categories.map(([id, name]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setCategory(id)}
                  className={cn(
                    "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium",
                    category === id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:bg-muted",
                  )}
                >
                  {name}
                </button>
              ))}
            </div>

            {filteredProducts.length === 0 ? (
              <div className="rounded-xl border border-dashed px-4 py-14 text-center text-sm text-muted-foreground">
                <Search className="mx-auto mb-2 size-6 opacity-50" aria-hidden />
                ไม่พบสินค้าที่ตรงกับคำค้น
              </div>
            ) : (
              <div className="grid max-h-[calc(100svh-21rem)] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3 2xl:grid-cols-4">
                {filteredProducts.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => addProduct(product)}
                    disabled={product.stockQty <= 0}
                    className={cn(
                      "group flex min-h-32 flex-col rounded-xl border bg-background p-3 text-left transition hover:border-primary/60 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-50",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Badge variant="secondary" className="text-[10px]">
                        {product.category.name}
                      </Badge>
                      <span
                        className={cn(
                          "text-[10px] tabular-nums",
                          product.stockQty <= 0
                            ? "text-rose-600 dark:text-rose-300"
                            : "text-muted-foreground",
                        )}
                      >
                        คงเหลือ {product.stockQty}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm font-medium leading-5">
                      {product.name}
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                      {product.sku}
                      {product.trackSerial ? " · SN" : ""}
                    </p>
                    <div className="mt-auto flex items-end justify-between gap-2 pt-2">
                      <span className="text-sm font-semibold tabular-nums text-yellow-600 dark:text-price-gold">
                        {formatTHB(product.salePrice)}
                      </span>
                      <Plus
                        className="size-4 text-muted-foreground group-hover:text-primary"
                        aria-hidden
                      />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardContent className="space-y-3 p-3 sm:p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <ShoppingCart className="size-4 text-primary" aria-hidden />
                ตะกร้า ({lines.length})
              </h3>
              {lines.length > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={resetCart}
                >
                  <Trash2 aria-hidden />
                  ล้าง
                </Button>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="pos-customer">ลูกค้า</Label>
              <select
                id="pos-customer"
                value={customerId}
                onChange={(event) => setCustomerId(event.target.value)}
                className={selectClassName}
              >
                <option value="walkin">ลูกค้าทั่วไป</option>
                {data.customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name} · {customer.phone}
                  </option>
                ))}
              </select>
              {data.isAdmin && data.technicians.length > 0 ? (
                <select
                  value={technicianId}
                  onChange={(event) => setTechnicianId(event.target.value)}
                  className={selectClassName}
                  aria-label="ช่างผู้รับผิดชอบ"
                >
                  {data.technicians.map((technician) => (
                    <option key={technician.id} value={technician.id}>
                      ช่าง: {technician.name}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>

            <div className="max-h-[42svh] space-y-2 overflow-y-auto pr-1">
              {lines.length === 0 ? (
                <div className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
                  <ShoppingCart
                    className="mx-auto mb-2 size-7 opacity-40"
                    aria-hidden
                  />
                  ยังไม่มีรายการในตะกร้า
                  <p className="mt-1 text-xs">
                    คลิกสินค้าหรือสแกนบาร์โค้ดเพื่อเริ่มขาย
                  </p>
                </div>
              ) : (
                lines.map((line) => (
                  <div
                    key={line.key}
                    className="rounded-xl border bg-muted/15 p-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-5">
                          {line.description}
                        </p>
                        {line.sku ? (
                          <p className="font-mono text-[10px] text-muted-foreground">
                            {line.sku}
                          </p>
                        ) : null}
                        {line.trackSerial ? (
                          <p className="mt-0.5 text-[10px] text-muted-foreground">
                            Serial {line.serialIds.length} รายการ
                          </p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeLine(line.key)}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label={`ลบ ${line.description}`}
                      >
                        <X className="size-4" aria-hidden />
                      </button>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1">
                        {line.trackSerial ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-[11px]"
                            onClick={() => {
                              const product = data.products.find(
                                (item) => item.id === line.productId,
                              );
                              if (product) {
                                setSerialPicker({
                                  product,
                                  selected: line.serialIds,
                                });
                              }
                            }}
                          >
                            เลือก Serial
                          </Button>
                        ) : (
                          <>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="size-7"
                              onClick={() => changeQuantity(line, -1)}
                              aria-label="ลดจำนวน"
                            >
                              <Minus className="size-3" aria-hidden />
                            </Button>
                            <span className="w-7 text-center text-sm tabular-nums">
                              {line.quantity}
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="size-7"
                              onClick={() => changeQuantity(line, 1)}
                              aria-label="เพิ่มจำนวน"
                            >
                              <Plus className="size-3" aria-hidden />
                            </Button>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Input
                          value={line.unitPrice}
                          onChange={(event) =>
                            updateLine(line.key, {
                              unitPrice: event.target.value,
                            })
                          }
                          className="h-7 w-20 text-right text-xs tabular-nums"
                          inputMode="decimal"
                          aria-label={`ราคา ${line.description}`}
                        />
                        <span className="w-20 text-right text-sm font-semibold tabular-nums">
                          {formatTHB(lineTotal(line))}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="space-y-2 rounded-xl border bg-muted/20 p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">ยอดรายการ</span>
                <span className="tabular-nums">
                  {formatTHB(totals?.subtotal ?? 0)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">ส่วนลดท้ายบิล</span>
                <div className="flex items-center gap-1">
                  <select
                    value={discountType}
                    onChange={(event) =>
                      setDiscountType(
                        event.target.value as "" | "PERCENT" | "AMOUNT",
                      )
                    }
                    className="h-7 rounded-md border bg-background px-1.5 text-[11px]"
                    aria-label="ประเภทส่วนลด"
                  >
                    <option value="">ไม่มี</option>
                    <option value="AMOUNT">บาท</option>
                    <option value="PERCENT">%</option>
                  </select>
                  <Input
                    value={discountValue}
                    onChange={(event) => setDiscountValue(event.target.value)}
                    disabled={!discountType}
                    className="h-7 w-16 text-right text-xs tabular-nums"
                    inputMode="decimal"
                    aria-label="ส่วนลดท้ายบิล"
                  />
                </div>
              </div>
              {data.settings.vatEnabled ? (
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    VAT {data.settings.vatRate}%{" "}
                    {data.settings.vatIncluded ? "รวมในราคา" : "แยกนอก"}
                  </span>
                  <span className="tabular-nums">
                    {formatTHB(totals?.vatAmount ?? 0)}
                  </span>
                </div>
              ) : null}
              <div className="flex items-end justify-between gap-2 border-t pt-2">
                <span className="font-semibold">ยอดรวม</span>
                <span className="text-2xl font-semibold tabular-nums text-primary">
                  {formatTHB(grandTotal)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-10"
                onClick={submitQuote}
                disabled={isPending || lines.length === 0}
              >
                <FileText aria-hidden />
                ใบเสนอราคา
              </Button>
              <Button
                type="button"
                className="h-10"
                onClick={openPayment}
                disabled={isPending || lines.length === 0}
              >
                <WalletCards aria-hidden />
                {data.isAdmin ? "รับชำระเงิน" : "ส่งขออนุมัติ"}
              </Button>
            </div>
            <p className="text-center text-[10px] leading-4 text-muted-foreground">
              {data.isAdmin
                ? "ชำระเงินแล้วระบบจะอนุมัติและตัดสต๊อกทันที"
                : "บิลจะถูกส่งให้ผู้ดูแลระบบอนุมัติก่อนตัดสต๊อก"}
            </p>
          </CardContent>
        </Card>
      </div>

      {serialPicker ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border bg-background p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">เลือก Serial</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {serialPicker.product.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSerialPicker(null)}
                aria-label="ปิด"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <div className="mt-4 max-h-72 space-y-1.5 overflow-y-auto">
              {serialPicker.product.serials.length === 0 ? (
                <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                  ไม่มี Serial พร้อมขาย
                </p>
              ) : (
                serialPicker.product.serials.map((serial) => {
                  const checked = serialPicker.selected.includes(serial.id);
                  return (
                    <label
                      key={serial.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 text-sm",
                        checked
                          ? "border-primary bg-primary/5"
                          : "hover:bg-muted/40",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setSerialPicker((current) =>
                            current
                              ? {
                                  ...current,
                                  selected: checked
                                    ? current.selected.filter(
                                        (id) => id !== serial.id,
                                      )
                                    : [...current.selected, serial.id],
                                }
                              : current,
                          )
                        }
                        className="size-4 rounded border-input accent-primary"
                      />
                      <span className="font-mono text-xs">
                        {serial.serialNumber}
                      </span>
                    </label>
                  );
                })
              )}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSerialPicker(null)}
              >
                ยกเลิก
              </Button>
              <Button type="button" onClick={addSerialSelection}>
                เพิ่มลงตะกร้า
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {customOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border bg-background p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">รายการกำหนดเอง</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  เพิ่มค่าบริการหรืองานนอกระบบ
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCustomOpen(false)}
                aria-label="ปิด"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <div className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="custom-description">รายละเอียด *</Label>
                <Input
                  id="custom-description"
                  value={customDescription}
                  onChange={(event) =>
                    setCustomDescription(event.target.value)
                  }
                  placeholder="เช่น ค่าบริการติดตั้ง"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="custom-price">ราคา *</Label>
                  <Input
                    id="custom-price"
                    value={customPrice}
                    onChange={(event) => setCustomPrice(event.target.value)}
                    inputMode="decimal"
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="custom-quantity">จำนวน</Label>
                  <Input
                    id="custom-quantity"
                    value={customQuantity}
                    onChange={(event) =>
                      setCustomQuantity(event.target.value)
                    }
                    inputMode="numeric"
                  />
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCustomOpen(false)}
              >
                ยกเลิก
              </Button>
              <Button type="button" onClick={addCustomItem}>
                เพิ่มรายการ
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {paymentOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[92svh] w-full max-w-2xl overflow-y-auto rounded-2xl border bg-background p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">รับชำระเงิน</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selectedCustomer?.name ?? "ลูกค้าทั่วไป"} ·{" "}
                  {formatTHB(grandTotal)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPaymentOpen(false)}
                aria-label="ปิด"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(
                [
                  ["CASH", "เงินสด", Banknote],
                  ["QR", "พร้อมเพย์", QrCode],
                  ["TRANSFER", "โอนเงิน", CreditCard],
                  ["CARD", "บัตร", CreditCard],
                ] as const
              ).map(([method, label, Icon]) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentMethod(method)}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-xl border p-3 text-xs font-medium transition",
                    paymentMethod === method
                      ? "border-primary bg-primary/5 text-primary"
                      : "hover:bg-muted/40",
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                  {label}
                </button>
              ))}
            </div>

            <div className="mt-4 space-y-3">
              {paymentMethod === "CASH" ? (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="pos-received">รับเงินสด</Label>
                    <Input
                      id="pos-received"
                      value={received}
                      onChange={(event) => setReceived(event.target.value)}
                      inputMode="decimal"
                      className="h-12 text-right text-xl font-semibold tabular-nums"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      grandTotal.toFixed(2),
                      new Decimal(grandTotal).plus(20).toFixed(2),
                      new Decimal(grandTotal).plus(50).toFixed(2),
                      new Decimal(grandTotal).plus(100).toFixed(2),
                      new Decimal(grandTotal).plus(500).toFixed(2),
                    ].map((amount) => (
                      <Button
                        key={amount}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setReceived(amount)}
                      >
                        {formatTHB(amount)}
                      </Button>
                    ))}
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm">
                    <span className="text-muted-foreground">เงินทอน</span>
                    <span className="text-lg font-semibold tabular-nums">
                      {change.greaterThan(0) ? formatTHB(change) : formatTHB(0)}
                    </span>
                  </div>
                </>
              ) : null}

              {paymentMethod === "QR" ? (
                <div className="rounded-xl border border-neutral-200 bg-white p-4 text-center text-neutral-900">
                  {data.settings.promptpayId ? (
                    qrError ? (
                      <p className="text-sm text-rose-700">{qrError}</p>
                    ) : qrSvg ? (
                      <div
                        className="mx-auto w-fit [&_svg]:h-56 [&_svg]:w-56"
                        dangerouslySetInnerHTML={{ __html: qrSvg }}
                      />
                    ) : (
                      <p className="text-sm text-neutral-500">
                        กำลังสร้าง QR...
                      </p>
                    )
                  ) : (
                    <p className="text-sm text-rose-700">
                      ยังไม่ได้ตั้งค่าพร้อมเพย์ในหน้าข้อมูลร้าน
                    </p>
                  )}
                  <p className="mt-2 text-xs text-neutral-600">
                    สแกนจ่ายผ่านแอปธนาคาร · ยอด{" "}
                    <span className="font-semibold">
                      {formatTHB(grandTotal)}
                    </span>
                  </p>
                </div>
              ) : null}

              {paymentMethod === "TRANSFER" ? (
                <div className="rounded-xl border bg-muted/20 p-4 text-sm">
                  <p className="font-medium">ข้อมูลบัญชีร้าน</p>
                  <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                    {data.settings.bankInfo?.trim() ||
                      "ยังไม่ได้ระบุข้อมูลบัญชีในหน้าข้อมูลร้าน"}
                  </p>
                </div>
              ) : null}

              {paymentMethod === "CARD" ? (
                <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
                  บันทึกยอดชำระผ่านเครื่องรูดบัตร/EDC ของร้าน
                  แล้วยืนยันเพื่อปิดบิล
                </div>
              ) : null}

              <div className="space-y-1.5">
                <Label htmlFor="pos-reference">อ้างอิงการชำระ (ถ้ามี)</Label>
                <Input
                  id="pos-reference"
                  value={paymentReference}
                  onChange={(event) => setPaymentReference(event.target.value)}
                  placeholder="เลขที่รายการโอน / หมายเหตุ"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pos-note">หมายเหตุบิล</Label>
                <Textarea
                  id="pos-note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={2}
                  className="min-h-16"
                  placeholder="เช่น ลูกค้ารับเอง / ส่ง Kerry"
                />
              </div>
            </div>

            {error ? (
              <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:bg-rose-950/30 dark:text-rose-200">
                {error}
              </p>
            ) : null}

            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPaymentOpen(false)}
              >
                ยกเลิก
              </Button>
              <Button
                type="button"
                onClick={submitPayment}
                disabled={isPending}
                className="min-w-40"
              >
                <CheckCircle2 aria-hidden />
                {isPending
                  ? "กำลังบันทึก..."
                  : data.isAdmin
                    ? "ยืนยันรับชำระ"
                    : "ส่งขออนุมัติ"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {receipt ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border bg-background p-5 shadow-xl">
            <div className="text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                <CheckCircle2 className="size-6" aria-hidden />
              </div>
              <h3 className="mt-3 text-lg font-semibold">
                {receipt.requiresApproval ? "ส่งบิลแล้ว" : "ชำระเงินสำเร็จ"}
              </h3>
              <p className="mt-1 font-mono text-sm text-muted-foreground">
                {receipt.billNumber}
              </p>
              <p className="mt-3 text-2xl font-semibold tabular-nums">
                {formatTHB(receipt.grandTotal)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {paymentMethodLabel(receipt.paymentMethod)}
                {receipt.paymentMethod === "CASH" &&
                new Decimal(receipt.changeAmount).greaterThan(0)
                  ? ` · เงินทอน ${formatTHB(receipt.changeAmount)}`
                  : ""}
              </p>
              {receipt.requiresApproval ? (
                <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                  บิลนี้รอผู้ดูแลระบบอนุมัติก่อนตัดสต๊อก
                  สามารถติดตามสถานะได้จากหน้าบิล
                </p>
              ) : null}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <Link
                href={`/print/bills/${receipt.billId}/thermal-80mm`}
                target="_blank"
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border bg-background px-3 text-sm font-medium hover:bg-muted"
              >
                <Printer className="size-4" aria-hidden />
                พิมพ์สลิป
              </Link>
              <Link
                href={`/print/bills/${receipt.billId}/a4`}
                target="_blank"
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border bg-background px-3 text-sm font-medium hover:bg-muted"
              >
                <FileText className="size-4" aria-hidden />
                เอกสาร A4
              </Link>
              <Link
                href={`/bills/${receipt.billId}`}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border bg-background px-3 text-sm font-medium hover:bg-muted"
              >
                เปิดบิล
              </Link>
              <Button
                type="button"
                variant="outline"
                className="h-9"
                onClick={() => copyText(receiptMessage)}
              >
                <Copy aria-hidden />
                คัดลอกข้อความ
              </Button>
              <a
                href={lineShareUrl(receiptMessage)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border bg-background px-3 text-sm font-medium hover:bg-muted"
              >
                <MessageCircle className="size-4" aria-hidden />
                แชร์ LINE
              </a>
              {receipt.customerPhone &&
              receipt.customerPhone !== "0000000000" ? (
                <a
                  href={whatsAppUrl(receipt.customerPhone, receiptMessage)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border bg-background px-3 text-sm font-medium hover:bg-muted"
                >
                  <MessageCircle className="size-4" aria-hidden />
                  WhatsApp
                </a>
              ) : null}
            </div>

            <Button
              type="button"
              className="mt-3 w-full"
              onClick={() => setReceipt(null)}
            >
              เริ่มขายรายการใหม่
            </Button>
          </div>
        </div>
      ) : null}

      {quoteResult ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border bg-background p-5 shadow-xl">
            <div className="text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                <FileText className="size-6" aria-hidden />
              </div>
              <h3 className="mt-3 text-lg font-semibold">ออกใบเสนอราคาแล้ว</h3>
              <p className="mt-1 font-mono text-sm text-muted-foreground">
                {quoteResult.quoteNumber}
              </p>
              <p className="mt-3 text-2xl font-semibold tabular-nums">
                {formatTHB(quoteResult.grandTotal)}
              </p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Link
                href={`/quotes/${quoteResult.quoteId}`}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border bg-background px-3 text-sm font-medium hover:bg-muted"
              >
                เปิดใบเสนอราคา
              </Link>
              <Button
                type="button"
                variant="outline"
                className="h-9"
                onClick={() => copyText(quoteMessage)}
              >
                <Copy aria-hidden />
                คัดลอกข้อความ
              </Button>
              <a
                href={lineShareUrl(quoteMessage)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border bg-background px-3 text-sm font-medium hover:bg-muted"
              >
                <MessageCircle className="size-4" aria-hidden />
                แชร์ LINE
              </a>
              {quoteResult.customerPhone &&
              quoteResult.customerPhone !== "0000000000" ? (
                <a
                  href={whatsAppUrl(quoteResult.customerPhone, quoteMessage)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border bg-background px-3 text-sm font-medium hover:bg-muted"
                >
                  <MessageCircle className="size-4" aria-hidden />
                  WhatsApp
                </a>
              ) : null}
            </div>
            <Button
              type="button"
              className="mt-3 w-full"
              onClick={() => setQuoteResult(null)}
            >
              เริ่มขายรายการใหม่
            </Button>
          </div>
        </div>
      ) : null}

      {heldOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl border bg-background p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">บิลที่พักไว้</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  เก็บไว้ในเครื่องนี้สูงสุด 20 รายการ
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHeldOpen(false)}
                aria-label="ปิด"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <div className="mt-4 max-h-96 space-y-2 overflow-y-auto">
              {heldBills.length === 0 ? (
                <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                  ยังไม่มีบิลที่พักไว้
                </p>
              ) : (
                heldBills.map((held) => (
                  <div
                    key={held.id}
                    className="flex items-center justify-between gap-2 rounded-xl border p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {held.label}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(held.createdAt).toLocaleString("th-TH")} ·{" "}
                        {held.lines.length} รายการ
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => resumeBill(held)}
                      >
                        <PlayCircle aria-hidden />
                        เปิด
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => removeHeld(held.id)}
                        aria-label="ลบบิลที่พัก"
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
