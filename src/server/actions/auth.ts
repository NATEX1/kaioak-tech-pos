"use server";

import { AuthError } from "next-auth";

import { signIn, signOut } from "@/auth";
import type { ActionState } from "@/lib/action-state";
import { safeInternalPath } from "@/lib/safe-redirect";
import { writeAuditLog } from "@/server/audit";
import { getCurrentUser } from "@/server/auth/session";
import { loginSchema } from "@/server/validators/auth";
import { fieldErrorsFrom } from "@/server/validators/errors";

export async function loginAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "กรุณาตรวจสอบข้อมูลเข้าสู่ระบบ",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const redirectTo = safeInternalPath(formData.get("next"));
  const { email, password } = parsed.data;

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      const code = (error as AuthError & { code?: string }).code;

      if (code === "rate_limited") {
        const retryAfterSeconds =
          (error as AuthError & { retryAfterSeconds?: number })
            .retryAfterSeconds ?? 15 * 60;
        const retryAfterMinutes = Math.max(
          1,
          Math.ceil(retryAfterSeconds / 60),
        );

        return {
          status: "error",
          message: `พยายามเข้าสู่ระบบเกินกำหนด กรุณารออีก ${retryAfterMinutes} นาที`,
        };
      }

      if (code === "account_inactive") {
        return {
          status: "error",
          message: "บัญชีนี้ถูกปิดใช้งาน กรุณาติดต่อผู้ดูแลระบบ",
        };
      }

      return {
        status: "error",
        message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
      };
    }

    // Auth.js uses Next.js redirect errors on success, so non-auth errors must
    // continue to the framework.
    throw error;
  }

  return { status: "success" };
}

export async function logoutAction() {
  const user = await getCurrentUser();

  if (user) {
    try {
      await writeAuditLog({
        actorId: user.id,
        action: "AUTH_LOGOUT",
        entityType: "Auth",
        entityId: user.id,
        metadata: { email: user.email },
      });
    } catch (error) {
      console.error("Failed to write logout audit log", error);
    }
  }

  await signOut({ redirectTo: "/login?reason=logged-out" });
}
