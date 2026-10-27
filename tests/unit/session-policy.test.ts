import { describe, expect, it } from "vitest";

import {
  SESSION_ABSOLUTE_TIMEOUT_MS,
  SESSION_IDLE_TIMEOUT_MS,
  evaluateSessionExpiry,
} from "@/server/auth/session-policy";

const now = 1_800_000_000_000;

describe("session policy", () => {
  it("accepts a fresh session", () => {
    expect(
      evaluateSessionExpiry({
        now,
        signedInAt: now - 60_000,
        lastSeenAt: now - 1_000,
      }),
    ).toBeNull();
  });

  it("expires a session idle for the full timeout", () => {
    expect(
      evaluateSessionExpiry({
        now,
        signedInAt: now - SESSION_IDLE_TIMEOUT_MS - 1_000,
        lastSeenAt: now - SESSION_IDLE_TIMEOUT_MS,
      }),
    ).toBe("idle");
  });

  it("keeps a session active just before the idle timeout", () => {
    expect(
      evaluateSessionExpiry({
        now,
        signedInAt: now - 60_000,
        lastSeenAt: now - SESSION_IDLE_TIMEOUT_MS + 1,
      }),
    ).toBeNull();
  });

  it("expires at the absolute timeout even with recent activity", () => {
    expect(
      evaluateSessionExpiry({
        now,
        signedInAt: now - SESSION_ABSOLUTE_TIMEOUT_MS,
        lastSeenAt: now,
      }),
    ).toBe("absolute");
  });

  it("rejects malformed or future timestamps", () => {
    expect(
      evaluateSessionExpiry({
        now,
        signedInAt: undefined,
        lastSeenAt: now,
      }),
    ).toBe("invalid");

    expect(
      evaluateSessionExpiry({
        now,
        signedInAt: now + 1,
        lastSeenAt: now,
      }),
    ).toBe("invalid");
  });
});
