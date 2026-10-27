import { describe, expect, it } from "vitest";

import { shopSettingsSchema } from "@/server/validators/settings";

const validSettings = {
  shopName: "KAIOAK TECH",
  address: "123 ถนนตัวอย่าง กรุงเทพมหานคร",
  phone: "021234567",
  email: "CONTACT@KAIOAK.LOCAL",
  taxId: "1234567890123",
  vatEnabled: true,
  vatRate: "7.00",
  vatIncluded: true,
  receiptFooter: "ขอบคุณที่ใช้บริการ",
  logoUrl: "/brand/kaioak-tech-mark.svg",
};

describe("shop settings validation", () => {
  it("normalizes optional fields and VAT rate", () => {
    const parsed = shopSettingsSchema.parse({
      ...validSettings,
      email: "  CONTACT@KAIOAK.LOCAL ",
      address: "  ",
      phone: "",
      taxId: "",
      receiptFooter: "  ",
      logoUrl: "  ",
    });

    expect(parsed.shopName).toBe(validSettings.shopName);
    expect(parsed.email).toBe("contact@kaioak.local");
    expect(parsed.address).toBeUndefined();
    expect(parsed.phone).toBeUndefined();
    expect(parsed.taxId).toBeUndefined();
    expect(parsed.receiptFooter).toBeUndefined();
    expect(parsed.logoUrl).toBeUndefined();
    expect(parsed.vatRate).toBe(7);
  });

  it("accepts a public-folder logo path and rejects non-local URLs", () => {
    expect(shopSettingsSchema.parse(validSettings).logoUrl).toBe(
      "/brand/kaioak-tech-mark.svg",
    );
    expect(
      shopSettingsSchema.safeParse({
        ...validSettings,
        logoUrl: "https://example.com/logo.png",
      }).success,
    ).toBe(false);
    expect(
      shopSettingsSchema.safeParse({
        ...validSettings,
        logoUrl: "/brand/logo with spaces.svg",
      }).success,
    ).toBe(false);
  });

  it("rejects invalid tax IDs, phone numbers, and VAT rates", () => {
    expect(
      shopSettingsSchema.safeParse({
        ...validSettings,
        taxId: "123",
      }).success,
    ).toBe(false);
    expect(
      shopSettingsSchema.safeParse({
        ...validSettings,
        phone: "call-me",
      }).success,
    ).toBe(false);
    expect(
      shopSettingsSchema.safeParse({
        ...validSettings,
        vatRate: "101",
      }).success,
    ).toBe(false);
    expect(
      shopSettingsSchema.safeParse({
        ...validSettings,
        vatRate: "7.123",
      }).success,
    ).toBe(false);
  });

  it("requires a shop name", () => {
    expect(
      shopSettingsSchema.safeParse({
        ...validSettings,
        shopName: "   ",
      }).success,
    ).toBe(false);
  });
});
