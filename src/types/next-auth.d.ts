import type { DefaultSession } from "next-auth";

import type { Role } from "@/generated/prisma/enums";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      tokenVersion: number;
    } & DefaultSession["user"];
    sessionStartedAt: number | null;
    sessionExpired: boolean;
  }

  interface User {
    role: Role;
    tokenVersion: number;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    userId?: string;
    role?: Role;
    tokenVersion?: number;
    signedInAt?: number;
    lastSeenAt?: number;
    sessionExpired?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    role?: Role;
    tokenVersion?: number;
    signedInAt?: number;
    lastSeenAt?: number;
    sessionExpired?: boolean;
  }
}
