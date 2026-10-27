"use server";

import { redirect } from "next/navigation";

import type { ActionState } from "@/lib/action-state";
import { requireAdmin } from "@/server/auth/session";
import {
  inventoryErrorState,
  stringValue,
  withSubmission,
} from "@/server/actions/inventory-action-utils";
import { InventoryError } from "@/server/services/inventory-error";
import { createGoodsReceipt } from "@/server/services/goods-receipts";
import { goodsReceiptSchema } from "@/server/validators/inventory";
import { fieldErrorsFrom } from "@/server/validators/errors";

function receiptValues(formData: FormData): Record<string, string> {
  return {
    supplierId: stringValue(formData, "supplierId"),
    receivedDate: stringValue(formData, "receivedDate"),
    note: stringValue(formData, "note"),
    items: stringValue(formData, "items"),
  };
}

export async function createGoodsReceiptAction(
  previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireAdmin();
  const itemsText = stringValue(formData, "items");
  let items: unknown;

  try {
    items = JSON.parse(itemsText);
  } catch {
    return withSubmission(previousState, {
      status: "error",
      message: "รายการสินค้าในใบรับไม่ถูกต้อง กรุณาเพิ่มรายการใหม่",
      values: receiptValues(formData),
    });
  }

  const parsed = goodsReceiptSchema.safeParse({
    supplierId: formData.get("supplierId"),
    receivedDate: formData.get("receivedDate"),
    note: formData.get("note"),
    items,
  });

  if (!parsed.success) {
    return withSubmission(previousState, {
      status: "error",
      message: "กรุณาตรวจสอบข้อมูลใบรับสินค้า",
      fieldErrors: fieldErrorsFrom(parsed.error),
      values: receiptValues(formData),
    });
  }

  let receiptId: string;

  try {
    const receipt = await createGoodsReceipt(
      { id: actor.id, role: actor.role },
      parsed.data,
    );
    receiptId = receipt.id;
  } catch (error) {
    if (error instanceof InventoryError) {
      return inventoryErrorState(previousState, error, {
        values: receiptValues(formData),
        field: error.code === "SUPPLIER_INACTIVE" ? "supplierId" : undefined,
      });
    }
    throw error;
  }

  redirect(`/inventory/receipts/${receiptId}?created=1`);
}
