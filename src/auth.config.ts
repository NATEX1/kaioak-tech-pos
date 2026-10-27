import type { NextAuthConfig } from "next-auth";

import {
  evaluateSessionExpiry,
  SESSION_ABSOLUTE_TIMEOUT_MS,
  SESSION_REFRESH_AGE_SECONDS,
} from "@/server/auth/session-policy";

/**
 * Edge-safe Auth.js settings. No database or password code belongs here because
 * this config is also loaded by `proxy.ts`.
 */
export const authConfig = {
  providers: [],
  secret: process.env.AUTH_SECRET,
  trustHost: process.env.AUTH_TRUST_HOST === "true",
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: SESSION_ABSOLUTE_TIMEOUT_MS / 1000,
    updateAge: SESSION_REFRESH_AGE_SECONDS,
  },
  callbacks: {
    async jwt({ token, user }) {
      const now = Date.now();

      if (user) {
        token.userId = user.id;
        token.role = user.role;
        token.tokenVersion = user.tokenVersion;
        token.signedInAt = now;
        token.lastSeenAt = now;
        token.sessionExpired = false;

        return token;
      }

      const expiryReason = evaluateSessionExpiry({
        now,
        signedInAt: token.signedInAt,
        lastSeenAt: token.lastSeenAt,
      });

      if (expiryReason) {
        token.sessionExpired = true;
        return token;
      }

      token.sessionExpired = false;
      token.lastSeenAt = now;

      return token;
    },
    async session({ session, token }) {
      session.user.id = token.userId ?? "";
      session.user.role = token.role ?? "TECHNICIAN";
      session.user.tokenVersion = token.tokenVersion ?? 0;
      session.sessionStartedAt = token.signedInAt ?? null;
      session.sessionExpired =
        token.sessionExpired === true || !token.userId || !token.role;

      return session;
    },
  },
} satisfies NextAuthConfig;
