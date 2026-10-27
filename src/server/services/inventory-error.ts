export type InventoryErrorCode =
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "SKU_EXISTS"
  | "BARCODE_EXISTS"
  | "CATEGORY_CODE_EXISTS"
  | "CATEGORY_INACTIVE"
  | "SUPPLIER_INACTIVE"
  | "PRODUCT_HAS_STOCK"
  | "SERIAL_TRACKING_LOCKED"
  | "CATEGORY_IN_USE"
  | "STOCK_INSUFFICIENT"
  | "SERIAL_REQUIRED"
  | "SERIAL_NOT_FOUND"
  | "SERIAL_DUPLICATE"
  | "PRODUCT_NOT_TRACKING_SERIAL"
  | "DUPLICATE_PRODUCT_LINE"
  | "INVALID_STOCK_ADJUSTMENT"
  | "IMPORT_ERROR";

export class InventoryError extends Error {
  constructor(
    public readonly code: InventoryErrorCode,
    message: string,
    public readonly details?: string[],
  ) {
    super(message);
    this.name = "InventoryError";
  }
}

type PrismaLikeError = {
  code?: unknown;
  meta?: {
    target?: unknown;
  };
};

export function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as PrismaLikeError).code === "P2002"
  );
}

export function uniqueConstraintTargets(error: unknown): string[] {
  if (typeof error !== "object" || error === null) {
    return [];
  }

  const target = (error as PrismaLikeError).meta?.target;

  if (Array.isArray(target)) {
    return target.filter((value): value is string => typeof value === "string");
  }

  if (typeof target === "string") {
    return [target];
  }

  return [];
}
