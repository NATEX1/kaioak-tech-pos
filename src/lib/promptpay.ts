import { Decimal, roundMoney } from "@/lib/money";

const PROMPTPAY_AID = "A000000677010111";

export class PromptPayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PromptPayError";
  }
}

function field(tag: string, value: string): string {
  return `${tag}${String(value.length).padStart(2, "0")}${value}`;
}

function crc16(payload: string): string {
  let crc = 0xffff;

  for (let index = 0; index < payload.length; index += 1) {
    crc ^= payload.charCodeAt(index) << 8;

    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export type PromptPayTarget =
  | { kind: "MOBILE"; value: string }
  | { kind: "NATIONAL_ID"; value: string }
  | { kind: "EWALLET"; value: string };

export function normalizePromptPayTarget(raw: string): PromptPayTarget {
  const digits = raw.replace(/\D/g, "");

  if (!digits) {
    throw new PromptPayError("กรุณาระบุเบอร์พร้อมเพย์หรือเลขบัตรประชาชน");
  }

  if (digits.length === 10 && digits.startsWith("0")) {
    return { kind: "MOBILE", value: `0066${digits.slice(1)}` };
  }

  if (digits.length === 11 && digits.startsWith("66")) {
    return { kind: "MOBILE", value: `00${digits}` };
  }

  if (digits.length === 13 && digits.startsWith("0066")) {
    return { kind: "MOBILE", value: digits };
  }

  if (digits.length === 13) {
    return { kind: "NATIONAL_ID", value: digits };
  }

  if (digits.length === 15) {
    return { kind: "EWALLET", value: digits };
  }

  throw new PromptPayError(
    "พร้อมเพย์ต้องเป็นเบอร์มือถือ 10 หลัก เลขบัตรประชาชน 13 หลัก หรือ e-Wallet 15 หลัก",
  );
}

export function buildPromptPayPayload(input: {
  promptpayId: string;
  amount?: Decimal.Value;
  reference?: string;
}): string {
  const target = normalizePromptPayTarget(input.promptpayId);
  const hasAmount =
    input.amount !== undefined && new Decimal(input.amount).greaterThan(0);

  const merchantAccount =
    field("00", PROMPTPAY_AID) +
    field(
      target.kind === "MOBILE"
        ? "01"
        : target.kind === "NATIONAL_ID"
          ? "02"
          : "03",
      target.value,
    );

  let payload =
    field("00", "01") +
    field("01", hasAmount ? "12" : "11") +
    field("29", merchantAccount) +
    field("53", "764");

  if (hasAmount) {
    const amount = roundMoney(input.amount!);
    payload += field("54", amount.toFixed(2));
  }

  payload += field("58", "TH");

  if (input.reference?.trim()) {
    payload += field("62", field("05", input.reference.trim().slice(0, 25)));
  }

  const withCrcTag = `${payload}6304`;
  return `${withCrcTag}${crc16(withCrcTag)}`;
}
