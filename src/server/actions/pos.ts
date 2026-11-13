"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/server/auth/session";
import {
  createPosQuote,
  createPosSale,
  convertQuoteToBill,
  PosError,
  setQuoteStatus,
} from "@/server/services/pos";

const moneySchema = z
  .string()
  .trim()
  .max(20)
  .regex(/^\d{1,10}(?:\.\d{1,2})?$/, "จำนวนเงินไม่ถูกต้อง");

const posItemSchema = z.object({
  kind: z.enum(["PRODUCT", "SERVICE"]),
  productId: z.string().trim().max(64).optional(),
  description: z.string().trim().max(500).optional(),
  quantity: z.coerce.number().int().min(1).max(10_000),
  unitPrice: moneySchema,
  discountType: z.enum(["PERCENT", "AMOUNT"]).nullable().optional(),
  discountValue: moneySchema.optional(),
  serialIds: z.array(z.string().trim().min(1).max(64)).max(1_000).optional(),
});

const posBaseSchema = z.object({
  customerId: z.string().trim().max(64).optional(),
  technicianId: z.string().trim().max(64).optional(),
  title: z.string().trim().max(200).optional(),
  note: z.string().trim().max(2_000).optional(),
  items: z.array(posItemSchema).min(1, "ตะกร้าว่าง").max(100),
  discountType: z.enum(["PERCENT", "AMOUNT"]).nullable().optional(),
  discountValue: moneySchema.optional(),
});

const posSaleSchema = posBaseSchema.extend({
  paymentMethod: z.enum(["CASH", "TRANSFER", "CARD", "QR"]),
  receivedAmount: moneySchema.optional(),
  changeAmount: moneySchema.optional(),
  paymentReference: z.string().trim().max(120).optional(),
});

type PosActionResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; error: string; billId?: string; quoteId?: string };

function errorResult(error: unknown): PosActionResult {
  if (error instanceof PosError) {
    return {
      ok: false,
      error: error.message,
      billId: error.billId,
      quoteId: error.quoteId,
    };
  }

  console.error("POS action failed", error);
  return { ok: false, error: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง" };
}

export async function createPosSaleAction(
  input: unknown,
): Promise<PosActionResult> {
  const actor = await requireUser();
  const parsed = posSaleSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "ข้อมูลการขายไม่ถูกต้อง",
    };
  }

  try {
    const result = await createPosSale(
      { id: actor.id, role: actor.role },
      parsed.data,
    );
    revalidatePath("/bills");
    revalidatePath("/");
    return { ok: true, data: result };
  } catch (error) {
    return errorResult(error);
  }
}

export async function createPosQuoteAction(
  input: unknown,
): Promise<PosActionResult> {
  const actor = await requireUser();
  const parsed = posBaseSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "ข้อมูลใบเสนอราคาไม่ถูกต้อง",
    };
  }

  try {
    const result = await createPosQuote(
      { id: actor.id, role: actor.role },
      parsed.data,
    );
    revalidatePath("/quotes");
    return { ok: true, data: result };
  } catch (error) {
    return errorResult(error);
  }
}

export async function convertQuoteToBillAction(
  quoteId: string,
): Promise<PosActionResult> {
  const actor = await requireUser();
  const parsed = z.string().trim().min(1).max(64).safeParse(quoteId);

  if (!parsed.success) {
    return { ok: false, error: "ไม่พบใบเสนอราคา" };
  }

  try {
    const result = await convertQuoteToBill(
      { id: actor.id, role: actor.role },
      parsed.data,
    );
    revalidatePath("/quotes");
    revalidatePath(`/quotes/${parsed.data}`);
    revalidatePath("/bills");
    return { ok: true, data: result };
  } catch (error) {
    return errorResult(error);
  }
}

export async function setQuoteStatusAction(
  quoteId: string,
  status: "ACCEPTED" | "CANCELLED" | "EXPIRED",
): Promise<PosActionResult> {
  const actor = await requireUser();
  const parsed = z
    .object({
      quoteId: z.string().trim().min(1).max(64),
      status: z.enum(["ACCEPTED", "CANCELLED", "EXPIRED"]),
    })
    .safeParse({ quoteId, status });

  if (!parsed.success) {
    return { ok: false, error: "ข้อมูลสถานะไม่ถูกต้อง" };
  }

  try {
    const result = await setQuoteStatus(
      { id: actor.id, role: actor.role },
      parsed.data.quoteId,
      parsed.data.status,
    );
    revalidatePath("/quotes");
    revalidatePath(`/quotes/${parsed.data.quoteId}`);
    return { ok: true, data: { id: result.id, status: result.status } };
  } catch (error) {
    return errorResult(error);
  }
}
