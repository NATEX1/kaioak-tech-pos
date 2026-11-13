"use server";

import { redirect } from "next/navigation";

import type { ActionState } from "@/lib/action-state";
import { withSubmission } from "@/server/actions/inventory-action-utils";
import { requireAdmin } from "@/server/auth/session";
import {
  DayClosingError,
  saveDayClosing,
} from "@/server/services/day-closing";

function stringValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function saveDayClosingAction(
  previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireAdmin();
  const dateKey = stringValue(formData, "dateKey");
  const countedCash = stringValue(formData, "countedCash").trim();
  const note = stringValue(formData, "note");

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return withSubmission(previousState, {
      status: "error",
      message: "รูปแบบวันที่ไม่ถูกต้อง",
      values: { dateKey, countedCash, note },
    });
  }

  if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(countedCash)) {
    return withSubmission(previousState, {
      status: "error",
      message: "ยอดเงินนับไม่ถูกต้อง",
      fieldErrors: { countedCash: ["กรุณากรอกตัวเลขจำนวนเงิน"] },
      values: { dateKey, countedCash, note },
    });
  }

  try {
    await saveDayClosing(
      { id: actor.id, role: actor.role },
      { dateKey, countedCash, note },
    );
  } catch (error) {
    if (error instanceof DayClosingError) {
      return withSubmission(previousState, {
        status: "error",
        message: error.message,
        values: { dateKey, countedCash, note },
      });
    }
    throw error;
  }

  redirect(`/closing?date=${encodeURIComponent(dateKey)}&saved=1`);
}
