import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import {
  LOGIN_ATTEMPT_LIMIT,
  LOGIN_WINDOW_MS,
  beginLoginAttempt,
  createLoginRateLimitKey,
} from "@/server/auth/rate-limit";

const createdKeys: string[] = [];

function uniqueKey() {
  const key = `login:test-${randomUUID()}`;
  createdKeys.push(key);
  return key;
}

afterEach(async () => {
  if (createdKeys.length > 0) {
    await prisma.rateLimitBucket.deleteMany({
      where: { key: { in: createdKeys.splice(0) } },
    });
  }
});

describe("login rate limiting", () => {
  it("allows five attempts and blocks the sixth in a fixed window", async () => {
    const key = uniqueKey();

    for (let attempt = 1; attempt <= LOGIN_ATTEMPT_LIMIT; attempt += 1) {
      const result = await beginLoginAttempt(key);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(LOGIN_ATTEMPT_LIMIT - attempt);
    }

    const blocked = await beginLoginAttempt(key);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);

    const bucket = await prisma.rateLimitBucket.findUnique({ where: { key } });
    expect(bucket?.blockedUntil).toBeInstanceOf(Date);
    expect(bucket?.count).toBe(LOGIN_ATTEMPT_LIMIT + 1);
  });

  it("serializes parallel attempts so only five are allowed", async () => {
    const key = uniqueKey();

    const results = await Promise.all(
      Array.from({ length: 10 }, () => beginLoginAttempt(key)),
    );

    expect(results.filter((result) => result.allowed)).toHaveLength(
      LOGIN_ATTEMPT_LIMIT,
    );
    expect(results.filter((result) => !result.allowed)).toHaveLength(
      10 - LOGIN_ATTEMPT_LIMIT,
    );
  });

  it("resets once the fixed window has passed", async () => {
    const key = uniqueKey();

    await beginLoginAttempt(key);
    await beginLoginAttempt(key);

    await prisma.rateLimitBucket.update({
      where: { key },
      data: {
        windowStart: new Date(Date.now() - LOGIN_WINDOW_MS - 1_000),
        blockedUntil: null,
      },
    });

    const result = await beginLoginAttempt(key);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(LOGIN_ATTEMPT_LIMIT - 1);

    const bucket = await prisma.rateLimitBucket.findUnique({ where: { key } });
    expect(bucket?.count).toBe(1);
  });

  it("starts a new window after an expired block", async () => {
    const key = uniqueKey();

    await beginLoginAttempt(key);
    await prisma.rateLimitBucket.update({
      where: { key },
      data: {
        blockedUntil: new Date(Date.now() - 1_000),
        windowStart: new Date(Date.now() - LOGIN_WINDOW_MS - 1_000),
        count: LOGIN_ATTEMPT_LIMIT + 1,
      },
    });

    const result = await beginLoginAttempt(key);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(LOGIN_ATTEMPT_LIMIT - 1);
  });

  it("hashes identifiers instead of storing email and IP", () => {
    const key = createLoginRateLimitKey("user@example.com", "203.0.113.10");

    expect(key.startsWith("login:")).toBe(true);
    expect(key).not.toContain("user@example.com");
    expect(key).not.toContain("203.0.113.10");
    expect(key).toBe(
      createLoginRateLimitKey("USER@example.com", "203.0.113.10"),
    );
    expect(key).not.toBe(
      createLoginRateLimitKey("user@example.com", "203.0.113.11"),
    );
  });
});
