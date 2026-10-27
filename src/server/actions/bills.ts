"use server";

import { redirect } from "next/navigation";

import type { ActionState } from "@/lib/action-state";
import {
  stringValue,
  withSubmission,
} from "@/server/actions/inventory-action-utils";
import { requireAdmin, requireUser } from "@/server/auth/session";
import { BillError, type BillErrorCode } from "@/server/services/bill-error";
import {
  approveBill,
  createBill,
  markBillPaid,
  rejectBill,
  submitBill,
  updateBill,
  voidBill,
} from "@/server/services/bills";
import {
  billApproveSchema,
  billCreateSchema,
  billPaySchema,
  billRejectSchema,
  billSubmitSchema,
  billUpdateSchema,
  billVoidSchema,
} from "@/server/validators/bills";
import { fieldErrorsFrom } from "@/server/validators/errors";

function parseJson(value: string): unknown {
  if (!value.trim()) {
    return undefined;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function billValues(formData: FormData): Record<string, string> {
  return {
    billTypeId: stringValue(formData, "billTypeId"),
    customerId: stringValue(formData, "customerId"),
    technicianId: stringValue(formData, "technicianId"),
    title: stringValue(formData, "title"),
    description: stringValue(formData, "description"),
    note: stringValue(formData, "note"),
    discountType: stringValue(formData, "discountType"),
    discountValue: stringValue(formData, "discountValue"),
    items: stringValue(formData, "items"),
    repair: stringValue(formData, "repair"),
    claim: stringValue(formData, "claim"),
  };
}

function billPayload(formData: FormData) {
  return {
    billTypeId: formData.get("billTypeId"),
    customerId: formData.get("customerId"),
    technicianId: formData.get("technicianId"),
    title: formData.get("title"),
    description: formData.get("description"),
    note: formData.get("note"),
    discountType: formData.get("discountType"),
    discountValue: formData.get("discountValue"),
    items: parseJson(stringValue(formData, "items")),
    repair: parseJson(stringValue(formData, "repair")),
    claim: parseJson(stringValue(formData, "claim")),
  };
}

const ERROR_FIELDS: Partial<Record<BillErrorCode, string>> = {
  CUSTOMER_INACTIVE: "customerId",
  TECHNICIAN_INVALID: "technicianId",
  BILL_TYPE_INACTIVE: "billTypeId",
  INVALID_DISCOUNT: "discountValue",
  REPAIR_DETAIL_REQUIRED: "repair",
  WARRANTY_CLAIM_REQUIRED: "claim",
  WARRANTY_OVERRIDE_REQUIRED: "overrideReason",
};

function billErrorState(
  previousState: ActionState,
  error: BillError,
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

export async function createBillAction(
  previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireUser();
  const parsed = billCreateSchema.safeParse(billPayload(formData));

  if (!parsed.success) {
    return withSubmission(previousState, {
      status: "error",
      message: "กรุณาตรวจสอบข้อมูลบิลและรายการสินค้า",
      fieldErrors: fieldErrorsFrom(parsed.error),
      values: billValues(formData),
    });
  }

  let billId: string;

  try {
    const bill = await createBill(
      { id: actor.id, role: actor.role },
      parsed.data,
    );
    billId = bill.id;
  } catch (error) {
    if (error instanceof BillError) {
      return billErrorState(previousState, error, billValues(formData));
    }
    throw error;
  }

  redirect(`/bills/${billId}?created=1`);
}

export async function updateBillAction(
  previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireUser();
  const parsed = billUpdateSchema.safeParse({
    ...billPayload(formData),
    billId: formData.get("billId"),
  });

  if (!parsed.success) {
    return withSubmission(previousState, {
      status: "error",
      message: "กรุณาตรวจสอบข้อมูลบิลและรายการสินค้า",
      fieldErrors: fieldErrorsFrom(parsed.error),
      values: billValues(formData),
    });
  }

  try {
    await updateBill(
      { id: actor.id, role: actor.role },
      parsed.data,
    );
  } catch (error) {
    if (error instanceof BillError) {
      return billErrorState(previousState, error, billValues(formData));
    }
    throw error;
  }

  redirect(`/bills/${parsed.data.billId}?updated=1`);
}

export async function submitBillAction(
  previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireUser();
  const parsed = billSubmitSchema.safeParse({
    billId: formData.get("billId"),
  });

  if (!parsed.success) {
    return withSubmission(previousState, {
      status: "error",
      message: "ไม่พบบิลที่ต้องการส่งอนุมัติ",
    });
  }

  try {
    await submitBill(
      { id: actor.id, role: actor.role },
      parsed.data.billId,
    );
  } catch (error) {
    if (error instanceof BillError) {
      return billErrorState(previousState, error);
    }
    throw error;
  }

  redirect(`/bills/${parsed.data.billId}?submitted=1`);
}

export async function approveBillAction(
  previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireAdmin();
  const parsed = billApproveSchema.safeParse({
    billId: formData.get("billId"),
    overrideReason: formData.get("overrideReason"),
  });

  if (!parsed.success) {
    return withSubmission(previousState, {
      status: "error",
      message: "กรุณาตรวจสอบข้อมูลการอนุมัติ",
      fieldErrors: fieldErrorsFrom(parsed.error),
    });
  }

  try {
    await approveBill(
      { id: actor.id, role: actor.role },
      parsed.data.billId,
      { overrideReason: parsed.data.overrideReason },
    );
  } catch (error) {
    if (error instanceof BillError) {
      return billErrorState(previousState, error);
    }
    throw error;
  }

  redirect(`/bills/${parsed.data.billId}?approved=1`);
}

export async function rejectBillAction(
  previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireAdmin();
  const parsed = billRejectSchema.safeParse({
    billId: formData.get("billId"),
    reason: formData.get("reason"),
  });

  if (!parsed.success) {
    return withSubmission(previousState, {
      status: "error",
      message: "กรุณาระบุเหตุผลการตีกลับ",
      fieldErrors: fieldErrorsFrom(parsed.error),
    });
  }

  try {
    await rejectBill(
      { id: actor.id, role: actor.role },
      parsed.data.billId,
      parsed.data.reason,
    );
  } catch (error) {
    if (error instanceof BillError) {
      return billErrorState(previousState, error);
    }
    throw error;
  }

  redirect(`/bills/${parsed.data.billId}?rejected=1`);
}

export async function payBillAction(
  previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireAdmin();
  const parsed = billPaySchema.safeParse({
    billId: formData.get("billId"),
    paymentMethod: formData.get("paymentMethod"),
  });

  if (!parsed.success) {
    return withSubmission(previousState, {
      status: "error",
      message: "กรุณาเลือกวิธีชำระเงิน",
      fieldErrors: fieldErrorsFrom(parsed.error),
    });
  }

  try {
    await markBillPaid(
      { id: actor.id, role: actor.role },
      parsed.data.billId,
      parsed.data.paymentMethod,
    );
  } catch (error) {
    if (error instanceof BillError) {
      return billErrorState(previousState, error);
    }
    throw error;
  }

  redirect(`/bills/${parsed.data.billId}?paid=1`);
}

export async function voidBillAction(
  previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireAdmin();
  const parsed = billVoidSchema.safeParse({
    billId: formData.get("billId"),
    reason: formData.get("reason"),
  });

  if (!parsed.success) {
    return withSubmission(previousState, {
      status: "error",
      message: "กรุณาระบุเหตุผลการยกเลิกบิล",
      fieldErrors: fieldErrorsFrom(parsed.error),
    });
  }

  try {
    await voidBill(
      { id: actor.id, role: actor.role },
      parsed.data.billId,
      parsed.data.reason,
    );
  } catch (error) {
    if (error instanceof BillError) {
      return billErrorState(previousState, error);
    }
    throw error;
  }

  redirect(`/bills/${parsed.data.billId}?voided=1`);
}
