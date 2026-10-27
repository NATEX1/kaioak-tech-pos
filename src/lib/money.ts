import Decimal from "decimal.js";

// All monetary calculations must use this class, never JavaScript floats.
Decimal.set({
  precision: 28,
  rounding: Decimal.ROUND_HALF_UP,
});

export { Decimal };

export const ZERO = new Decimal(0);

export function decimal(value: Decimal.Value): Decimal {
  return new Decimal(value);
}

export function roundMoney(value: Decimal.Value): Decimal {
  return new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export function formatTHB(value: Decimal.Value): string {
  const formatted = new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(roundMoney(value).toNumber());

  return formatted.replace("THB", "฿").trim();
}

export function toMoneyString(value: Decimal.Value): string {
  return roundMoney(value).toFixed(2);
}
