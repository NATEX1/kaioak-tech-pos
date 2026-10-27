import { describe, expect, it } from "vitest";

import {
  hashPassword,
  performDummyPasswordCheck,
  verifyPassword,
} from "@/server/auth/password";

describe("password hashing", () => {
  it("hashes and verifies a password without storing plaintext", async () => {
    const password = "TestPassword123!";
    const passwordHash = await hashPassword(password);

    expect(passwordHash).not.toBe(password);
    expect(passwordHash.startsWith("$2")).toBe(true);
    await expect(verifyPassword(password, passwordHash)).resolves.toBe(true);
    await expect(
      verifyPassword("WrongPassword123!", passwordHash),
    ).resolves.toBe(false);
  });

  it("completes the dummy check for unknown users", async () => {
    await expect(
      performDummyPasswordCheck("TestPassword123!"),
    ).resolves.toBeUndefined();
  });
});
