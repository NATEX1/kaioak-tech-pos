export type CommissionErrorCode =
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "TECHNICIAN_INVALID"
  | "INVALID_SCOPE"
  | "INVALID_PERIOD"
  | "INVALID_RULE_VALUE"
  | "NO_PENDING_ENTRIES"
  | "PAYOUT_NEGATIVE";

export class CommissionError extends Error {
  constructor(
    public readonly code: CommissionErrorCode,
    message: string,
    public readonly details?: string[],
  ) {
    super(message);
    this.name = "CommissionError";
  }
}
