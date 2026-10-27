const BANGKOK_TIME_ZONE = "Asia/Bangkok";
const BANGKOK_OFFSET = "+07:00";

const datePartsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: BANGKOK_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const weekdayFormatter = new Intl.DateTimeFormat("th-TH", {
  timeZone: BANGKOK_TIME_ZONE,
  weekday: "short",
});

const shortDayFormatter = new Intl.DateTimeFormat("th-TH", {
  timeZone: BANGKOK_TIME_ZONE,
  day: "numeric",
  month: "short",
});

export type BangkokDay = {
  key: string;
  date: Date;
  weekday: string;
  label: string;
};

function dateParts(value: Date): { year: string; month: string; day: string } {
  const parts = datePartsFormatter.formatToParts(value);
  const byType = new Map(parts.map((part) => [part.type, part.value]));

  return {
    year: byType.get("year") ?? "1970",
    month: byType.get("month") ?? "01",
    day: byType.get("day") ?? "01",
  };
}

export function bangkokDayKey(value: Date = new Date()): string {
  const parts = dateParts(value);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function startOfBangkokDay(value: Date = new Date()): Date {
  return new Date(`${bangkokDayKey(value)}T00:00:00${BANGKOK_OFFSET}`);
}

export function startOfBangkokMonth(value: Date = new Date()): Date {
  const key = bangkokDayKey(value);
  return new Date(`${key.slice(0, 7)}-01T00:00:00${BANGKOK_OFFSET}`);
}

export function addDays(value: Date, days: number): Date {
  return new Date(value.getTime() + days * 24 * 60 * 60 * 1000);
}

export function recentBangkokDays(
  count: number,
  now: Date = new Date(),
): BangkokDay[] {
  const safeCount = Math.max(1, Math.trunc(count));
  const today = startOfBangkokDay(now);

  return Array.from({ length: safeCount }, (_, index) => {
    const date = addDays(today, index - (safeCount - 1));

    return {
      key: bangkokDayKey(date),
      date,
      weekday: weekdayFormatter.format(date),
      label: shortDayFormatter.format(date),
    };
  });
}
