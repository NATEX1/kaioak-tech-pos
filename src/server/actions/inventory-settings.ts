"use server";

import { redirect } from "next/navigation";

import type { ActionState } from "@/lib/action-state";
import { requireAdmin } from "@/server/auth/session";
import {
  inventoryErrorState,
  stringValue,
  withSubmission,
} from "@/server/actions/inventory-action-utils";
import { InventoryError } from "@/server/services/inventory-error";
import {
  createCategory,
  setCategoryActive,
  updateCategory,
} from "@/server/services/categories";
import {
  createSupplier,
  setSupplierActive,
  updateSupplier,
} from "@/server/services/suppliers";
import {
  categorySchema,
  categoryUpdateSchema,
  supplierSchema,
  supplierUpdateSchema,
} from "@/server/validators/inventory";
import { fieldErrorsFrom } from "@/server/validators/errors";

function categoryValues(formData: FormData): Record<string, string> {
  return {
    code: stringValue(formData, "code"),
    name: stringValue(formData, "name"),
    description: stringValue(formData, "description"),
  };
}

export async function createCategoryAction(
  previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireAdmin();
  const parsed = categorySchema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
    description: formData.get("description"),
  });

  if (!parsed.success) {
    return withSubmission(previousState, {
      status: "error",
      message: "กรุณาตรวจสอบข้อมูลหมวดหมู่",
      fieldErrors: fieldErrorsFrom(parsed.error),
      values: categoryValues(formData),
    });
  }

  let categoryId: string;

  try {
    const category = await createCategory(
      { id: actor.id, role: actor.role },
      parsed.data,
    );
    categoryId = category.id;
  } catch (error) {
    if (error instanceof InventoryError) {
      return inventoryErrorState(previousState, error, {
        values: categoryValues(formData),
      });
    }
    throw error;
  }

  redirect(`/inventory/categories/${categoryId}?created=1`);
}

export async function updateCategoryAction(
  previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireAdmin();
  const parsed = categoryUpdateSchema.safeParse({
    categoryId: formData.get("categoryId"),
    name: formData.get("name"),
    description: formData.get("description"),
  });

  if (!parsed.success) {
    return withSubmission(previousState, {
      status: "error",
      message: "กรุณาตรวจสอบข้อมูลหมวดหมู่",
      fieldErrors: fieldErrorsFrom(parsed.error),
      values: categoryValues(formData),
    });
  }

  try {
    await updateCategory({ id: actor.id, role: actor.role }, parsed.data);
  } catch (error) {
    if (error instanceof InventoryError) {
      return inventoryErrorState(previousState, error, {
        values: categoryValues(formData),
      });
    }
    throw error;
  }

  redirect(`/inventory/categories/${parsed.data.categoryId}?updated=1`);
}

export async function setCategoryActiveAction(
  previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireAdmin();
  const categoryId = stringValue(formData, "categoryId");
  const active = stringValue(formData, "active") === "true";

  if (!categoryId) {
    return withSubmission(previousState, {
      status: "error",
      message: "ไม่พบหมวดหมู่ที่ต้องการเปลี่ยนสถานะ",
    });
  }

  try {
    await setCategoryActive(
      { id: actor.id, role: actor.role },
      categoryId,
      active,
    );
  } catch (error) {
    if (error instanceof InventoryError) {
      return inventoryErrorState(previousState, error);
    }
    throw error;
  }

  redirect(
    active
      ? `/inventory/categories/${categoryId}?restored=1`
      : "/inventory/categories?archived=1",
  );
}

function supplierValues(formData: FormData): Record<string, string> {
  return {
    name: stringValue(formData, "name"),
    contactName: stringValue(formData, "contactName"),
    phone: stringValue(formData, "phone"),
    email: stringValue(formData, "email"),
    address: stringValue(formData, "address"),
    taxId: stringValue(formData, "taxId"),
    note: stringValue(formData, "note"),
  };
}

export async function createSupplierAction(
  previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireAdmin();
  const parsed = supplierSchema.safeParse({
    name: formData.get("name"),
    contactName: formData.get("contactName"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    address: formData.get("address"),
    taxId: formData.get("taxId"),
    note: formData.get("note"),
  });

  if (!parsed.success) {
    return withSubmission(previousState, {
      status: "error",
      message: "กรุณาตรวจสอบข้อมูลผู้จัดจำหน่าย",
      fieldErrors: fieldErrorsFrom(parsed.error),
      values: supplierValues(formData),
    });
  }

  let supplierId: string;

  try {
    const supplier = await createSupplier(
      { id: actor.id, role: actor.role },
      parsed.data,
    );
    supplierId = supplier.id;
  } catch (error) {
    if (error instanceof InventoryError) {
      return inventoryErrorState(previousState, error, {
        values: supplierValues(formData),
      });
    }
    throw error;
  }

  redirect(`/inventory/suppliers/${supplierId}?created=1`);
}

export async function updateSupplierAction(
  previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireAdmin();
  const parsed = supplierUpdateSchema.safeParse({
    supplierId: formData.get("supplierId"),
    name: formData.get("name"),
    contactName: formData.get("contactName"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    address: formData.get("address"),
    taxId: formData.get("taxId"),
    note: formData.get("note"),
  });

  if (!parsed.success) {
    return withSubmission(previousState, {
      status: "error",
      message: "กรุณาตรวจสอบข้อมูลผู้จัดจำหน่าย",
      fieldErrors: fieldErrorsFrom(parsed.error),
      values: supplierValues(formData),
    });
  }

  try {
    await updateSupplier(
      { id: actor.id, role: actor.role },
      parsed.data.supplierId,
      parsed.data,
    );
  } catch (error) {
    if (error instanceof InventoryError) {
      return inventoryErrorState(previousState, error, {
        values: supplierValues(formData),
      });
    }
    throw error;
  }

  redirect(`/inventory/suppliers/${parsed.data.supplierId}?updated=1`);
}

export async function setSupplierActiveAction(
  previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireAdmin();
  const supplierId = stringValue(formData, "supplierId");
  const active = stringValue(formData, "active") === "true";

  if (!supplierId) {
    return withSubmission(previousState, {
      status: "error",
      message: "ไม่พบผู้จัดจำหน่ายที่ต้องการเปลี่ยนสถานะ",
    });
  }

  try {
    await setSupplierActive(
      { id: actor.id, role: actor.role },
      supplierId,
      active,
    );
  } catch (error) {
    if (error instanceof InventoryError) {
      return inventoryErrorState(previousState, error);
    }
    throw error;
  }

  redirect(
    active
      ? `/inventory/suppliers/${supplierId}?restored=1`
      : "/inventory/suppliers?archived=1",
  );
}
