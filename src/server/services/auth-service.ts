import "server-only";

import { CredentialsSignin } from "next-auth";

import type { Role } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/server/audit";
import {
  AccountInactiveError,
  LoginRateLimitError,
} from "@/server/auth/auth-errors";
import {
  performDummyPasswordCheck,
  verifyPassword,
} from "@/server/auth/password";
import {
  beginLoginAttempt,
  createLoginRateLimitKey,
} from "@/server/auth/rate-limit";
import type { RequestContext } from "@/server/auth/request-context";
import { loginSchema } from "@/server/validators/auth";

export type AuthenticatedUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  tokenVersion: number;
};

type AuthenticateInput = {
  credentials: Partial<Record<"email" | "password", unknown>>;
  context: RequestContext;
};

export async function authenticateCredentials({
  credentials,
  context,
}: AuthenticateInput): Promise<AuthenticatedUser> {
  const parsed = loginSchema.safeParse(credentials);

  if (!parsed.success) {
    throw new CredentialsSignin();
  }

  const { email, password } = parsed.data;
  const rateLimitKey = createLoginRateLimitKey(email, context.ipAddress);
  const attempt = await beginLoginAttempt(rateLimitKey);

  if (!attempt.allowed) {
    await writeAuditLog({
      actorId: null,
      action: "AUTH_LOGIN_BLOCKED",
      entityType: "Auth",
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        email,
        reason: "rate_limited",
        retryAfterSeconds: attempt.retryAfterSeconds,
      },
    });

    throw new LoginRateLimitError(attempt.retryAfterSeconds);
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      name: true,
      email: true,
      passwordHash: true,
      role: true,
      isActive: true,
      tokenVersion: true,
    },
  });

  if (!user) {
    await performDummyPasswordCheck(password);

    await writeAuditLog({
      actorId: null,
      action: "AUTH_LOGIN_FAILED",
      entityType: "Auth",
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: { email, reason: "invalid_credentials" },
    });

    throw new CredentialsSignin();
  }

  const passwordMatches = await verifyPassword(password, user.passwordHash);

  if (!passwordMatches) {
    await writeAuditLog({
      actorId: user.id,
      action: "AUTH_LOGIN_FAILED",
      entityType: "Auth",
      entityId: user.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: { email, reason: "invalid_credentials" },
    });

    throw new CredentialsSignin();
  }

  if (!user.isActive) {
    await writeAuditLog({
      actorId: user.id,
      action: "AUTH_LOGIN_FAILED",
      entityType: "Auth",
      entityId: user.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: { email, reason: "account_inactive" },
    });

    throw new AccountInactiveError();
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await tx.rateLimitBucket.deleteMany({ where: { key: rateLimitKey } });

    await writeAuditLog(
      {
        actorId: user.id,
        action: "AUTH_LOGIN_SUCCESS",
        entityType: "Auth",
        entityId: user.id,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        metadata: { email: user.email },
      },
      tx,
    );
  });

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    tokenVersion: user.tokenVersion,
  };
}
