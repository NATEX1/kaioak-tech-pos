import type { RepairStatus } from "@/generated/prisma/enums";
import { formatTHB } from "@/lib/money";
import { formatThaiDate, formatThaiDateTime } from "@/lib/labels";

export type MessageTemplateMap = Partial<Record<RepairStatus, string>>;

export const REPAIR_STATUS_ORDER: RepairStatus[] = [
  "RECEIVED",
  "INSPECTING",
  "WAITING_APPROVAL",
  "WAITING_PARTS",
  "REPAIRING",
  "COMPLETED",
  "DELIVERED",
];

export const DEFAULT_MESSAGE_TEMPLATES: Record<RepairStatus, string> = {
  RECEIVED:
    "สวัสดีครับ {customer}\n{shop} ได้รับเครื่อง {device} ของคุณแล้ว\nเลขที่งาน {bill}\nสถานะ: รับเครื่องแล้ว\nเราจะแจ้งความคืบหน้าให้ทราบครับ",
  INSPECTING:
    "สวัสดีครับ {customer}\nงานซ่อม {bill} ({device}) อยู่ระหว่างตรวจเช็คอาการ\nสถานะ: กำลังตรวจสอบ\nจะแจ้งผลและค่าใช้จ่ายให้ทราบครับ",
  WAITING_APPROVAL:
    "สวัสดีครับ {customer}\nงานซ่อม {bill} ({device}) ตรวจเช็คแล้ว\nยอดประเมิน {amount}\nสถานะ: รออนุมัติราคา\nกรุณายืนยันเพื่อให้เราดำเนินการต่อครับ",
  WAITING_PARTS:
    "สวัสดีครับ {customer}\nงานซ่อม {bill} ({device}) อยู่ระหว่างรออะไหล่\nสถานะ: รออะไหล่\nเมื่ออะไหล่มาถึงเราจะดำเนินการซ่อมทันทีครับ",
  REPAIRING:
    "สวัสดีครับ {customer}\nงานซ่อม {bill} ({device}) กำลังดำเนินการซ่อม\nสถานะ: กำลังซ่อม\nจะแจ้งให้ทราบเมื่อซ่อมเสร็จครับ",
  COMPLETED:
    "สวัสดีครับ {customer}\nงานซ่อม {bill} ({device}) ซ่อมเสร็จแล้ว\nยอดชำระ {amount}\nสถานะ: ซ่อมเสร็จ รอรับเครื่อง\nสามารถมารับเครื่องได้ที่ร้านครับ",
  DELIVERED:
    "สวัสดีครับ {customer}\nงานซ่อม {bill} ({device}) ส่งมอบเรียบร้อยแล้ว\nขอบคุณที่ใช้บริการ {shop} ครับ",
};

export type MessageVariables = {
  customer?: string | null;
  shop?: string | null;
  bill?: string | null;
  device?: string | null;
  status?: string | null;
  amount?: string | number | null;
  due?: Date | string | null;
  phone?: string | null;
  shopPhone?: string | null;
  lineId?: string | null;
};

export function renderMessageTemplate(
  template: string,
  variables: MessageVariables,
): string {
  const amount =
    variables.amount === null || variables.amount === undefined
      ? ""
      : typeof variables.amount === "number"
        ? formatTHB(variables.amount)
        : variables.amount;

  const due =
    variables.due === null || variables.due === undefined
      ? ""
      : formatThaiDate(variables.due);

  const values: Record<string, string> = {
    customer: variables.customer?.trim() || "ลูกค้า",
    shop: variables.shop?.trim() || "ร้านค้า",
    bill: variables.bill?.trim() || "-",
    device: variables.device?.trim() || "เครื่องของคุณ",
    status: variables.status?.trim() || "-",
    amount: amount || "-",
    due: due || "-",
    phone: variables.phone?.trim() || "-",
    shopPhone: variables.shopPhone?.trim() || "-",
    lineId: variables.lineId?.trim() || "-",
  };

  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.hasOwn(values, key) ? values[key] : match,
  );
}

export function buildRepairStatusMessage(input: {
  status: RepairStatus;
  templates?: MessageTemplateMap | null;
  variables: MessageVariables;
}): string {
  const template =
    input.templates?.[input.status]?.trim() ||
    DEFAULT_MESSAGE_TEMPLATES[input.status];

  return renderMessageTemplate(template, input.variables);
}

export function normalizeWhatsAppPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) {
    return `66${digits.slice(1)}`;
  }
  return digits;
}

export function whatsAppUrl(phone: string, message: string): string {
  const target = normalizeWhatsAppPhone(phone);
  return `https://wa.me/${target}?text=${encodeURIComponent(message)}`;
}

export function lineShareUrl(message: string): string {
  return `https://line.me/R/msg/text/?${encodeURIComponent(message)}`;
}

export function lineAddUrl(lineId: string): string {
  const value = lineId.trim().replace(/^@/, "");
  return `https://line.me/ti/p/~${encodeURIComponent(value)}`;
}

export function buildReceiptMessage(input: {
  shopName: string;
  customerName: string;
  billNumber: string;
  amount: string;
  paidAt?: Date | null;
}): string {
  return [
    `สวัสดีครับ ${input.customerName}`,
    `${input.shopName} ขอบคุณที่ใช้บริการ`,
    `เลขที่ใบเสร็จ ${input.billNumber}`,
    `ยอดชำระ ${input.amount}`,
    input.paidAt ? `ชำระเมื่อ ${formatThaiDateTime(input.paidAt)}` : null,
    "สามารถตรวจสอบประวัติการซื้อได้ที่ร้านครับ",
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

export function buildQuoteMessage(input: {
  shopName: string;
  customerName: string;
  quoteNumber: string;
  amount: string;
  validUntil: Date | string;
  note?: string | null;
}): string {
  return [
    `สวัสดีครับ ${input.customerName}`,
    `${input.shopName} ขอส่งใบเสนอราคา ${input.quoteNumber}`,
    `ยอดรวม ${input.amount}`,
    `ใช้ได้ถึง ${formatThaiDate(input.validUntil)}`,
    input.note?.trim() ? `หมายเหตุ: ${input.note.trim()}` : null,
    "กรุณาติดต่อร้านเพื่อยืนยันครับ",
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}
