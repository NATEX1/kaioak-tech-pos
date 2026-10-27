import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

export const proxy = auth((request) => {
  const { pathname, search } = request.nextUrl;

  if (pathname === "/login") {
    return NextResponse.next();
  }

  if (!request.auth?.user) {
    return redirectToLogin(request, pathname, search, "unauthenticated");
  }

  if (request.auth.sessionExpired) {
    return redirectToLogin(request, pathname, search, "session-expired");
  }

  return NextResponse.next();
});

function redirectToLogin(
  request: Parameters<Parameters<typeof auth>[0]>[0],
  pathname: string,
  search: string,
  reason: "unauthenticated" | "session-expired",
) {
  const loginUrl = new URL("/login", request.nextUrl);
  const nextPath = `${pathname}${search}`;

  if (nextPath !== "/") {
    loginUrl.searchParams.set("next", nextPath);
  }

  if (reason === "session-expired") {
    loginUrl.searchParams.set("reason", reason);
  }

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
