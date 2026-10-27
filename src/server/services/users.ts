import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { Role } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/server/audit";
import { hashPassword, verifyPassword } from "@/server/auth/password";

const USER_MANAGEMENT_LOCK = "compos:user-management";

export type UserActor = {
  id: string;
  role: Role;
};

export type UserServiceErrorCode =
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "EMAIL_ALREADY_EXISTS"
  | "SELF_DEACTIVATION"
  | "SELF_ROLE_CHANGE"
  | "LAST_ADMIN"
  | "SELF_PASSWORD_RESET"
  | "INVALID_CURRENT_PASSWORD"
  | "PASSWORD_UNCHANGED";

export class UserServiceError extends Error {
  constructor(
    public readonly code: UserServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "UserServiceError";
  }
}

const userSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  isActive: true,
  lastLoginAt: true,
  deactivatedAt: true,
  createdAt: true,
  updatedAt: true,
  createdById: true,
} as const;

export type UserRecord = Awaited<ReturnType<typeof getUserById>>;

export async function listUsers(actor: UserActor) {
  assertAdmin(actor);

  return prisma.user.findMany({
    orderBy: [{ isActive: "desc" }, { role: "asc" }, { name: "asc" }],
    select: userSelect,
  });
}

export async function getUserById(actor: UserActor, userId: string) {
  assertAdmin(actor);

  return prisma.user.findUnique({
    where: { id: userId },
    select: userSelect,
  });
}

export async function createUser(
  actor: UserActor,
  input: {
    name: string;
    email: string;
    phone?: string;
    role: Role;
    password: string;
  },
) {
  assertAdmin(actor);

  const passwordHash = await hashPassword(input.password);

  try {
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: input.name,
          email: input.email,
          phone: input.phone ?? null,
          role: input.role,
          passwordHash,
          createdById: actor.id,
        },
        select: userSelect,
      });

      await writeAuditLog(
        {
          actorId: actor.id,
          action: "USER_CREATED",
          entityType: "User",
          entityId: user.id,
          after: toAuditUser(user),
        },
        tx,
      );

      return user;
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new UserServiceError(
        "EMAIL_ALREADY_EXISTS",
        "อีเมลนี้ถูกใช้งานแล้ว",
      );
    }

    throw error;
  }
}

export async function updateUser(
  actor: UserActor,
  input: {
    userId: string;
    name: string;
    phone?: string;
    role: Role;
  },
) {
  assertAdmin(actor);

  return prisma.$transaction(async (tx) => {
    await lockUserManagement(tx);

    const target = await tx.user.findUnique({
      where: { id: input.userId },
      select: userSelect,
    });

    if (!target) {
      throw new UserServiceError("NOT_FOUND", "ไม่พบผู้ใช้นี้");
    }

    const roleChanged = target.role !== input.role;

    if (target.id === actor.id && roleChanged) {
      throw new UserServiceError(
        "SELF_ROLE_CHANGE",
        "ไม่สามารถเปลี่ยนบทบาทของบัญชีที่กำลังใช้งานอยู่ได้",
      );
    }

    if (target.role === "ADMIN" && target.isActive && roleChanged) {
      await assertAnotherActiveAdmin(tx, target.id);
    }

    const updated = await tx.user.update({
      where: { id: target.id },
      data: {
        name: input.name,
        phone: input.phone ?? null,
        role: input.role,
        ...(roleChanged ? { tokenVersion: { increment: 1 } } : {}),
      },
      select: userSelect,
    });

    await writeAuditLog(
      {
        actorId: actor.id,
        action: "USER_UPDATED",
        entityType: "User",
        entityId: updated.id,
        before: toAuditUser(target),
        after: toAuditUser(updated),
      },
      tx,
    );

    return updated;
  });
}

