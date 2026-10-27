import { describe, expect, it } from "vitest";

import {
  calculateLineTotal,
  calculateWeightedAverageCost,
  formatSku,
  isLowStock,
  suggestedReorderQuantity,
} from "@/lib/inventory-calculations";

describe("inventory calculations", () => {
  it("calculates weighted average cost using Decimal arithmetic", () => {
    const average = calculateWeightedAverageCost(10, "100.00", 10, "200.00");
    expect(average.toFixed(2)).toBe("150.00");
  });

  it("rounds the weighted average to two decimal places", () => {
    const average = calculateWeightedAverageCost(3, "0.01", 1, "0.02");
    expect(average.toFixed(2)).toBe("0.01");
  });

  it("uses the incoming cost when previous stock is zero", () => {
    const average = calculateWeightedAverageCost(0, "999.00", 2, "125.50");
    expect(average.toFixed(2)).toBe("125.50");
  });

  it("calculates exact line totals", () => {
    expect(calculateLineTotal(3, "0.10").toFixed(2)).toBe("0.30");
    expect(calculateLineTotal(7, "19.99").toFixed(2)).toBe("139.93");
  });

  it("detects low stock at the reorder boundary", () => {
    expect(isLowStock(0, 0)).toBe(true);
    expect(isLowStock(5, 5)).toBe(true);
    expect(isLowStock(6, 5)).toBe(false);
  });

  it("suggests a restock quantity", () => {
    expect(suggestedReorderQuantity(2, 5)).toBe(8);
    expect(suggestedReorderQuantity(10, 5)).toBe(0);
  });

  it("formats auto-generated SKUs in the documented shape", () => {
    expect(formatSku("cpu", 1)).toBe("CPU-0001");
    expect(formatSku("SSD", 42)).toBe("SSD-0042");
  });
});
