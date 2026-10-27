export type CustomerErrorCode =
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "PHONE_EXISTS";

export class CustomerError extends Error {
  constructor(
    public readonly code: CustomerErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CustomerError";
  }
}

type PrismaLikeError = {
  code?: unknown;
};

export function isCustomerUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as PrismaLikeError).code === "P2002"
  );
}
