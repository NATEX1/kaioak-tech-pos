import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Role } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/server/auth/password";
import {
  changeOwnPassword,
  createUser,
  resetUserPassword,
  setUserActive,
  updateUser,
} from "@/server/services/users";

const testEmail = `vitest-user-${randomUUID()}@example.invalid`;
const initialPassword = "InitialPassword123!";
const resetPassword = "ResetPassword123!";
const changedPassword = "ChangedPassword123!";

let admin: { id: string; role: Role };
let userId: string | null = null;

beforeAll(async () => {
  const seededAdmin = await prisma.user.findFirst({
    where: { role: "ADMIN", isActive: true },
    select: { id: true, role: true },
  });

  if (!seededAdmin) {
    throw new Error("Integration tests require at least one active admin.");
  }

  admin = seededAdmin;
});

afterAll(async () => {
  const user = await prisma.user.findUnique({
    where: { email: testEmail },
    select: { id: true },
  });
  const ids = [userId, user?.id].filter((id): id is string => Boolean(id));

  if (ids.length > 0) {
    await prisma.auditLog.deleteMany({
      where: {
        OR: [{ actorId: { in: ids } }, { entityId: { in: ids } }],
      },
    });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
});

describe("user management service", () => {
  it("creates a user with an audit log", async () => {
    const user = await createUser(admin, {
      name: "Vitest Technician",
      email: testEmail,
      phone: "0800000099",
      role: "TECHNICIAN",
      password: initialPassword,
    });

    userId = user.id;

    expect(user.email).toBe(testEmail);
    expect(user.role).toBe("TECHNICIAN");
    expect(user.isActive).toBe(true);

    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { passwordHash: true, createdById: true, tokenVersion: true },
    });

    expect(stored.createdById).toBe(admin.id);
    expect(stored.tokenVersion).toBe(0);
    await expect(
      verifyPassword(initialPassword, stored.passwordHash),
    ).resolves.toBe(true);

    const audit = await prisma.auditLog.findFirst({
      where: { entityId: user.id, action: "USER_CREATED" },
    });
    expect(audit).not.toBeNull();
    expect(audit?.actorId).toBe(admin.id);
  });

  it("rejects a duplicate email", async () => {
    await expect(
      createUser(admin, {
        name: "Duplicate User",
        email: testEmail,
        role: "TECHNICIAN",
        password: initialPassword,
      }),
    ).rejects.toMatchObject({
      code: "EMAIL_ALREADY_EXISTS",
    });
  });

  it("changes a role and invalidates existing sessions", async () => {
    expect(userId).toBeTruthy();

    const updated = await updateUser(admin, {
      userId: userId!,
      name: "Vitest Admin",
      phone: "0800000098",
      role: "ADMIN",
    });

    expect(updated.role).toBe("ADMIN");
    expect(updated.name).toBe("Vitest Admin");

    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: userId! },
      select: { tokenVersion: true },
    });
    expect(stored.tokenVersion).toBe(1);

    const audit = await prisma.auditLog.findFirst({
      where: { entityId: userId!, action: "USER_UPDATED" },
      orderBy: { createdAt: "desc" },
    });
    expect(audit).not.toBeNull();
  });

  it("prevents changing the acting user's own role", async () => {
    expect(userId).toBeTruthy();

    await expect(
      updateUser(
        { id: userId!, role: "ADMIN" },
        {
          userId: userId!,
          name: "Vitest Admin",
          role: "TECHNICIAN",
        },
      ),
    ).rejects.toMatchObject({
      code: "SELF_ROLE_CHANGE",
    });
  });

  it("prevents self-deactivation", async () => {
    expect(userId).toBeTruthy();

    await expect(
      setUserActive({ id: userId!, role: "ADMIN" }, userId!, false),
    ).rejects.toMatchObject({
      code: "SELF_DEACTIVATION",
    });
  });

  it("deactivates and reactivates a user", async () => {
    expect(userId).toBeTruthy();

    const deactivated = await setUserActive(admin, userId!, false);
    expect(deactivated.isActive).toBe(false);
    expect(deactivated.deactivatedAt).not.toBeNull();

    const reactivated = await setUserActive(admin, userId!, true);
    expect(reactivated.isActive).toBe(true);
    expect(reactivated.deactivatedAt).toBeNull();

    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: userId! },
      select: { tokenVersion: true },
    });
    expect(stored.tokenVersion).toBe(3);
  });

  it("resets a password and revokes previous sessions", async () => {
    expect(userId).toBeTruthy();

    await resetUserPassword(admin, userId!, resetPassword);

    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: userId! },
      select: { passwordHash: true, tokenVersion: true },
    });

    expect(stored.tokenVersion).toBe(4);
    await expect(
      verifyPassword(initialPassword, stored.passwordHash),
    ).resolves.toBe(false);
    await expect(
      verifyPassword(resetPassword, stored.passwordHash),
    ).resolves.toBe(true);
  });

  it("changes the user's own password after confirming the current one", async () => {
    expect(userId).toBeTruthy();
    const actor = { id: userId!, role: "ADMIN" as const };

    await expect(
      changeOwnPassword(actor, "WrongPassword123!", changedPassword),
    ).rejects.toMatchObject({
      code: "INVALID_CURRENT_PASSWORD",
    });

    await expect(
      changeOwnPassword(actor, resetPassword, resetPassword),
    ).rejects.toMatchObject({
      code: "PASSWORD_UNCHANGED",
    });

    await changeOwnPassword(actor, resetPassword, changedPassword);

    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: userId! },
      select: { passwordHash: true, tokenVersion: true },
    });

    expect(stored.tokenVersion).toBe(5);
    await expect(
      verifyPassword(changedPassword, stored.passwordHash),
    ).resolves.toBe(true);
  });

  it("refuses an admin password reset on their own account", async () => {
    expect(userId).toBeTruthy();

    await expect(
      resetUserPassword({ id: userId!, role: "ADMIN" }, userId!, "AnotherPass123!"),
    ).rejects.toMatchObject({
      code: "SELF_PASSWORD_RESET",
    });
  });

  it("refuses user-management calls from a technician", async () => {
    await expect(
      createUser(
        { id: "technician-actor", role: "TECHNICIAN" },
        {
          name: "Blocked User",
          email: `blocked-${randomUUID()}@example.invalid`,
          role: "TECHNICIAN",
          password: initialPassword,
        },
      ),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
