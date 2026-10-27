import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import type { Role } from "@/generated/prisma/enums";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  lastLoginAt: Date | null;
};

type CurrentUserState =
  | { user: CurrentUser; reason: null }
  | {
      user: null;
      reason: "unauthenticated" | "session-expired" | "account-unavailable";
    };

const readCurrentUser = cache(async (): Promise<CurrentUserState> => {
  // Auth.js derives the session cookie and CSRF material at request time.
  // Explicitly defer this route instead of attempting a prerender.
  await connection();

  const session = await auth();

  if (!session?.user) {
    return { user: null, reason: "unauthenticated" };
  }

  if (session.sessionExpired) {
    return { user: null, reason: "session-expired" };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      tokenVersion: true,
      lastLoginAt: true,
    },
  });

  if (!user || !user.isActive) {
    return { user: null, reason: "account-unavailable" };
  }

  if (
    user.tokenVersion !== session.user.tokenVersion ||
    user.role !== session.user.role
  ) {
    return { user: null, reason: "session-expired" };
  }

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      lastLoginAt: user.lastLoginAt,
    },
    reason: null,
  };
});

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const state = await readCurrentUser();
  return state.user;
}

export async function requireUser(): Promise<CurrentUser> {
  const state = await readCurrentUser();

  if (!state.user) {
    if (state.reason === "unauthenticated") {
      redirect("/login");
    }

    redirect(`/login?reason=${state.reason}`);
  }

  return state.user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();

  if (user.role !== "ADMIN") {
    redirect("/forbidden");
  }

  return user;
}
