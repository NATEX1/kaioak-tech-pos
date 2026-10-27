import type {
  CommissionBasis,
  CommissionRuleType,
} from "@/generated/prisma/enums";
import { Decimal, roundMoney } from "@/lib/money";

export type CommissionRuleCandidate = {
  id: string;
  name: string;
  ruleType: CommissionRuleType;
  value: Decimal.Value;
  technicianId: string | null;
  billTypeId: string | null;
  categoryId: string | null;
  priority: number;
  effectiveFrom: Date | string;
  effectiveTo: Date | string | null;
  createdAt: Date | string;
};

export type CommissionBillContext = {
  technicianId: string;
  billTypeId: string;
  categoryIds: string[];
  evaluatedAt: Date;
};

export type CommissionCalculation = {
  basis: CommissionBasis;
  rateSnapshot: Decimal;
  baseAmount: Decimal;
  costAmount: Decimal;
  commissionAmount: Decimal;
};

function toTime(value: Date | string): number {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

export function commissionRuleSpecificity(
  rule: Pick<
    CommissionRuleCandidate,
    "technicianId" | "billTypeId" | "categoryId"
  >,
): number {
  return (
    (rule.technicianId ? 4 : 0) +
    (rule.billTypeId ? 2 : 0) +
    (rule.categoryId ? 1 : 0)
  );
}

/**
 * Picks exactly one rule for a bill. More specific scopes win before priority,
 * so a technician-specific rule beats a store-wide bill-type rule. The function
 * is pure so the selection policy can be tested without the database.
 */
export function selectCommissionRule<T extends CommissionRuleCandidate>(
  rules: T[],
  context: CommissionBillContext,
): T | null {
  const evaluatedAt = context.evaluatedAt.getTime();
  const categories = new Set(context.categoryIds);

  const eligible = rules.filter((rule) => {
    if (toTime(rule.effectiveFrom) > evaluatedAt) {
      return false;
    }

    if (rule.effectiveTo && toTime(rule.effectiveTo) < evaluatedAt) {
      return false;
    }

    if (rule.technicianId && rule.technicianId !== context.technicianId) {
      return false;
    }

    if (rule.billTypeId && rule.billTypeId !== context.billTypeId) {
      return false;
    }

    if (rule.categoryId && !categories.has(rule.categoryId)) {
      return false;
    }

    return true;
  });

  eligible.sort((a, b) => {
    const specificity =
      commissionRuleSpecificity(b) - commissionRuleSpecificity(a);

    if (specificity !== 0) {
      return specificity;
    }

    if (a.priority !== b.priority) {
      return b.priority - a.priority;
    }

    const effectiveFrom = toTime(b.effectiveFrom) - toTime(a.effectiveFrom);

    if (effectiveFrom !== 0) {
      return effectiveFrom;
    }

    const createdAt = toTime(b.createdAt) - toTime(a.createdAt);

    if (createdAt !== 0) {
      return createdAt;
    }

    return a.id.localeCompare(b.id);
  });

  return eligible[0] ?? null;
}

export class CommissionCalculationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommissionCalculationError";
  }
}

export function calculateCommission(input: {
  ruleType: CommissionRuleType;
  value: Decimal.Value;
  netRevenue: Decimal.Value;
  costAmount: Decimal.Value;
}): CommissionCalculation {
  const value = new Decimal(input.value);
  const netRevenue = Decimal.max(0, new Decimal(input.netRevenue));
  const costAmount = Decimal.max(0, new Decimal(input.costAmount));

  if (!value.isFinite() || value.isNegative()) {
    throw new CommissionCalculationError("อัตราค่าคอมมิชชั่นต้องไม่ติดลบ");
  }

  if (input.ruleType === "FIXED_PER_BILL") {
    return {
      basis: "FIXED",
      rateSnapshot: value.toDecimalPlaces(4),
      baseAmount: roundMoney(value),
      costAmount: new Decimal(0),
      commissionAmount: roundMoney(value),
    };
  }

  if (value.greaterThan(100)) {
    throw new CommissionCalculationError(
      "ค่าคอมมิชชั่นแบบเปอร์เซ็นต์ต้องไม่เกิน 100",
    );
  }

  if (input.ruleType === "PERCENT_REVENUE") {
    return {
      basis: "REVENUE",
      rateSnapshot: value.toDecimalPlaces(4),
      baseAmount: roundMoney(netRevenue),
      costAmount: roundMoney(costAmount),
      commissionAmount: roundMoney(netRevenue.mul(value).div(100)),
    };
  }

  if (input.ruleType === "PERCENT_PROFIT") {
    const profit = Decimal.max(0, netRevenue.minus(costAmount));

    return {
      basis: "PROFIT",
      rateSnapshot: value.toDecimalPlaces(4),
      baseAmount: roundMoney(netRevenue),
      costAmount: roundMoney(costAmount),
      commissionAmount: roundMoney(profit.mul(value).div(100)),
    };
  }

  throw new CommissionCalculationError("ไม่รู้จักประเภทค่าคอมมิชชั่น");
}
