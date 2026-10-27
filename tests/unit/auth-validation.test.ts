import { describe, expect, it } from "vitest";

import { loginSchema, strongPasswordSchema } from "@/server/validators/auth";
import { createUserSchema } from "@/server/validators/users";

describe("authentication validation", () => {
  it("normalizes login email and accepts the password as entered", () => {
    const parsed = loginSchema.parse({
      email: "  ADMIN@Compos.Local ",
      password: "Password123!",
    });

    expect(parsed.email).toBe("admin@compos.local");
    expect(parsed.password).toBe("Password123!");
  });

  it("rejects malformed login input", () => {
    expect(
      loginSchema.safeParse({ email: "not-an-email", password: "" }).success,
    ).toBe(false);
  });
});

describe("strong password policy", () => {
  it("accepts a password with letters, digits, and at least 12 characters", () => {
    expect(strongPasswordSchema.safeParse("StrongPassword123!").success).toBe(
      true,
    );
  });

  it.each([
    ["too short", "Short123!"],
    ["no letter", "123456789012"],
    ["no digit", "OnlyLettersHere!"],
    ["more than 72 UTF-8 bytes", `${"ก".repeat(24)}A1`],
  ])("rejects %s", (_label, password) => {
    expect(strongPasswordSchema.safeParse(password).success).toBe(false);
  });
});

describe("user creation validation", () => {
  const validInput = {
    name: "Test Technician",
    email: " USER@Example.com ",
    phone: "",
    role: "TECHNICIAN",
    password: "StrongPassword123!",
    confirmPassword: "StrongPassword123!",
  };

  it("normalizes email and treats an empty phone as omitted", () => {
    const parsed = createUserSchema.parse(validInput);

    expect(parsed.email).toBe("user@example.com");
    expect(parsed.phone).toBeUndefined();
  });

  it("requires matching password confirmation", () => {
    const parsed = createUserSchema.safeParse({
      ...validInput,
      confirmPassword: "DifferentPassword123!",
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.path).toEqual(["confirmPassword"]);
    }
  });

  it("rejects invalid phone characters and unknown roles", () => {
    expect(
      createUserSchema.safeParse({ ...validInput, phone: "not-a-phone" }).success,
    ).toBe(false);
    expect(
      createUserSchema.safeParse({ ...validInput, role: "SUPERUSER" }).success,
    ).toBe(false);
  });
});
