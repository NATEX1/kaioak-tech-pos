"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/server/auth/session";
import { updateRepairStatus } from "@/server/services/repairs";

type RepairActionResult = { ok: true; status: string } | { ok: false; error: string };

export async function updateRepairStatusAction(
  billId: string,
  status: string,
): Promise<RepairActionResult> {
  const actor = await requireUser();
  const parsed = z
    .object({
      billId: z.string().trim().min(1).max(64),
      status: z.enum([
        "RECEIVED",
        "INSPECTING",
        "WAITING_APPROVAL",
        "WAITING_PARTS",
        "REPAIRING",
        "COMPLETED",
        "DELIVERED",
      ]),
    })
    .safeParse({ billId, status });

  if (!parsed.success) {
    return { ok: false, error: "ข้อมูลสถานะไม่ถูกต้อง" };
  }

  try {
    const result = await updateRepairStatus(
      { id: actor.id, role: actor.role },
      parsed.data.billId,
      parsed.data.status,
    );
    revalidatePath("/repairs");
    revalidatePath(`/bills/${parsed.data.billId}`);
    return { ok: true, status: result.status };
  } catch (error) {
    if (error instanceof Error) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: "เกิดข้อผิดพลาด กรุณาลองใหม่" };
  }
}
