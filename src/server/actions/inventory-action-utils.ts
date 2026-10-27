import "server-only";

import type { ActionState } from "@/lib/action-state";
import {
  InventoryError,
  type InventoryErrorCode,
} from "@/server/services/inventory-error";

export function stringValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export function checkboxValue(formData: FormData, key: string): string {
  return formData.get(key) === "on" ? "true" : "false";
}

export function withSubmission(
  previousState: ActionState,
  state: ActionState,
): ActionState {
  return {
    ...state,
    submissionId: (previousState.submissionId ?? 0) + 1,
  };
}

const DEFAULT_ERROR_FIELDS: Partial<Record<InventoryErrorCode, string>> = {
  SKU_EXISTS: "sku",
  BARCODE_EXISTS: "barcode",
  CATEGORY_CODE_EXISTS: "code",
  CATEGORY_INACTIVE: "categoryId",
  SUPPLIER_INACTIVE: "defaultSupplierId",
  SERIAL_REQUIRED: "serialNumbers",
  SERIAL_NOT_FOUND: "serialNumbers",
  SERIAL_DUPLICATE: "serialNumbers",
  STOCK_INSUFFICIENT: "quantity",
  PRODUCT_NOT_TRACKING_SERIAL: "serialNumbers",
};

export function inventoryErrorState(
  previousState: ActionState,
  error: InventoryError,
  options: {
    values?: Record<string, string>;
    field?: string;
  } = {},
): ActionState {
  const field = options.field ?? DEFAULT_ERROR_FIELDS[error.code];

  return withSubmission(previousState, {
    status: "error",
    message: error.message,
    details: error.details,
    ...(field ? { fieldErrors: { [field]: [error.message] } } : {}),
    values: options.values,
  });
}
