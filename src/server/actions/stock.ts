"use server";

import { redirect } from "next/navigation";

import type { ActionState } from "@/lib/action-state";
import { splitSerialNumbers } from "@/lib/barcode";
import { requireAdmin } from "@/server/auth/session";
import {
  inventoryErrorState,
  stringValue,
  withSubmission,
} from "@/server/actions/inventory-action-utils";
import { InventoryError } from "@/server/services/inventory-error";
import { adjustStock } from "@/server/services/stock";
import { stockAdjustmentSchema } from "@/server/validators/inventory";
import { fieldErrorsFrom } from "@/server/validators/errors";

function adjustmentValues(formData: FormData): Record<string, string> {
  return {
    direction: stringValue(formData, "direction"),
    quantity: stringValue(formData, "quantity"),
    unitCost: stringValue(formData, "unitCost"),
    reason: stringValue(formData, "reason"),
    serialNumbers: stringValue(formData, "serialNumbers"),
  };
}

export async function adjustStockAction(
  previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireAdmin();
  const productId = stringValue(formData, "productId");
  const parsed = stockAdjustmentSchema.safeParse({
    productId,
    direction: formData.get("direction"),
    quantity: formData.get("quantity"),
    unitCost: formData.get("unitCost"),
    reason: formData.get("reason"),
    serialNumbers: splitSerialNumbers(stringValue(formData, "serialNumbers")),
  });

  if (!parsed.success) {
    return withSubmission(previousState, {
      status: "error",
      message: "กรุณาตรวจสอบข้อมูลการปรับสต๊อก",
      fieldErrors: fieldErrorsFrom(parsed.error),
      values: adjustmentValues(formData),
    });
  }

  try {
    await adjustStock({ id: actor.id, role: actor.role }, parsed.data);
  } catch (error) {
    if (error instanceof InventoryError) {
      return inventoryErrorState(previousState, error, {
        values: adjustmentValues(formData),
      });
    }
    throw error;
  }

  redirect(`/inventory/products/${productId}?stock=adjusted`);
}
