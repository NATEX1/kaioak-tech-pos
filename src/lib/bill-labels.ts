import type {
  BillItemKind,
  BillStatus,
  DiscountType,
  PaymentMethod,
  RepairStatus,
  WarrantyCheckResult,
} from "@/generated/prisma/enums";

export function billStatusLabel(status: BillStatus): string {
  switch (status) {
    case "DRAFT":
      return "ร่าง";
    case "PENDING_APPROVAL":
      return "รออนุมัติ";
    case "APPROVED":
      return "อนุมัติแล้ว";
    case "REJECTED":
      return "ไม่อนุมัติ";
    case "PAID":
      return "ชำระแล้ว";
    case "VOIDED":
      return "ยกเลิก";
    default:
      return status;
  }
}

export function billStatusBadgeClass(status: BillStatus): string {
  switch (status) {
    case "PAID":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "APPROVED":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "PENDING_APPROVAL":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "REJECTED":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "VOIDED":
      return "border-slate-200 bg-slate-50 text-slate-600";
    default:
      return "";
  }
}

export function billTypeFallbackLabel(code: string): string {
  switch (code) {
    case "SALE":
      return "ขายสินค้า";
    case "REPAIR":
      return "ซ่อมเครื่อง";
    case "SERVICE":
      return "บริการ";
    case "WARRANTY_CLAIM":
      return "เคลมสินค้า";
    default:
      return code;
  }
}

export function billItemKindLabel(kind: BillItemKind): string {
  return kind === "PRODUCT" ? "สินค้า" : "บริการ";
}

export function paymentMethodLabel(method: PaymentMethod | null): string {
  switch (method) {
    case "CASH":
      return "เงินสด";
    case "TRANSFER":
      return "โอนเงิน";
    case "CARD":
      return "บัตร";
    default:
      return "—";
  }
}

export function discountTypeLabel(type: DiscountType | null): string {
  if (type === "PERCENT") return "เปอร์เซ็นต์";
  if (type === "AMOUNT") return "จำนวนเงิน";
  return "ไม่มีส่วนลด";
}

export function repairStatusLabel(status: RepairStatus): string {
  switch (status) {
    case "RECEIVED":
      return "รับเครื่องแล้ว";
    case "INSPECTING":
      return "กำลังตรวจสอบ";
    case "WAITING_PARTS":
      return "รออะไหล่";
    case "REPAIRING":
      return "กำลังซ่อม";
    case "COMPLETED":
      return "ซ่อมเสร็จ";
    case "DELIVERED":
      return "ส่งมอบแล้ว";
    default:
      return status;
  }
}

export function warrantyCheckResultLabel(
  result: WarrantyCheckResult | null,
): string {
  switch (result) {
    case "FOUND_IN_WARRANTY":
      return "พบประวัติ · อยู่ในประกัน";
    case "FOUND_OUT_OF_WARRANTY":
      return "พบประวัติ · หมดประกัน";
    case "NOT_FOUND":
      return "ไม่พบประวัติซื้อ";
    default:
      return "ยังไม่ได้ตรวจสอบ";
  }
}

export function warrantyCheckResultClass(
  result: WarrantyCheckResult | null,
): string {
  switch (result) {
    case "FOUND_IN_WARRANTY":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "FOUND_OUT_OF_WARRANTY":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "NOT_FOUND":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "";
  }
}
