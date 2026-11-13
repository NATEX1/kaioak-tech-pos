"use server";

import { redirect } from "next/navigation";

import type { ActionState } from "@/lib/action-state";
import { REPAIR_STATUS_ORDER } from "@/lib/messaging";
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

function messageTemplatesFrom(formData: FormData): Record<string, string> {
  return Object.fromEntries(
    REPAIR_STATUS_ORDER.map((status) => [
      status,
      stringValue(formData, `template_${status}`),
    ]).filter(([, value]) => value.trim().length > 0),
  );
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
    promptpayId: formData.get("promptpayId"),
    bankInfo: formData.get("bankInfo"),
    lineId: formData.get("lineId"),
    whatsapp: formData.get("whatsapp"),
    repairWarrantyDays: formData.get("repairWarrantyDays"),
    quoteValidityDays: formData.get("quoteValidityDays"),
    repairTerms: formData.get("repairTerms"),
    messageTemplates: messageTemplatesFrom(formData),
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
        promptpayId: stringValue(formData, "promptpayId"),
        bankInfo: stringValue(formData, "bankInfo"),
        lineId: stringValue(formData, "lineId"),
        whatsapp: stringValue(formData, "whatsapp"),
        repairWarrantyDays: stringValue(formData, "repairWarrantyDays"),
        quoteValidityDays: stringValue(formData, "quoteValidityDays"),
        repairTerms: stringValue(formData, "repairTerms"),
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
