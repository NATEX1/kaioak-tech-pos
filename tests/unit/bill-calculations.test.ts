import { describe, expect, it } from "vitest";

import {
  BillCalculationError,
  addMonths,
  calculateBillTotals,
  calculateDiscountAmount,
  calculateLineTotals,
} from "@/lib/bill-calculations";
import { billCreateSchema, billItemSchema } from "@/server/validators/bills";

describe("bill calculations", () => {
  it("calculates line totals with percent and amount discounts", () => {
    const percent = calculateLineTotals({
      quantity: 2,
      unitPrice: "1590.00",
      discountType: "PERCENT",
      discountValue: "10",
    });

    expect(percent.grossAmount.toFixed(2)).toBe("3180.00");
    expect(percent.discountAmount.toFixed(2)).toBe("318.00");
    expect(percent.lineTotal.toFixed(2)).toBe("2862.00");

    const amount = calculateLineTotals({
      quantity: 3,
      unitPrice: "99.99",
      discountType: "AMOUNT",
      discountValue: "29.97",
    });

    expect(amount.discountAmount.toFixed(2)).toBe("29.97");
    expect(amount.lineTotal.toFixed(2)).toBe("270.00");
  });

  it("rejects discounts that exceed their base amount", () => {
    expect(() =>
      calculateDiscountAmount("100.00", {
        type: "AMOUNT",
        value: "100.01",
      }),
    ).toThrow(BillCalculationError);

    expect(() =>
      calculateDiscountAmount("100.00", {
        type: "PERCENT",
        value: "100.01",
      }),
    ).toThrow(BillCalculationError);
  });

  it("calculates bill discounts with VAT disabled", () => {
    const totals = calculateBillTotals({
      lineTotals: [
        { lineTotal: "2862.00", discountAmount: "318.00" },
        { lineTotal: "25900.00", discountAmount: "0.00" },
      ],
      discountType: "AMOUNT",
      discountValue: "100.00",
      vatEnabled: false,
      vatIncluded: true,
      vatRate: "7",
    });

    expect(totals.subtotal.toFixed(2)).toBe("28762.00");
    expect(totals.lineDiscountTotal.toFixed(2)).toBe("318.00");
    expect(totals.discountAmount.toFixed(2)).toBe("100.00");
    expect(totals.netAmountBeforeVat.toFixed(2)).toBe("28662.00");
    expect(totals.vatAmount.toFixed(2)).toBe("0.00");
    expect(totals.grandTotal.toFixed(2)).toBe("28662.00");
  });

  it("calculates VAT-inclusive and VAT-exclusive totals", () => {
    const included = calculateBillTotals({
      lineTotals: [{ lineTotal: "1070.00", discountAmount: "0.00" }],
      discountValue: "0",
      vatEnabled: true,
      vatIncluded: true,
      vatRate: "7",
    });

    expect(included.netAmountBeforeVat.toFixed(2)).toBe("1000.00");
    expect(included.vatAmount.toFixed(2)).toBe("70.00");
    expect(included.grandTotal.toFixed(2)).toBe("1070.00");

    const excluded = calculateBillTotals({
      lineTotals: [{ lineTotal: "1000.00", discountAmount: "0.00" }],
      discountValue: "0",
      vatEnabled: true,
      vatIncluded: false,
      vatRate: "7",
    });

    expect(excluded.netAmountBeforeVat.toFixed(2)).toBe("1000.00");
    expect(excluded.vatAmount.toFixed(2)).toBe("70.00");
    expect(excluded.grandTotal.toFixed(2)).toBe("1070.00");
  });

  it("adds warranty months without overflowing shorter months", () => {
    const january31 = new Date("2026-01-31T12:00:00.000Z");
    const february28 = addMonths(january31, 1);
    const february28Leap = addMonths(new Date("2028-01-31T12:00:00.000Z"), 1);

    expect(february28.toISOString()).toBe("2026-02-28T12:00:00.000Z");
    expect(february28Leap.toISOString()).toBe("2028-02-29T12:00:00.000Z");
    expect(addMonths(new Date("2026-08-31T00:00:00.000Z"), 1).toISOString()).toBe(
      "2026-09-30T00:00:00.000Z",
    );
  });
});

describe("bill validators", () => {
  const baseItem = {
    kind: "PRODUCT",
    productId: "product-1",
    quantity: 2,
    unitPrice: "1590.00",
    discountType: "PERCENT",
    discountValue: "10",
    serialIds: [],
  };

  it("normalizes discount type and optional text", () => {
    const item = billItemSchema.parse(baseItem);
    expect(item.discountType).toBe("PERCENT");
    expect(item.description).toBeUndefined();

    const noDiscount = billItemSchema.parse({
      ...baseItem,
      discountType: "",
      discountValue: "0",
    });
    expect(noDiscount.discountType).toBeNull();
  });

  it("requires service descriptions and product ids by item kind", () => {
    expect(
      billItemSchema.safeParse({
        ...baseItem,
        kind: "PRODUCT",
        productId: "",
      }).success,
    ).toBe(false);

    expect(
      billItemSchema.safeParse({
        ...baseItem,
        kind: "SERVICE",
        productId: undefined,
        description: "A",
      }).success,
    ).toBe(false);

    expect(
      billItemSchema.safeParse({
        ...baseItem,
        kind: "SERVICE",
        productId: undefined,
        description: "ค่าตรวจเช็ค",
      }).success,
    ).toBe(true);
  });

  it("validates bill headers and discount ranges", () => {
    const parsed = billCreateSchema.safeParse({
      billTypeId: "type-1",
      customerId: "customer-1",
      title: "ทดสอบบิล",
      description: "",
      discountType: "PERCENT",
      discountValue: "5",
      items: [baseItem],
    });

    expect(parsed.success).toBe(true);

    expect(
      billCreateSchema.safeParse({
        billTypeId: "type-1",
        customerId: "customer-1",
        title: "X",
        discountType: "",
        discountValue: "0",
        items: [baseItem],
      }).success,
    ).toBe(false);
  });
});
