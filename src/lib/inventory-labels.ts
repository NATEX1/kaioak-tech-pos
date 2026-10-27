import type {
  BarcodeType,
  SerialStatus,
  StockMovementType,
} from "@/generated/prisma/enums";

import { barcodeTypeLabel } from "@/lib/barcode";

export function stockMovementTypeLabel(type: StockMovementType): string {
  switch (type) {
    case "GOODS_RECEIPT":
      return "รับสินค้าเข้า";
    case "SALE":
      return "ขายออก";
    case "ADJUSTMENT":
      return "ปรับยอด";
    case "VOID_RESTOCK":
      return "คืนสต๊อกจากการยกเลิกบิล";
    case "CLAIM":
      return "เคลมสินค้า";
    case "RETURN":
      return "รับคืน";
    default:
      return type;
  }
}

export function serialStatusLabel(status: SerialStatus): string {
  switch (status) {
    case "IN_STOCK":
      return "พร้อมขาย";
    case "SOLD":
      return "ขายแล้ว";
    case "CLAIMED":
      return "อยู่ในเคลม";
    case "DISPOSED":
      return "ตัดจำหน่าย";
    default:
      return status;
  }
}

export function productBarcodeTypeLabel(type: BarcodeType): string {
  return barcodeTypeLabel(type);
}

export function inventoryStockLabel(stockQty: number): string {
  return `${stockQty.toLocaleString("th-TH")} ชิ้น`;
}

export function inventoryDateInputValue(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function parseBangkokDateInput(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00+07:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function currentBuddhistYear(date = new Date()): number {
  const year = Number(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
    }).format(date),
  );

  return year + 543;
}
