"use server";

import { redirect } from "next/navigation";

import type { ActionState } from "@/lib/action-state";
import { requireAdmin } from "@/server/auth/session";
import {
  SettingsServiceError,
  updateShopSettings,
} from "@/server/services/settings";
import { fieldErrorsFrom } from "@/server/validators/errors";
import { shopSettingsSchema } from "@/server/validators/settings";

function stringValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function checkboxValue(formData: FormData, key: string): boolean {
  return formData.get(key) === "on" || formData.get(key) === "true";
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

export async function updateShopSettingsAction(
  previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireAdmin();
  const parsed = shopSettingsSchema.safeParse({
    shopName: formData.get("shopName"),
    address: formData.get("address"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    taxId: formData.get("taxId"),
    vatEnabled: checkboxValue(formData, "vatEnabled"),
    vatRate: formData.get("vatRate"),
    vatIncluded: checkboxValue(formData, "vatIncluded"),
    receiptFooter: formData.get("receiptFooter"),
    logoUrl: formData.get("logoUrl"),
  });

  if (!parsed.success) {
    return withSubmission(previousState, {
      status: "error",
      message: "กรุณาตรวจสอบข้อมูลร้าน",
      fieldErrors: fieldErrorsFrom(parsed.error),
      values: {
        shopName: stringValue(formData, "shopName"),
        address: stringValue(formData, "address"),
        phone: stringValue(formData, "phone"),
        email: stringValue(formData, "email"),
        taxId: stringValue(formData, "taxId"),
        vatRate: stringValue(formData, "vatRate"),
        vatEnabled: checkboxValue(formData, "vatEnabled") ? "true" : "false",
        vatIncluded: checkboxValue(formData, "vatIncluded") ? "true" : "false",
        receiptFooter: stringValue(formData, "receiptFooter"),
        logoUrl: stringValue(formData, "logoUrl"),
      },
    });
  }

  try {
    await updateShopSettings(
      { id: actor.id, role: actor.role },
      parsed.data,
    );
  } catch (error) {
    if (error instanceof SettingsServiceError) {
      return withSubmission(previousState, {
        status: "error",
        message: error.message,
      });
    }

    throw error;
  }

  redirect("/settings/shop?updated=1");
}
