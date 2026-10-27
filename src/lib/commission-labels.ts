import type {
  CommissionBasis,
  CommissionEntryKind,
  CommissionEntryStatus,
  CommissionPayoutStatus,
  CommissionRuleType,
} from "@/generated/prisma/enums";
import { formatTHB } from "@/lib/money";

export function commissionRuleTypeLabel(type: CommissionRuleType): string {
  switch (type) {
    case "PERCENT_REVENUE":
      return "เปอร์เซ็นต์จากยอดขาย";
    case "PERCENT_PROFIT":
      return "เปอร์เซ็นต์จากกำไร";
    case "FIXED_PER_BILL":
      return "จำนวนคงที่ต่อบิล";
    default:
      return type;
  }
}

export function commissionBasisLabel(basis: CommissionBasis): string {
  switch (basis) {
    case "REVENUE":
      return "ยอดขายก่อน VAT";
    case "PROFIT":
      return "กำไรหลังต้นทุน";
    case "FIXED":
      return "จำนวนคงที่";
    default:
      return basis;
  }
}

export function commissionEntryKindLabel(kind: CommissionEntryKind): string {
  return kind === "EARNING" ? "ค่าคอมมิชชั่น" : "กลับรายการ";
}

export function commissionEntryStatusLabel(
  status: CommissionEntryStatus,
): string {
  switch (status) {
    case "PENDING":
      return "รอจ่าย";
    case "PAID":
      return "จ่ายแล้ว";
    case "REVERSED":
      return "ถูกกลับรายการ";
    default:
      return status;
  }
}

export function commissionEntryStatusClass(
  status: CommissionEntryStatus,
): string {
  switch (status) {
    case "PENDING":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "PAID":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "REVERSED":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "";
  }
}

export function commissionPayoutStatusLabel(
  status: CommissionPayoutStatus,
): string {
  return status === "PAID" ? "จ่ายแล้ว" : "รอจ่าย";
}

export function commissionRateLabel(
  ruleType: CommissionRuleType,
  value: string,
): string {
  if (ruleType === "FIXED_PER_BILL") {
    return formatTHB(value);
  }

  const number = Number(value);
  const formatted = Number.isFinite(number)
    ? number.toLocaleString("th-TH", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 4,
      })
    : value;

  return `${formatted}%`;
}

export function commissionDateInputValue(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function firstDayOfCurrentMonthInputValue(date = new Date()): string {
  const value = commissionDateInputValue(date);
  return `${value.slice(0, 7)}-01`;
}

export function parseBangkokCommissionDate(
  value: string,
  endOfDay = false,
): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(
    `${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}+07:00`,
  );

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
