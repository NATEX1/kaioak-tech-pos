const DATE_INPUT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const BANGKOK_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Bangkok",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Parses a date input (YYYY-MM-DD) as a Bangkok calendar day.
 * Returns null for invalid or impossible dates instead of passing an Invalid Date
 * to Prisma, which would otherwise produce a 500 response.
 */
export function parseAuditDateInput(
  value: string | undefined,
  boundary: "start" | "end",
): Date | null {
  if (!value) return null;

  const match = DATE_INPUT_PATTERN.exec(value);
  if (!match) return null;

  const [, year, month, day] = match;
  const numericYear = Number(year);
  const numericMonth = Number(month);
  const numericDay = Number(day);

  if (
    numericYear < 1900 ||
    numericYear > 3000 ||
    numericMonth < 1 ||
    numericMonth > 12 ||
    numericDay < 1 ||
    numericDay > 31
  ) {
    return null;
  }

  const suffix =
    boundary === "start" ? "T00:00:00.000+07:00" : "T23:59:59.999+07:00";
  const date = new Date(`${value}${suffix}`);

  if (Number.isNaN(date.getTime())) return null;

  const parts = BANGKOK_DATE_FORMATTER.formatToParts(date);
  const byType = new Map(parts.map((part) => [part.type, part.value]));
  const normalized = `${byType.get("year")}-${byType.get("month")}-${byType.get("day")}`;

  return normalized === value ? date : null;
}

export function isInvalidAuditDateRange(
  from: string | undefined,
  to: string | undefined,
): boolean {
  const fromDate = parseAuditDateInput(from, "start");
  const toDate = parseAuditDateInput(to, "end");

  if (from && !fromDate) return true;
  if (to && !toDate) return true;
  if (fromDate && toDate && fromDate.getTime() > toDate.getTime()) return true;

  return false;
}
