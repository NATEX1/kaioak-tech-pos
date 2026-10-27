import "server-only";

import { createHmac } from "node:crypto";

import { prisma } from "@/lib/db";

export const LOGIN_ATTEMPT_LIMIT = 5;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;

export type LoginAttemptResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

function requireSecret(): string {
  const secret = process.env.AUTH_SECRET;

  if (!secret) {
    throw new Error("AUTH_SECRET is required for login rate limiting.");
  }

  return secret;
}

/**
 * Hashes the email/IP pair so rate-limit rows do not store raw personal data.
 * The HMAC key also prevents offline dictionary checks of the stored keys.
 */
export function createLoginRateLimitKey(email: string, ipAddress: string) {
  const digest = createHmac("sha256", requireSecret())
    .update(`${email.trim().toLowerCase()}\n${ipAddress}`)
    .digest("hex");

  return `login:${digest}`;
}

/**
 * Consumes one attempt from a fixed 15-minute window. All reads/writes for a
 * key are serialized with a PostgreSQL advisory transaction lock, so parallel
 * requests cannot bypass the limit.
 */
export async function beginLoginAttempt(
  key: string,
): Promise<LoginAttemptResult> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;

    const now = new Date();
    const bucket = await tx.rateLimitBucket.findUnique({ where: { key } });

    if (bucket?.blockedUntil && bucket.blockedUntil > now) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((bucket.blockedUntil.getTime() - now.getTime()) / 1000),
        ),
      };
    }

    if (!bucket) {
      await tx.rateLimitBucket.create({
        data: {
          key,
          count: 1,
          windowStart: now,
        },
      });

      return {
        allowed: true,
        remaining: LOGIN_ATTEMPT_LIMIT - 1,
        retryAfterSeconds: 0,
      };
    }

    const windowExpired =
      now.getTime() - bucket.windowStart.getTime() >= LOGIN_WINDOW_MS;
    const blockExpired =
      bucket.blockedUntil !== null && bucket.blockedUntil <= now;

    if (windowExpired || blockExpired) {
      await tx.rateLimitBucket.update({
        where: { key },
        data: {
          count: 1,
          windowStart: now,
          blockedUntil: null,
        },
      });

      return {
        allowed: true,
        remaining: LOGIN_ATTEMPT_LIMIT - 1,
        retryAfterSeconds: 0,
      };
    }

    const nextCount = bucket.count + 1;

    if (nextCount > LOGIN_ATTEMPT_LIMIT) {
      const blockedUntil = new Date(now.getTime() + LOGIN_WINDOW_MS);

      await tx.rateLimitBucket.update({
        where: { key },
        data: {
          count: nextCount,
          blockedUntil,
          windowStart: now,
        },
      });

      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.ceil(LOGIN_WINDOW_MS / 1000),
      };
    }

    await tx.rateLimitBucket.update({
      where: { key },
      data: { count: nextCount },
    });

    return {
      allowed: true,
      remaining: LOGIN_ATTEMPT_LIMIT - nextCount,
      retryAfterSeconds: 0,
    };
  });
}

/**
 * Deletes rate-limit rows whose block window has fully expired.
 * Safe to call periodically (e.g. from the health-check route or a cron job).
 * Rows that are still within their active window are left untouched.
 */
export async function pruneExpiredRateLimits(): Promise<number> {
  const now = new Date();
  const result = await prisma.rateLimitBucket.deleteMany({
    where: {
      OR: [
        // Window expired and no block set
        {
          blockedUntil: null,
          windowStart: { lt: new Date(now.getTime() - LOGIN_WINDOW_MS) },
        },
        // Block has lifted and the window is also expired
        {
          blockedUntil: { lt: now },
          windowStart: { lt: new Date(now.getTime() - LOGIN_WINDOW_MS) },
        },
      ],
    },
  });
  return result.count;
}
