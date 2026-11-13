import { describe, expect, it } from "vitest";

import {
  buildPromptPayPayload,
  normalizePromptPayTarget,
  PromptPayError,
} from "@/lib/promptpay";

describe("PromptPay payload", () => {
  it("builds a mobile payload with amount", () => {
    expect(
      buildPromptPayPayload({
        promptpayId: "081-234-5678",
        amount: "100.00",
      }),
    ).toBe(
      "00020101021229370016A0000006770101110113006681234567853037645406100.005802TH6304F142",
    );
  });

  it("builds a national ID payload", () => {
    expect(
      buildPromptPayPayload({
        promptpayId: "1 2345 67890 12 3",
        amount: "50",
      }),
    ).toBe(
      "00020101021229370016A000000677010111021312345678901235303764540550.005802TH630475F3",
    );
  });

  it("builds a static payload without amount", () => {
    const payload = buildPromptPayPayload({ promptpayId: "0812345678" });
    expect(payload).toContain("010211");
    expect(payload).not.toContain("5406");
    expect(payload).toMatch(/^000201/);
    expect(payload.slice(-8, -4)).toBe("6304");
  });

  it("normalizes +66 numbers", () => {
    expect(normalizePromptPayTarget("+66 81 234 5678")).toEqual({
      kind: "MOBILE",
      value: "0066812345678",
    });
  });

  it("rejects invalid targets", () => {
    expect(() => normalizePromptPayTarget("123")).toThrow(PromptPayError);
  });
});
