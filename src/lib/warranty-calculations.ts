export type WarrantyStatus =
  | "IN_WARRANTY"
  | "OUT_OF_WARRANTY"
  | "NO_WARRANTY"
  | "IN_STOCK";

export type WarrantyCalculationResult = {
  warrantyMonths: number;
  warrantyStartAt: Date | null;
  warrantyEndsAt: Date | null;
  isExpired: boolean;
  isInWarranty: boolean;
  daysRemaining: number | null;
  daysExpired: number | null;
  status: WarrantyStatus;
};

/**
 * Adds months to a date safely.
 */
export function addMonthsToDate(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  const expectedMonth = (result.getMonth() + months) % 12;
  result.setMonth(result.getMonth() + months);

  // Handle month overflow (e.g. Jan 31 + 1 month -> Feb 28/29 instead of Mar 2/3)
  if (result.getMonth() !== ((expectedMonth + 12) % 12)) {
    result.setDate(0);
  }

  return result;
}

/**
 * Calculates warranty period, expiration status, and days remaining or expired.
 */
export function calculateWarrantyPeriod(
  saleOrStartDate: Date | null | undefined,
  warrantyMonths: number,
  asOfDate: Date = new Date(),
): WarrantyCalculationResult {
  if (!saleOrStartDate || warrantyMonths <= 0) {
    return {
      warrantyMonths: Math.max(0, warrantyMonths),
      warrantyStartAt: saleOrStartDate ?? null,
      warrantyEndsAt: null,
      isExpired: false,
      isInWarranty: false,
      daysRemaining: null,
      daysExpired: null,
      status: "NO_WARRANTY",
    };
  }

  const startAt = new Date(saleOrStartDate.getTime());
  const endsAt = addMonthsToDate(startAt, warrantyMonths);
  const now = asOfDate.getTime();
  const endMs = endsAt.getTime();
  const diffMs = endMs - now;
  const oneDayMs = 1000 * 60 * 60 * 24;

  const isInWarranty = endMs >= now;
  const isExpired = !isInWarranty;

  const daysRemaining = isInWarranty ? Math.max(0, Math.ceil(diffMs / oneDayMs)) : null;
  const daysExpired = isExpired ? Math.max(1, Math.floor(Math.abs(diffMs) / oneDayMs)) : null;

  return {
    warrantyMonths,
    warrantyStartAt: startAt,
    warrantyEndsAt: endsAt,
    isExpired,
    isInWarranty,
    daysRemaining,
    daysExpired,
    status: isInWarranty ? "IN_WARRANTY" : "OUT_OF_WARRANTY",
  };
}
