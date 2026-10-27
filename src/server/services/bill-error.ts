export type BillErrorCode =
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INVALID_STATUS"
  | "NOT_OWNER"
  | "EMPTY_ITEMS"
  | "BILL_TYPE_INACTIVE"
  | "CUSTOMER_INACTIVE"
  | "TECHNICIAN_INVALID"
  | "PRODUCT_INACTIVE"
  | "DUPLICATE_PRODUCT_LINE"
  | "STOCK_INSUFFICIENT"
  | "SERIAL_REQUIRED"
  | "SERIAL_NOT_FOUND"
  | "SERIAL_DUPLICATE"
  | "SERIAL_NOT_AVAILABLE"
  | "SERVICE_PRODUCT_INVALID"
  | "INVALID_DISCOUNT"
  | "INVALID_TOTAL"
  | "REPAIR_DETAIL_REQUIRED"
  | "WARRANTY_CLAIM_REQUIRED"
  | "WARRANTY_OVERRIDE_REQUIRED"
  | "DUPLICATE_WARRANTY_CLAIM"
  | "BILL_HAS_WARRANTY_CLAIM"
  | "PRODUCT_ARCHIVED"
  | "BOOKKEEPING_ERROR";

export class BillError extends Error {
  constructor(
    public readonly code: BillErrorCode,
    message: string,
    public readonly details?: string[],
  ) {
    super(message);
    this.name = "BillError";
  }
}

type PrismaLikeError = {
  code?: unknown;
  meta?: {
    target?: unknown;
  };
};

export function isBillUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as PrismaLikeError).code === "P2002"
  );
}

export function billUniqueConstraintTargets(error: unknown): string[] {
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