export async function setUserActive(
  actor: UserActor,
  userId: string,
  active: boolean,
) {
  assertAdmin(actor);

  return prisma.$transaction(async (tx) => {
    await lockUserManagement(tx);

    const target = await tx.user.findUnique({
      where: { id: userId },
      select: userSelect,
    });

    if (!target) {
      throw new UserServiceError("NOT_FOUND", "ไม่พบผู้ใช้นี้");
    }

    if (!active && target.id === actor.id) {
      throw new UserServiceError(
        "SELF_DEACTIVATION",
        "ไม่สามารถปิดใช้งานบัญชีที่กำลังใช้งานอยู่ได้",
      );
    }

    if (target.isActive === active) {
      return target;
    }

    if (!active && target.role === "ADMIN") {
      await assertAnotherActiveAdmin(tx, target.id);
    }

    const updated = await tx.user.update({
      where: { id: target.id },
      data: {
        isActive: active,
        deactivatedAt: active ? null : new Date(),
        tokenVersion: { increment: 1 },
      },
      select: userSelect,
    });

    await writeAuditLog(
      {
        actorId: actor.id,
        action: active ? "USER_REACTIVATED" : "USER_DEACTIVATED",
        entityType: "User",
        entityId: updated.id,
        before: toAuditUser(target),
        after: toAuditUser(updated),
      },
      tx,
    );

    return updated;
  });
}

export async function resetUserPassword(
  actor: UserActor,
  userId: string,
  password: string,
) {
  assertAdmin(actor);

  if (actor.id === userId) {
    throw new UserServiceError(
      "SELF_PASSWORD_RESET",
      "กรุณาเปลี่ยนรหัสผ่านของตนเองจากหน้าโปรไฟล์",
    );
  }

  const passwordHash = await hashPassword(password);

  return prisma.$transaction(async (tx) => {
    const target = await tx.user.findUnique({
      where: { id: userId },
      select: userSelect,
    });

    if (!target) {
      throw new UserServiceError("NOT_FOUND", "ไม่พบผู้ใช้นี้");
    }

    const updated = await tx.user.update({
      where: { id: target.id },
      data: {
        passwordHash,
        tokenVersion: { increment: 1 },
      },
      select: userSelect,
    });

    await writeAuditLog(
      {
        actorId: actor.id,
        action: "USER_PASSWORD_RESET",
        entityType: "User",
        entityId: updated.id,
        metadata: { email: updated.email },
      },
      tx,
    );

    return updated;
  });
}

export async function changeOwnPassword(
  actor: UserActor,
  currentPassword: string,
  newPassword: string,
) {
  const user = await prisma.user.findUnique({
    where: { id: actor.id },
    select: { id: true, email: true, passwordHash: true },
  });

  if (!user) {
    throw new UserServiceError("NOT_FOUND", "ไม่พบผู้ใช้นี้");
  }

  const currentMatches = await verifyPassword(currentPassword, user.passwordHash);

  if (!currentMatches) {
    throw new UserServiceError(
      "INVALID_CURRENT_PASSWORD",
      "รหัสผ่านปัจจุบันไม่ถูกต้อง",
    );
  }

  if (await verifyPassword(newPassword, user.passwordHash)) {
    throw new UserServiceError(
      "PASSWORD_UNCHANGED",
      "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม",
    );
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        tokenVersion: { increment: 1 },
      },
    });

    await writeAuditLog(
      {
        actorId: user.id,
        action: "USER_PASSWORD_CHANGED",
        entityType: "User",
        entityId: user.id,
        metadata: { email: user.email },
      },
      tx,
    );
  });
}

function assertAdmin(actor: UserActor) {
  if (actor.role !== "ADMIN") {
    throw new UserServiceError(
      "FORBIDDEN",
      "คุณไม่มีสิทธิ์จัดการผู้ใช้งาน",
    );
  }
}

async function lockUserManagement(tx: Prisma.TransactionClient) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${USER_MANAGEMENT_LOCK}, 0))`;
}

async function assertAnotherActiveAdmin(
  tx: Prisma.TransactionClient,
  excludedUserId: string,
) {
  const remainingAdmins = await tx.user.count({
    where: {
      id: { not: excludedUserId },
      role: "ADMIN",
      isActive: true,
    },
  });

  if (remainingAdmins === 0) {
    throw new UserServiceError(
      "LAST_ADMIN",
      "ต้องมีผู้ดูแลระบบที่เปิดใช้งานอย่างน้อย 1 คน",
    );
  }
}

function toAuditUser(user: {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isActive: user.isActive,
  };
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}
