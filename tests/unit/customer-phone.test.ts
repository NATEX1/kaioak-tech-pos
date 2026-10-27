import { describe, expect, it } from "vitest";

import {
  formatThaiPhone,
  isValidThaiPhone,
  normalizePhone,
  phoneSearchDigits,
} from "@/lib/phone";
import { customerCreateSchema } from "@/server/validators/customers";

describe("Thai customer phone helpers", () => {
  it("normalizes local and international phone formats", () => {
    expect(normalizePhone("081-234-5678")).toBe("0812345678");
    expect(normalizePhone("081 234 5678")).toBe("0812345678");
    expect(normalizePhone("+66 81 234 5678")).toBe("0812345678");
    expect(normalizePhone("66812345678")).toBe("0812345678");
    expect(normalizePhone("+66 2 123 4567")).toBe("021234567");
    expect(normalizePhone("02-123-4567")).toBe("021234567");
  });

  it("formats mobile and landline numbers for display", () => {
    expect(formatThaiPhone("0812345678")).toBe("081-234-5678");
    expect(formatThaiPhone("021234567")).toBe("02-123-4567");
    expect(formatThaiPhone("+66 81 234 5678")).toBe("081-234-5678");
    expect(formatThaiPhone("not-a-phone")).toBe("not-a-phone");
  });

  it("validates Thai phone lengths and supported characters", () => {
    expect(isValidThaiPhone("0812345678")).toBe(true);
    expect(isValidThaiPhone("021234567")).toBe(true);
    expect(isValidThaiPhone("+66812345678")).toBe(true);
    expect(isValidThaiPhone("08123456")).toBe(false);
    expect(isValidThaiPhone("08123456789")).toBe(false);
    expect(isValidThaiPhone("081-ABC-5678")).toBe(false);
    expect(phoneSearchDigits("+66 81 234 5678")).toBe("0812345678");
    expect(phoneSearchDigits("081-234")).toBe("081234");
  });

  it("validates and normalizes customer form input", () => {
    const result = customerCreateSchema.parse({
      name: "คุณทดสอบ ระบบ",
      phone: "+66 81 234 5678",
      email: "TEST@Example.Local",
      address: "1 ถนนทดสอบ",
      taxId: "0-1055-59999-99-9",
      note: "",
    });

    expect(result.phone).toBe("0812345678");
    expect(result.email).toBe("test@example.local");
    expect(result.taxId).toBe("0105559999999");
    expect(result.note).toBeUndefined();
  });

  it("rejects invalid phone, email and tax id values", () => {
    expect(
      customerCreateSchema.safeParse({
        name: "ลูกค้าทดสอบ",
        phone: "081-ABC-5678",
      }).success,
    ).toBe(false);
    expect(
      customerCreateSchema.safeParse({
        name: "ลูกค้าทดสอบ",
        phone: "0812345678",
        email: "not-an-email",
      }).success,
    ).toBe(false);
    expect(
      customerCreateSchema.safeParse({
        name: "ลูกค้าทดสอบ",
        phone: "0812345678",
        taxId: "1234",
      }).success,
    ).toBe(false);
  });
});
