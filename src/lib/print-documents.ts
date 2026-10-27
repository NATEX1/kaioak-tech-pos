import type { BillStatus } from "@/generated/prisma/enums";

export type PrintFormat = "a4" | "thermal-80mm";

export type PrintDocumentOptions = {
  vatEnabled?: boolean;
  hasCustomerTaxId?: boolean;
};

export function getPrintDocumentTitle(
  status: BillStatus,
  options?: PrintDocumentOptions,
): string {
  switch (status) {
    case "PAID":
      if (options?.vatEnabled) {
        return options.hasCustomerTaxId
          ? "ใบเสร็จรับเงิน / ใบกำกับภาษี"
          : "ใบเสร็จรับเงิน / ใบกำกับภาษีอย่างย่อ";
      }
      return "ใบเสร็จรับเงิน";
    case "APPROVED":
      return "ใบส่งของ / ใบแจ้งหนี้";
    case "PENDING_APPROVAL":
      return "ใบเสนอราคา / รออนุมัติ";
    case "REJECTED":
      return "บิลที่ถูกตีกลับ";
    case "VOIDED":
      return "ใบเสร็จรับเงิน (ยกเลิก)";
    default:
      return "บิลร่าง";
  }
}

export function getPrintDocumentEnglishTitle(
  status: BillStatus,
  options?: PrintDocumentOptions,
): string {
  switch (status) {
    case "PAID":
      if (options?.vatEnabled) {
        return options.hasCustomerTaxId
          ? "RECEIPT / TAX INVOICE"
          : "RECEIPT / ABB TAX INVOICE";
      }
      return "RECEIPT";
    case "APPROVED":
      return "DELIVERY NOTE / INVOICE";
    case "PENDING_APPROVAL":
      return "QUOTATION / PENDING APPROVAL";
    case "REJECTED":
      return "REJECTED BILL";
    case "VOIDED":
      return "RECEIPT (VOIDED)";
    default:
      return "DRAFT BILL";
  }
}

export function getPrintDocumentWarning(status: BillStatus): string | null {
  switch (status) {
    case "DRAFT":
      return "เอกสารตัวอย่างจากบิลร่าง — ยังไม่มีผลทางบัญชี";
    case "PENDING_APPROVAL":
      return "เอกสารตัวอย่างระหว่างรออนุมัติ — ยังไม่มีผลทางบัญชี";
    case "REJECTED":
      return "บิลนี้ถูกตีกลับ — เอกสารนี้ใช้เพื่อตรวจสอบภายในเท่านั้น";
    case "VOIDED":
      return "บิลนี้ถูกยกเลิกแล้ว — เอกสารนี้ไม่ใช้เป็นหลักฐานการขาย";
    default:
      return null;
  }
}

export function printFormatLabel(format: PrintFormat): string {
  return format === "a4" ? "กระดาษ A4" : "สลิป 80 มม.";
}

export function printFormatHref(
  billId: string,
  format: PrintFormat,
): string {
  return format === "a4"
    ? `/print/bills/${billId}/a4`
    : `/print/bills/${billId}/thermal-80mm`;
}
