"use server";

import { redirect } from "next/navigation";

import { signOut } from "@/auth";
import type { ActionState } from "@/lib/action-state";
import { requireAdmin, requireUser } from "@/server/auth/session";
import {
  UserServiceError,
  changeOwnPassword,
  createUser,
  resetUserPassword,
  setUserActive,
  updateUser,
} from "@/server/services/users";
import { fieldErrorsFrom } from "@/server/validators/errors";
import {
  changeOwnPasswordSchema,
  createUserSchema,
  resetUserPasswordSchema,
  updateUserSchema,
  updateUserStatusSchema,
} from "@/server/validators/users";

function stringValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function withSubmission(
  previousState: ActionState,
  state: ActionState,
): ActionState {
  return {
    ...state,
    submissionId: (previousState.submissionId ?? 0) + 1,
  };
}

function serviceErrorState(
  error: UserServiceError,
  values?: Record<string, string>,
): ActionState {
  if (error.code === "EMAIL_ALREADY_EXISTS") {
    return {
      status: "error",
      message: error.message,
      fieldErrors: { email: [error.message] },
      values,
    };
  }

  if (error.code === "INVALID_CURRENT_PASSWORD") {
    return {
      status: "error",
      message: error.message,
      fieldErrors: { currentPassword: [error.message] },
    };
  }

  if (error.code === "PASSWORD_UNCHANGED") {
    return {
      status: "error",
      message: error.message,
      fieldErrors: { password: [error.message] },
    };
  }

  return { status: "error", message: error.message, values };
}

export async function createUserAction(
  previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireAdmin();
  const parsed = createUserSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    role: formData.get("role"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return withSubmission(previousState, {
      status: "error",
      message: "กรุณาตรวจสอบข้อมูลผู้ใช้",
      fieldErrors: fieldErrorsFrom(parsed.error),
      values: {
        name: stringValue(formData, "name"),
        email: stringValue(formData, "email"),
        phone: stringValue(formData, "phone"),
        role: stringValue(formData, "role"),
      },
    });
  }

  let createdUserId: string;

  try {
    const user = await createUser(
      { id: actor.id, role: actor.role },
      {
        name: parsed.data.name,
        email: parsed.data.email,
        phone: parsed.data.phone,
        role: parsed.data.role,
        password: parsed.data.password,
      },
    );
    createdUserId = user.id;
  } catch (error) {
    if (error instanceof UserServiceError) {
      return withSubmission(
        previousState,
        serviceErrorState(error, {
          name: parsed.data.name,
          email: parsed.data.email,
          phone: parsed.data.phone ?? "",
          role: parsed.data.role,
        }),
      );
    }
    throw error;
  }

  redirect(`/settings/users/${createdUserId}?created=1`);
}

export async function updateUserAction(
  previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireAdmin();
  const parsed = updateUserSchema.safeParse({
    userId: formData.get("userId"),
    name: formData.get("name"),
    phone: formData.get("phone"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    return withSubmission(previousState, {
      status: "error",
      message: "กรุณาตรวจสอบข้อมูลผู้ใช้",
      fieldErrors: fieldErrorsFrom(parsed.error),
      values: {
        name: stringValue(formData, "name"),
        phone: stringValue(formData, "phone"),
        role: stringValue(formData, "role"),
      },
    });
  }

  try {
    await updateUser(
      { id: actor.id, role: actor.role },
      {
        userId: parsed.data.userId,
        name: parsed.data.name,
        phone: parsed.data.phone,
        role: parsed.data.role,
      },
    );
  } catch (error) {
    if (error instanceof UserServiceError) {
      return withSubmission(
        previousState,
        serviceErrorState(error, {
          name: parsed.data.name,
          phone: parsed.data.phone ?? "",
          role: parsed.data.role,
        }),
      );
    }
    throw error;
  }

  redirect(`/settings/users/${parsed.data.userId}?updated=1`);
}

export async function resetUserPasswordAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireAdmin();
  const parsed = resetUserPasswordSchema.safeParse({
    userId: formData.get("userId"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "กรุณาตรวจสอบรหัสผ่านใหม่",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  try {
    await resetUserPassword(
      { id: actor.id, role: actor.role },
      parsed.data.userId,
      parsed.data.password,
    );
  } catch (error) {
    if (error instanceof UserServiceError) {
      return serviceErrorState(error);
    }
    throw error;
  }

  redirect(`/settings/users/${parsed.data.userId}?password-reset=1`);
}

export async function updateUserStatusAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireAdmin();
  const parsed = updateUserStatusSchema.safeParse({
    userId: formData.get("userId"),
    active: stringValue(formData, "active"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "ข้อมูลสถานะผู้ใช้ไม่ถูกต้อง",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  try {
    await setUserActive(
      { id: actor.id, role: actor.role },
      parsed.data.userId,
      parsed.data.active,
    );
  } catch (error) {
    if (error instanceof UserServiceError) {
      return serviceErrorState(error);
    }
    throw error;
  }

  redirect(
    `/settings/users/${parsed.data.userId}?status=${parsed.data.active ? "active" : "inactive"}`,
  );
}

export async function changeOwnPasswordAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireUser();
  const parsed = changeOwnPasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "กรุณาตรวจสอบรหัสผ่าน",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  try {
    await changeOwnPassword(
      { id: actor.id, role: actor.role },
      parsed.data.currentPassword,
      parsed.data.password,
    );
  } catch (error) {
    if (error instanceof UserServiceError) {
      return serviceErrorState(error);
    }
    throw error;
  }

  await signOut({ redirectTo: "/login?reason=password-changed" });

  return { status: "success" };
}
