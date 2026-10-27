import { describe, expect, it } from "vitest";

import {
  calculateCommission,
  commissionRuleSpecificity,
  selectCommissionRule,
  type CommissionRuleCandidate,
} from "@/lib/commission-calculations";
import {
  commissionPayoutSchema,
  commissionRuleSchema,
} from "@/server/validators/commissions";

const baseRule: CommissionRuleCandidate = {
  id: "rule-base",
  name: "Base rule",
  ruleType: "PERCENT_REVENUE",
  value: "2.0000",
  technicianId: null,
  billTypeId: null,
  categoryId: null,
  priority: 0,
  effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
  effectiveTo: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
};

const context = {
  technicianId: "tech-1",
  billTypeId: "bill-type-1",
  categoryIds: ["category-1"],
  evaluatedAt: new Date("2026-06-15T00:00:00.000Z"),
};

describe("commission calculations", () => {
  it("calculates a percentage of net revenue", () => {
    const result = calculateCommission({
      ruleType: "PERCENT_REVENUE",
      value: "2.5",
      netRevenue: "1000.00",
      costAmount: "450.00",
    });

    expect(result.basis).toBe("REVENUE");
    expect(result.rateSnapshot.toFixed(4)).toBe("2.5000");
    expect(result.baseAmount.toFixed(2)).toBe("1000.00");
    expect(result.costAmount.toFixed(2)).toBe("450.00");
    expect(result.commissionAmount.toFixed(2)).toBe("25.00");
  });

  it("calculates a percentage of profit after snapshot cost", () => {
    const result = calculateCommission({
      ruleType: "PERCENT_PROFIT",
      value: "10",
      netRevenue: "1000.00",
      costAmount: "450.00",
    });

    expect(result.basis).toBe("PROFIT");
    expect(result.baseAmount.toFixed(2)).toBe("1000.00");
    expect(result.costAmount.toFixed(2)).toBe("450.00");
    expect(result.commissionAmount.toFixed(2)).toBe("55.00");
  });

  it("never creates a negative earning when cost exceeds revenue", () => {
    const result = calculateCommission({
      ruleType: "PERCENT_PROFIT",
      value: "10",
      netRevenue: "100.00",
      costAmount: "150.00",
    });

    expect(result.commissionAmount.toFixed(2)).toBe("0.00");
  });

  it("supports a fixed amount per bill", () => {
    const result = calculateCommission({
      ruleType: "FIXED_PER_BILL",
      value: "150.50",
      netRevenue: "1000.00",
      costAmount: "450.00",
    });

    expect(result.basis).toBe("FIXED");
    expect(result.baseAmount.toFixed(2)).toBe("150.50");
    expect(result.costAmount.toFixed(2)).toBe("0.00");
    expect(result.commissionAmount.toFixed(2)).toBe("150.50");
  });

  it("rounds commission to two decimal places", () => {
    const result = calculateCommission({
      ruleType: "PERCENT_REVENUE",
      value: "2.5",
      netRevenue: "100.05",
      costAmount: "0",
    });

    expect(result.commissionAmount.toFixed(2)).toBe("2.50");
  });

  it("rejects percentages over 100", () => {
    expect(() =>
      calculateCommission({
        ruleType: "PERCENT_REVENUE",
        value: "101",
        netRevenue: "100",
        costAmount: "0",
      }),
    ).toThrow("ไม่เกิน 100");
  });
});

describe("commission rule selection", () => {
  it("prefers a technician-specific rule over broader scopes", () => {
    const selected = selectCommissionRule(
      [
        { ...baseRule, id: "global", priority: 100 },
        {
          ...baseRule,
          id: "bill-type",
          billTypeId: "bill-type-1",
          priority: 50,
        },
        {
          ...baseRule,
          id: "technician",
          technicianId: "tech-1",
          priority: 0,
        },
      ],
      context,
    );

    expect(selected?.id).toBe("technician");
  });

  it("uses priority when specificity is equal", () => {
    const selected = selectCommissionRule(
      [
        { ...baseRule, id: "low", priority: 1 },
        { ...baseRule, id: "high", priority: 9 },
      ],
      context,
    );

    expect(selected?.id).toBe("high");
  });

  it("requires a matching category for category rules", () => {
    const selected = selectCommissionRule(
      [
        {
          ...baseRule,
          id: "other-category",
          categoryId: "category-2",
          priority: 100,
        },
        {
          ...baseRule,
          id: "matching-category",
          categoryId: "category-1",
        },
      ],
      context,
    );

    expect(selected?.id).toBe("matching-category");
  });

  it("respects effective dates and returns null without a match", () => {
    const selected = selectCommissionRule(
      [
        {
          ...baseRule,
          id: "expired",
          effectiveTo: new Date("2026-06-14T23:59:59.999Z"),
        },
        {
          ...baseRule,
          id: "future",
          effectiveFrom: new Date("2026-06-16T00:00:00.000Z"),
        },
      ],
      context,
    );

    expect(selected).toBeNull();
  });

  it("uses the newest effective date as a deterministic tie-breaker", () => {
    const selected = selectCommissionRule(
      [
        {
          ...baseRule,
          id: "old",
          effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
        },
        {
          ...baseRule,
          id: "new",
          effectiveFrom: new Date("2026-05-01T00:00:00.000Z"),
        },
      ],
      context,
    );

    expect(selected?.id).toBe("new");
  });

  it("scores scope specificity deterministically", () => {
    expect(
      commissionRuleSpecificity({
        technicianId: "tech",
        billTypeId: "bill",
        categoryId: "category",
      }),
    ).toBe(7);
    expect(
      commissionRuleSpecificity({
        technicianId: null,
        billTypeId: null,
        categoryId: null,
      }),
    ).toBe(0);
  });
});

describe("commission validators", () => {
  it("accepts a fixed rule and normalizes its value", () => {
    const parsed = commissionRuleSchema.parse({
      name: "Fixed bonus",
      description: "",
      ruleType: "FIXED_PER_BILL",
      value: "150.50",
      technicianId: "",
      billTypeId: "",
      categoryId: "",
      priority: "5",
      effectiveFrom: "2026-06-01",
      effectiveTo: "",
      isActive: true,
    });

    expect(parsed.value).toBe("150.5000");
    expect(parsed.technicianId).toBeUndefined();
    expect(parsed.priority).toBe(5);
    expect(parsed.effectiveFrom.toISOString()).toBe("2026-05-31T17:00:00.000Z");
    expect(parsed.effectiveTo).toBeUndefined();
  });

  it("rejects percentages over 100 and inverted effective dates", () => {
    const percentage = commissionRuleSchema.safeParse({
      name: "Too much",
      ruleType: "PERCENT_REVENUE",
      value: "101",
      priority: "0",
      effectiveFrom: "2026-06-01",
      effectiveTo: "",
      isActive: true,
    });
    const inverted = commissionRuleSchema.safeParse({
      name: "Inverted dates",
      ruleType: "PERCENT_REVENUE",
      value: "2",
      priority: "0",
      effectiveFrom: "2026-06-10",
      effectiveTo: "2026-06-01",
      isActive: true,
    });

    expect(percentage.success).toBe(false);
    expect(inverted.success).toBe(false);
  });

  it("rejects a payout period that ends before it starts", () => {
    const parsed = commissionPayoutSchema.safeParse({
      technicianId: "tech-1",
      periodStart: "2026-06-10",
      periodEnd: "2026-06-01",
      note: "",
    });

    expect(parsed.success).toBe(false);
  });
});
