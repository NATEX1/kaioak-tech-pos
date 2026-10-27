"use server";

import { redirect } from "next/navigation";

import type { ActionState } from "@/lib/action-state";
import { requireAdmin, requireUser } from "@/server/auth/session";
import {
  stringValue,
  withSubmission,
} from "@/server/actions/inventory-action-utils";
import { CustomerError } from "@/server/services/customer-error";
import {
  createCustomer,
  setCustomerActive,
  updateCustomer,
} from "@/server/services/customers";
import {
  customerCreateSchema,
  customerUpdateSchema,
} from "@/server/validators/customers";
import { fieldErrorsFrom } from "@/server/validators/errors";

function customerValues(formData: FormData): Record<string, string> {
  return {
    name: stringValue(formData, "name"),
    phone: stringValue(formData, "phone"),
    email: stringValue(formData, "email"),
    address: stringValue(formData, "address"),
    taxId: stringValue(formData, "taxId"),
    note: stringValue(formData, "note"),
  };
}

function customerErrorState(
  previousState: ActionState,
  error: CustomerError,
  values?: Record<string, string>,
): ActionState {
  return withSubmission(previousState, {
    status: "error",
    message: error.message,
    ...(error.code === "PHONE_EXISTS"
      ? { fieldErrors: { phone: [error.message] } }
      : {}),
    values,
  });
}

export async function createCustomerAction(
  previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireUser();
  const parsed = customerCreateSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    address: formData.get("address"),
    taxId: formData.get("taxId"),
    note: formData.get("note"),
  });

  if (!parsed.success) {
    return withSubmission(previousState, {
      status: "error",
      message: "กรุณาตรวจสอบข้อมูลลูกค้า",
      fieldErrors: fieldErrorsFrom(parsed.error),
      values: customerValues(formData),
    });
  }

  let customerId: string;

  try {
    const customer = await createCustomer(
      { id: actor.id, role: actor.role },
      parsed.data,
    );
    customerId = customer.id;
  } catch (error) {
    if (error instanceof CustomerError) {
      return customerErrorState(
        previousState,
        error,
        customerValues(formData),
      );
    }
    throw error;
  }

  redirect(`/customers/${customerId}?created=1`);
}

export async function updateCustomerAction(
  previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireAdmin();
  const parsed = customerUpdateSchema.safeParse({
    customerId: formData.get("customerId"),
    name: formData.get("name"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    address: formData.get("address"),
    taxId: formData.get("taxId"),
    note: formData.get("note"),
  });

  if (!parsed.success) {
    return withSubmission(previousState, {
      status: "error",
      message: "กรุณาตรวจสอบข้อมูลลูกค้า",
      fieldErrors: fieldErrorsFrom(parsed.error),
      values: customerValues(formData),
    });
  }

  try {
    await updateCustomer(
      { id: actor.id, role: actor.role },
      parsed.data.customerId,
      parsed.data,
    );
  } catch (error) {
    if (error instanceof CustomerError) {
      return customerErrorState(
        previousState,
        error,
        customerValues(formData),
      );
    }
    throw error;
  }

  redirect(`/customers/${parsed.data.customerId}?updated=1`);
}

export async function setCustomerActiveAction(
  previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireAdmin();
  const customerId = stringValue(formData, "customerId");
  const active = stringValue(formData, "active") === "true";

  if (!customerId) {
    return withSubmission(previousState, {
      status: "error",
      message: "ไม่พบลูกค้าที่ต้องการเปลี่ยนสถานะ",
    });
  }

  try {
    await setCustomerActive(
      { id: actor.id, role: actor.role },
      customerId,
      active,
    );
  } catch (error) {
    if (error instanceof CustomerError) {
      return customerErrorState(previousState, error);
    }
    throw error;
  }

  redirect(
    active
      ? `/customers/${customerId}?restored=1`
      : "/customers?status=archived&archived=1",
  );
}
