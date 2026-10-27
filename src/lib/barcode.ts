export type BarcodeKind = "CODE128" | "EAN13";

export const CODE128_PATTERN = /^[\x20-\x7E]{1,64}$/;

export function normalizeBarcode(value: string): string {
  return value.trim();
}

export function isValidEan13(value: string): boolean {
  if (!/^\d{13}$/.test(value)) {
    return false;
  }

  const digits = value.split("").map(Number);
  const sum = digits
    .slice(0, 12)
    .reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 1 : 3), 0);
  const checkDigit = (10 - (sum % 10)) % 10;

  return checkDigit === digits[12];
}

export function isValidBarcode(value: string, type: BarcodeKind): boolean {
  const normalized = normalizeBarcode(value);

  if (type === "EAN13") {
    return isValidEan13(normalized);
  }

  return CODE128_PATTERN.test(normalized);
}

export function barcodeTypeLabel(type: BarcodeKind): string {
  return type === "EAN13" ? "EAN-13" : "Code 128";
}

/**
 * Normalizes serial numbers for comparison while keeping the original case in
 * stored values. Serial numbers are scannable identifiers, not user prose.
 */
export function normalizeSerialNumber(value: string): string {
  return value.trim();
}

export function splitSerialNumbers(value: string): string[] {
  return value
    .split(/[\n,]+/)
    .map(normalizeSerialNumber)
    .filter(Boolean);
}
