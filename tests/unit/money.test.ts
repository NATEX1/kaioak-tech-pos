import { describe, expect, it } from "vitest";

import { Decimal, formatTHB, roundMoney, toMoneyString } from "@/lib/money";

describe("money utilities", () => {
  it("adds decimal values without binary floating point drift", () => {
    expect(new Decimal("0.1").plus("0.2").equals("0.3")).toBe(true);
    expect(new Decimal("0.1").plus("0.2").toString()).toBe("0.3");
  });

  it("rounds money half-up to two decimal places", () => {
    expect(toMoneyString(roundMoney("10.005"))).toBe("10.01");
    expect(toMoneyString(roundMoney("10.004"))).toBe("10.00");
  });

  it("formats Thai baht with two decimal places", () => {
    const formatted = formatTHB("1234.5");

    expect(formatted).toContain("1,234.50");
    expect(formatted).toContain("฿");
  });
});
