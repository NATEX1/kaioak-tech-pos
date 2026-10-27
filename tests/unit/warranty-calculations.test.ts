import { describe, expect, it } from "vitest";
import {
  addMonthsToDate,
  calculateWarrantyPeriod,
} from "@/lib/warranty-calculations";

describe("warranty calculations", () => {
  it("adds months correctly with leap years and end-of-month boundaries", () => {
    // Jan 31 + 1 month -> Feb 28 or 29
    const jan31 = new Date("2024-01-31T00:00:00.000Z");
    const febInLeapYear = addMonthsToDate(jan31, 1);
    expect(febInLeapYear.getUTCMonth()).toBe(1); // February (0-indexed)
    expect(febInLeapYear.getUTCDate()).toBe(29);

    const jan31NonLeap = new Date("2025-01-31T00:00:00.000Z");
    const febNonLeap = addMonthsToDate(jan31NonLeap, 1);
    expect(febNonLeap.getUTCMonth()).toBe(1);
    expect(febNonLeap.getUTCDate()).toBe(28);

    // Standard 12 months addition
    const midYear = new Date("2025-06-15T10:00:00.000Z");
    const nextYear = addMonthsToDate(midYear, 12);
    expect(nextYear.toISOString()).toBe("2026-06-15T10:00:00.000Z");
  });

  it("handles 0 or negative warranty months", () => {
    const saleDate = new Date("2026-01-01T00:00:00.000Z");
    const result = calculateWarrantyPeriod(saleDate, 0);

    expect(result.status).toBe("NO_WARRANTY");
    expect(result.warrantyEndsAt).toBeNull();
    expect(result.isInWarranty).toBe(false);
    expect(result.isExpired).toBe(false);
    expect(result.daysRemaining).toBeNull();
  });

  it("calculates active warranty correctly", () => {
    const saleDate = new Date("2026-01-01T00:00:00.000Z");
    const asOfDate = new Date("2026-06-01T00:00:00.000Z"); // 5 months later
    const result = calculateWarrantyPeriod(saleDate, 12, asOfDate); // 12 months warranty

    expect(result.status).toBe("IN_WARRANTY");
    expect(result.isInWarranty).toBe(true);
    expect(result.isExpired).toBe(false);
    expect(result.warrantyEndsAt).toEqual(new Date("2027-01-01T00:00:00.000Z"));
    expect(result.daysRemaining).toBeGreaterThan(0);
    expect(result.daysExpired).toBeNull();
  });

  it("calculates expired warranty correctly", () => {
    const saleDate = new Date("2025-01-01T00:00:00.000Z");
    const asOfDate = new Date("2026-06-01T00:00:00.000Z"); // 17 months later
    const result = calculateWarrantyPeriod(saleDate, 12, asOfDate); // 12 months warranty -> expired

    expect(result.status).toBe("OUT_OF_WARRANTY");
    expect(result.isInWarranty).toBe(false);
    expect(result.isExpired).toBe(true);
    expect(result.warrantyEndsAt).toEqual(new Date("2026-01-01T00:00:00.000Z"));
    expect(result.daysRemaining).toBeNull();
    expect(result.daysExpired).toBeGreaterThan(0);
  });
});
