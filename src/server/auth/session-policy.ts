export const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000;
export const SESSION_ABSOLUTE_TIMEOUT_MS = 12 * 60 * 60 * 1000;
export const SESSION_REFRESH_AGE_SECONDS = 60;

export type SessionExpiryReason = "idle" | "absolute" | "invalid";

type SessionTimestamps = {
  now: number;
  signedInAt: unknown;
  lastSeenAt: unknown;
};

/**
 * Validates custom session timestamps. Auth.js only knows about the cookie's
 * expiry, so these checks add the approved idle and absolute timeouts.
 */
export function evaluateSessionExpiry({
  now,
  signedInAt,
  lastSeenAt,
}: SessionTimestamps): SessionExpiryReason | null {
  if (
    typeof signedInAt !== "number" ||
    !Number.isFinite(signedInAt) ||
    typeof lastSeenAt !== "number" ||
    !Number.isFinite(lastSeenAt)
  ) {
    return "invalid";
  }

  if (signedInAt > now || lastSeenAt > now) {
    return "invalid";
  }

  if (now - signedInAt >= SESSION_ABSOLUTE_TIMEOUT_MS) {
    return "absolute";
  }

  if (now - lastSeenAt >= SESSION_IDLE_TIMEOUT_MS) {
    return "idle";
  }

  return null;
}
