const PHONE_CHARACTERS = /^\+?[0-9()\-. ]+$/;

/**
 * Normalizes Thai phone input to the local digit form used by the database.
 * +66 81 234 5678 and 081-234-5678 both become 0812345678.
 */
export function normalizePhone(value: string): string {
  let digits = value.trim().replace(/\D/g, "");

  if (
    digits.startsWith("66") &&
    (digits.length === 10 || digits.length === 11)
  ) {
    digits = `0${digits.slice(2)}`;
  }

  return digits;
}

export function hasSupportedPhoneCharacters(value: string): boolean {
  return PHONE_CHARACTERS.test(value.trim());
}

export function isValidThaiPhone(value: string): boolean {
  return /^0\d{8,9}$/.test(normalizePhone(value));
}

export function formatThaiPhone(value: string): string {
  const digits = normalizePhone(value);

  if (/^0\d{9}$/.test(digits)) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  if (/^0\d{8}$/.test(digits)) {
    return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
  }

  return value;
}

/**
 * Converts a typed search term into digits suitable for a partial phone match.
 * Full international input (+66) is converted back to the local 0 prefix.
 */
export function phoneSearchDigits(value: string): string {
  const digits = value.replace(/\D/g, "");

  if (digits.startsWith("66") && digits.length >= 9) {
    return `0${digits.slice(2)}`;
  }

  return digits;
}
