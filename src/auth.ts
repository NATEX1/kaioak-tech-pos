import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { authConfig } from "@/auth.config";
import { getRequestContext } from "@/server/auth/request-context";
import { authenticateCredentials } from "@/server/services/auth-service";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "บัญชีผู้ใช้ KAIOAK TECH",
      credentials: {
        email: { label: "อีเมล", type: "email" },
        password: { label: "รหัสผ่าน", type: "password" },
      },
      async authorize(credentials, request) {
        return authenticateCredentials({
          credentials,
          context: getRequestContext(request),
        });
      },
    }),
  ],
});
