import { Decimal, roundMoney } from "@/lib/money";

export type BillDiscountType = "PERCENT" | "AMOUNT" | null;

export type DiscountInput = {
  type?: BillDiscountType;
  value: Decimal.Value;
};

export type LineCalculationInput = {
  quantity: number;
  unitPrice: Decimal.Value;
  discountType?: BillDiscountType;
  discountValue: Decimal.Value;
};

export type LineCalculation = {
  grossAmount: Decimal;
  discountAmount: Decimal;
  lineTotal: Decimal;
};

export type BillTotalsInput = {
  lineTotals: Array<{ lineTotal: Decimal.Value; discountAmount: Decimal.Value }>;
  discountType?: BillDiscountType;
  discountValue: Decimal.Value;
  vatEnabled: boolean;
  vatIncluded: boolean;
  vatRate: Decimal.Value;
};

export type BillTotals = {
  subtotal: Decimal;
  lineDiscountTotal: Decimal;
  discountAmount: Decimal;
  netAmountBeforeVat: Decimal;
  vatAmount: Decimal;
  grandTotal: Decimal;
  vatRate: Decimal;
};

export class BillCalculationError extends Error {
  constructor(
    public readonly code:
      | "INVALID_DISCOUNT"
      | "DISCOUNT_EXCEEDS_BASE"
      | "INVALID_AMOUNT",
    message: string,
  ) {
    super(message);
    this.name = "BillCalculationError";
  }
}

export function calculateDiscountAmount(
  baseAmount: Decimal.Value,
  discount: DiscountInput,
): Decimal {
  const base = roundMoney(baseAmount);
  const value = new Decimal(discount.value || 0);

  if (value.isNegative()) {
    throw new BillCalculationError(
      "INVALID_DISCOUNT",
      "ส่วนลดต้องไม่ติดลบ",
    );
  }

  if (!discount.type) {
    return new Decimal(0);
  }

  if (discount.type === "PERCENT") {
    if (value.greaterThan(100)) {
      throw new BillCalculationError(
        "INVALID_DISCOUNT",
        "ส่วนลดเปอร์เซ็นต์ต้องไม่เกิน 100",
      );
    }

    return roundMoney(base.times(value).dividedBy(100));
  }

  const amount = roundMoney(value);

  if (amount.greaterThan(base)) {
    throw new BillCalculationError(
      "DISCOUNT_EXCEEDS_BASE",
      "ส่วนลดต้องไม่เกินยอดก่อนส่วนลด",
    );
  }

  return amount;
}

export function calculateLineTotals(
  input: LineCalculationInput,
): LineCalculation {
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    throw new BillCalculationError(
      "INVALID_AMOUNT",
      "จำนวนสินค้าต้องเป็นจำนวนเต็มมากกว่า 0",
    );
  }

  const unitPrice = roundMoney(input.unitPrice);

  if (unitPrice.isNegative()) {
    throw new BillCalculationError(
      "INVALID_AMOUNT",
      "ราคาต่อหน่วยต้องไม่ติดลบ",
    );
  }

  const grossAmount = roundMoney(unitPrice.times(input.quantity));
  const discountAmount = calculateDiscountAmount(grossAmount, {
    type: input.discountType,
    value: input.discountValue,
  });

  return {
    grossAmount,
    discountAmount,
    lineTotal: roundMoney(grossAmount.minus(discountAmount)),
  };
}

export function calculateBillTotals(input: BillTotalsInput): BillTotals {
  const subtotal = input.lineTotals.reduce(
    (sum, line) => sum.plus(roundMoney(line.lineTotal)),
    new Decimal(0),
  );
  const lineDiscountTotal = input.lineTotals.reduce(
    (sum, line) => sum.plus(roundMoney(line.discountAmount)),
    new Decimal(0),
  );
  const discountAmount = calculateDiscountAmount(subtotal, {
    type: input.discountType,
    value: input.discountValue,
  });
  const afterDiscount = roundMoney(subtotal.minus(discountAmount));
  const vatRate = new Decimal(input.vatRate || 0);

  if (vatRate.isNegative() || vatRate.greaterThan(100)) {
    throw new BillCalculationError(
      "INVALID_AMOUNT",
      "อัตรา VAT ต้องอยู่ระหว่าง 0–100",
    );
  }

  if (!input.vatEnabled) {
    return {
      subtotal: roundMoney(subtotal),
      lineDiscountTotal: roundMoney(lineDiscountTotal),
      discountAmount,
      netAmountBeforeVat: afterDiscount,
      vatAmount: new Decimal(0),
      grandTotal: afterDiscount,
      vatRate,
    };
  }

  if (input.vatIncluded) {
    const netAmountBeforeVat = roundMoney(
      afterDiscount.dividedBy(vatRate.dividedBy(100).plus(1)),
    );
    return {
      subtotal: roundMoney(subtotal),
      lineDiscountTotal: roundMoney(lineDiscountTotal),
      discountAmount,
      netAmountBeforeVat,
      vatAmount: roundMoney(afterDiscount.minus(netAmountBeforeVat)),
      grandTotal: afterDiscount,
      vatRate,
    };
  }

  const vatAmount = roundMoney(afterDiscount.times(vatRate).dividedBy(100));

  return {
    subtotal: roundMoney(subtotal),
    lineDiscountTotal: roundMoney(lineDiscountTotal),
    discountAmount,
    netAmountBeforeVat: afterDiscount,
    vatAmount,
    grandTotal: roundMoney(afterDiscount.plus(vatAmount)),
    vatRate,
  };
}

export function addMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  const originalDay = result.getUTCDate();

  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);

  const lastDayOfTargetMonth = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();

  result.setUTCDate(Math.min(originalDay, lastDayOfTargetMonth));
  return result;
}
