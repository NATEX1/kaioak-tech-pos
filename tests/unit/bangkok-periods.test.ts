import { describe, expect, it } from "vitest";

import {
  addDays,
  bangkokDayKey,
  recentBangkokDays,
  startOfBangkokDay,
  startOfBangkokMonth,
} from "@/lib/bangkok-periods";

describe("Bangkok date periods", () => {
  it("uses the Bangkok calendar day instead of the server UTC day", () => {
    const lateUtc = new Date("2026-10-22T18:30:00.000Z");

    expect(bangkokDayKey(lateUtc)).toBe("2026-10-23");
    expect(startOfBangkokDay(lateUtc).toISOString()).toBe(
      "2026-10-22T17:00:00.000Z",
    );
  });

  it("starts the month at Bangkok midnight on the first day", () => {
    const now = new Date("2026-10-22T18:30:00.000Z");

    expect(startOfBangkokMonth(now).toISOString()).toBe(
      "2026-09-30T17:00:00.000Z",
    );
  });

  it("builds a seven-day window ending today in Bangkok", () => {
    const days = recentBangkokDays(
      7,
      new Date("2026-10-22T18:30:00.000Z"),
    );

    expect(days).toHaveLength(7);
    expect(days[0]?.key).toBe("2026-10-17");
    expect(days[6]?.key).toBe("2026-10-23");
    expect(days[0]?.weekday).toBeTruthy();
    expect(days[0]?.label).toContain("17");
  });

  it("adds calendar days without crossing a timezone boundary", () => {
    const start = new Date("2026-10-22T17:00:00.000Z");
    expect(addDays(start, -1).toISOString()).toBe(
      "2026-10-21T17:00:00.000Z",
    );
  });
});
