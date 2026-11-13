import type {
  BillItemKind,
  BillStatus,
  DiscountType,
  PaymentMethod,
  QuoteStatus,
  RepairStatus,
  WarrantyCheckResult,
} from "@/generated/prisma/enums";
import { STATUS_TONE_CLASS } from "@/lib/status-tones";

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
      return STATUS_TONE_CLASS.emerald;
    case "APPROVED":
      return STATUS_TONE_CLASS.blue;
    case "PENDING_APPROVAL":
      return STATUS_TONE_CLASS.amber;
    case "REJECTED":
      return STATUS_TONE_CLASS.rose;
    case "VOIDED":
      return STATUS_TONE_CLASS.slate;
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
    case "QR":
      return "พร้อมเพย์ / QR";
    default:
      return "—";
  }
}

export function quoteStatusLabel(status: QuoteStatus): string {
  switch (status) {
    case "DRAFT":
      return "ร่าง";
    case "SENT":
      return "ส่งแล้ว";
    case "ACCEPTED":
      return "ลูกค้าตอบรับ";
    case "CONVERTED":
      return "เปิดบิลแล้ว";
    case "EXPIRED":
      return "หมดอายุ";
    case "CANCELLED":
      return "ยกเลิก";
    default:
      return status;
  }
}

export function quoteStatusBadgeClass(status: QuoteStatus): string {
  switch (status) {
    case "SENT":
      return STATUS_TONE_CLASS.blue;
    case "ACCEPTED":
      return STATUS_TONE_CLASS.emerald;
    case "CONVERTED":
      return STATUS_TONE_CLASS.teal;
    case "EXPIRED":
      return STATUS_TONE_CLASS.amber;
    case "CANCELLED":
      return STATUS_TONE_CLASS.slate;
    default:
      return "";
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
    case "WAITING_APPROVAL":
      return "รออนุมัติราคา";
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
      return STATUS_TONE_CLASS.emerald;
    case "FOUND_OUT_OF_WARRANTY":
      return STATUS_TONE_CLASS.amber;
    case "NOT_FOUND":
      return STATUS_TONE_CLASS.rose;
    default:
      return "";
  }
}
