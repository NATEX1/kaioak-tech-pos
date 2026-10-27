"use server";

import { redirect } from "next/navigation";

import type { ActionState } from "@/lib/action-state";
import { requireAdmin } from "@/server/auth/session";
import {
  stringValue,
  withSubmission,
} from "@/server/actions/inventory-action-utils";
import {
  CommissionError,
  type CommissionErrorCode,
} from "@/server/services/commission-error";
import {
  createCommissionPayout,
  createCommissionRule,
  setCommissionRuleActive,
  updateCommissionRule,
} from "@/server/services/commissions";
import {
  commissionPayoutSchema,
  commissionRuleSchema,
  commissionRuleStatusSchema,
  commissionRuleUpdateSchema,
} from "@/server/validators/commissions";
import { fieldErrorsFrom } from "@/server/validators/errors";

const ERROR_FIELDS: Partial<Record<CommissionErrorCode, string>> = {
  TECHNICIAN_INVALID: "technicianId",
  INVALID_SCOPE: "scope",
  INVALID_RULE_VALUE: "value",
  INVALID_PERIOD: "periodEnd",
};

function errorState(
  previousState: ActionState,
  error: CommissionError,
  values?: Record<string, string>,
): ActionState {
  const field = ERROR_FIELDS[error.code];

  return withSubmission(previousState, {
    status: "error",
    message: error.message,
    details: error.details,
    ...(field ? { fieldErrors: { [field]: [error.message] } } : {}),
    values,
  });
}

function ruleValues(formData: FormData): Record<string, string> {
  return {
    name: stringValue(formData, "name"),
    description: stringValue(formData, "description"),
    ruleType: stringValue(formData, "ruleType"),
    value: stringValue(formData, "value"),
    technicianId: stringValue(formData, "technicianId"),
    billTypeId: stringValue(formData, "billTypeId"),
    categoryId: stringValue(formData, "categoryId"),
    priority: stringValue(formData, "priority"),
    effectiveFrom: stringValue(formData, "effectiveFrom"),
    effectiveTo: stringValue(formData, "effectiveTo"),
    isActive: formData.get("isActive") === "on" ? "true" : "false",
  };
}

function rulePayload(formData: FormData) {
  return {
    name: formData.get("name"),
    description: formData.get("description"),
    ruleType: formData.get("ruleType"),
    value: formData.get("value"),
    technicianId: formData.get("technicianId"),
    billTypeId: formData.get("billTypeId"),
    categoryId: formData.get("categoryId"),
    priority: formData.get("priority"),
    effectiveFrom: formData.get("effectiveFrom"),
    effectiveTo: formData.get("effectiveTo"),
    isActive: formData.get("isActive") === "on",
  };
}

export async function createCommissionRuleAction(
  previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireAdmin();
  const parsed = commissionRuleSchema.safeParse(rulePayload(formData));

  if (!parsed.success) {
    return withSubmission(previousState, {
      status: "error",
      message: "กรุณาตรวจสอบข้อมูลกติกาคอมมิชชั่น",
      fieldErrors: fieldErrorsFrom(parsed.error),
      values: ruleValues(formData),
    });
  }

  let ruleId: string;

  try {
    const rule = await createCommissionRule(
      { id: actor.id, role: actor.role },
      parsed.data,
    );
    ruleId = rule.id;
  } catch (error) {
    if (error instanceof CommissionError) {
      return errorState(previousState, error, ruleValues(formData));
    }
    throw error;
  }

  redirect(`/commissions/rules/${ruleId}?created=1`);
}

export async function updateCommissionRuleAction(
  previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireAdmin();
  const parsed = commissionRuleUpdateSchema.safeParse({
    ...rulePayload(formData),
    ruleId: formData.get("ruleId"),
  });

  if (!parsed.success) {
    return withSubmission(previousState, {
      status: "error",
      message: "กรุณาตรวจสอบข้อมูลกติกาคอมมิชชั่น",
      fieldErrors: fieldErrorsFrom(parsed.error),
      values: ruleValues(formData),
    });
  }

  try {
    await updateCommissionRule(
      { id: actor.id, role: actor.role },
      parsed.data,
    );
  } catch (error) {
    if (error instanceof CommissionError) {
      return errorState(previousState, error, ruleValues(formData));
    }
    throw error;
  }

  redirect(`/commissions/rules/${parsed.data.ruleId}?updated=1`);
}

export async function setCommissionRuleActiveAction(
  previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireAdmin();
  const parsed = commissionRuleStatusSchema.safeParse({
    ruleId: formData.get("ruleId"),
    active: formData.get("active"),
  });

  if (!parsed.success) {
    return withSubmission(previousState, {
      status: "error",
      message: "ไม่พบกติกาที่ต้องการเปลี่ยนสถานะ",
    });
  }

  try {
    await setCommissionRuleActive(
      { id: actor.id, role: actor.role },
      parsed.data.ruleId,
      parsed.data.active,
    );
  } catch (error) {
    if (error instanceof CommissionError) {
      return errorState(previousState, error);
    }
    throw error;
  }

  redirect(
    parsed.data.active
      ? `/commissions/rules/${parsed.data.ruleId}?activated=1`
      : `/commissions/rules/${parsed.data.ruleId}?deactivated=1`,
  );
}

function payoutValues(formData: FormData): Record<string, string> {
  return {
    technicianId: stringValue(formData, "technicianId"),
    periodStart: stringValue(formData, "periodStart"),
    periodEnd: stringValue(formData, "periodEnd"),
    note: stringValue(formData, "note"),
  };
}

export async function createCommissionPayoutAction(
  previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireAdmin();
  const parsed = commissionPayoutSchema.safeParse({
    technicianId: formData.get("technicianId"),
    periodStart: formData.get("periodStart"),
    periodEnd: formData.get("periodEnd"),
    note: formData.get("note"),
  });

  if (!parsed.success) {
    return withSubmission(previousState, {
      status: "error",
      message: "กรุณาตรวจสอบข้อมูลรอบจ่ายค่าคอมมิชชั่น",
      fieldErrors: fieldErrorsFrom(parsed.error),
      values: payoutValues(formData),
    });
  }

  let payoutId: string;

  try {
    const payout = await createCommissionPayout(
      { id: actor.id, role: actor.role },
      parsed.data,
    );
    payoutId = payout.id;
  } catch (error) {
    if (error instanceof CommissionError) {
      return errorState(previousState, error, payoutValues(formData));
    }
    throw error;
  }

  redirect(`/commissions/payouts/${payoutId}?created=1`);
}
