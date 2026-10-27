"use server";

import { redirect } from "next/navigation";

import type { ActionState } from "@/lib/action-state";
import { requireAdmin } from "@/server/auth/session";
import {
  checkboxValue,
  inventoryErrorState,
  stringValue,
  withSubmission,
} from "@/server/actions/inventory-action-utils";
import { InventoryError } from "@/server/services/inventory-error";
import {
  addProductBarcode,
  createProduct,
  removeProductBarcode,
  setPrimaryProductBarcode,
  setProductActive,
  updateProduct,
} from "@/server/services/products";
import {
  importProductsCsv,
  MAX_IMPORT_ROWS,
} from "@/server/services/product-import";
import {
  barcodeFieldsSchema,
  productCreateSchema,
  productUpdateSchema,
} from "@/server/validators/inventory";
import { fieldErrorsFrom } from "@/server/validators/errors";

const MAX_CSV_BYTES = 2 * 1024 * 1024;

function productFormValues(formData: FormData): Record<string, string> {
  return {
    name: stringValue(formData, "name"),
    sku: stringValue(formData, "sku"),
    categoryId: stringValue(formData, "categoryId"),
    defaultSupplierId: stringValue(formData, "defaultSupplierId"),
    brand: stringValue(formData, "brand"),
    model: stringValue(formData, "model"),
    description: stringValue(formData, "description"),
    costPrice: stringValue(formData, "costPrice"),
    salePrice: stringValue(formData, "salePrice"),
    reorderLevel: stringValue(formData, "reorderLevel"),
    warrantyMonths: stringValue(formData, "warrantyMonths"),
    trackSerial: checkboxValue(formData, "trackSerial"),
    primaryBarcode: stringValue(formData, "primaryBarcode"),
    primaryBarcodeType: stringValue(formData, "primaryBarcodeType"),
  };
}

export async function createProductAction(
  previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireAdmin();
  const parsed = productCreateSchema.safeParse({
    name: formData.get("name"),
    sku: formData.get("sku"),
    categoryId: formData.get("categoryId"),
    defaultSupplierId: formData.get("defaultSupplierId"),
    brand: formData.get("brand"),
    model: formData.get("model"),
    description: formData.get("description"),
    costPrice: formData.get("costPrice"),
    salePrice: formData.get("salePrice"),
    reorderLevel: formData.get("reorderLevel"),
    warrantyMonths: formData.get("warrantyMonths"),
    trackSerial: formData.get("trackSerial"),
    primaryBarcode: formData.get("primaryBarcode"),
    primaryBarcodeType: formData.get("primaryBarcodeType"),
  });

  if (!parsed.success) {
    return withSubmission(previousState, {
      status: "error",
      message: "กรุณาตรวจสอบข้อมูลสินค้า",
      fieldErrors: fieldErrorsFrom(parsed.error),
      values: productFormValues(formData),
    });
  }

  let productId: string;

  try {
    const product = await createProduct(
      { id: actor.id, role: actor.role },
      {
        name: parsed.data.name,
        sku: parsed.data.sku,
        categoryId: parsed.data.categoryId,
        defaultSupplierId: parsed.data.defaultSupplierId,
        brand: parsed.data.brand,
        model: parsed.data.model,
        description: parsed.data.description,
        costPrice: parsed.data.costPrice,
        salePrice: parsed.data.salePrice,
        reorderLevel: parsed.data.reorderLevel,
        warrantyMonths: parsed.data.warrantyMonths,
        trackSerial: parsed.data.trackSerial,
        primaryBarcode: parsed.data.primaryBarcode,
        primaryBarcodeType: parsed.data.primaryBarcodeType,
      },
    );
    productId = product.id;
  } catch (error) {
    if (error instanceof InventoryError) {
      return inventoryErrorState(previousState, error, {
        values: productFormValues(formData),
      });
    }
    throw error;
  }

  redirect(`/inventory/products/${productId}?created=1`);
}

export async function updateProductAction(
  previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireAdmin();
  const parsed = productUpdateSchema.safeParse({
    productId: formData.get("productId"),
    name: formData.get("name"),
    sku: formData.get("sku"),
    categoryId: formData.get("categoryId"),
    defaultSupplierId: formData.get("defaultSupplierId"),
    brand: formData.get("brand"),
    model: formData.get("model"),
    description: formData.get("description"),
    salePrice: formData.get("salePrice"),
    reorderLevel: formData.get("reorderLevel"),
    warrantyMonths: formData.get("warrantyMonths"),
    trackSerial: formData.get("trackSerial"),
  });

  if (!parsed.success) {
    return withSubmission(previousState, {
      status: "error",
      message: "กรุณาตรวจสอบข้อมูลสินค้า",
      fieldErrors: fieldErrorsFrom(parsed.error),
      values: productFormValues(formData),
    });
  }

  try {
    await updateProduct({ id: actor.id, role: actor.role }, parsed.data);
  } catch (error) {
    if (error instanceof InventoryError) {
      return inventoryErrorState(previousState, error, {
        values: productFormValues(formData),
      });
    }
    throw error;
  }

  redirect(`/inventory/products/${parsed.data.productId}?updated=1`);
}

export async function setProductActiveAction(
  previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireAdmin();
  const productId = stringValue(formData, "productId");
  const active = stringValue(formData, "active") === "true";

  if (!productId) {
    return withSubmission(previousState, {
      status: "error",
      message: "ไม่พบสินค้าที่ต้องการเปลี่ยนสถานะ",
    });
  }

  try {
    await setProductActive({ id: actor.id, role: actor.role }, productId, active);
  } catch (error) {
    if (error instanceof InventoryError) {
      return inventoryErrorState(previousState, error);
    }
    throw error;
  }

  redirect(
    `/inventory/products/${productId}?${active ? "restored" : "archived"}=1`,
  );
}

function barcodeFormValues(formData: FormData): Record<string, string> {
  return {
    barcode: stringValue(formData, "barcode"),
    type: stringValue(formData, "type"),
    isPrimary: checkboxValue(formData, "isPrimary"),
  };
}

export async function addBarcodeAction(
  previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireAdmin();
  const productId = stringValue(formData, "productId");
  const parsed = barcodeFieldsSchema.safeParse({
    barcode: formData.get("barcode"),
    type: formData.get("type"),
    isPrimary: formData.get("isPrimary"),
  });

  if (!parsed.success) {
    return withSubmission(previousState, {
      status: "error",
      message: "กรุณาตรวจสอบบาร์โค้ด",
      fieldErrors: fieldErrorsFrom(parsed.error),
      values: barcodeFormValues(formData),
    });
  }

  try {
    await addProductBarcode(
      { id: actor.id, role: actor.role },
      { productId, ...parsed.data },
    );
  } catch (error) {
    if (error instanceof InventoryError) {
      return inventoryErrorState(previousState, error, {
        values: barcodeFormValues(formData),
        field: "barcode",
      });
    }
    throw error;
  }

  redirect(`/inventory/products/${productId}?barcode=added`);
}

export async function removeBarcodeAction(
  previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireAdmin();
  const productId = stringValue(formData, "productId");
  const barcodeId = stringValue(formData, "barcodeId");

  if (!productId || !barcodeId) {
    return withSubmission(previousState, {
      status: "error",
      message: "ไม่พบบาร์โค้ดที่ต้องการลบ",
    });
  }

  try {
    await removeProductBarcode(
      { id: actor.id, role: actor.role },
      productId,
      barcodeId,
    );
  } catch (error) {
    if (error instanceof InventoryError) {
      return inventoryErrorState(previousState, error);
    }
    throw error;
  }

  redirect(`/inventory/products/${productId}?barcode=removed`);
}

export async function setPrimaryBarcodeAction(
  previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireAdmin();
  const productId = stringValue(formData, "productId");
  const barcodeId = stringValue(formData, "barcodeId");

  if (!productId || !barcodeId) {
    return withSubmission(previousState, {
      status: "error",
      message: "ไม่พบบาร์โค้ดที่ต้องการตั้งเป็นหลัก",
    });
  }

  try {
    await setPrimaryProductBarcode(
      { id: actor.id, role: actor.role },
      productId,
      barcodeId,
    );
  } catch (error) {
    if (error instanceof InventoryError) {
      return inventoryErrorState(previousState, error);
    }
    throw error;
  }

  redirect(`/inventory/products/${productId}?barcode=primary`);
}

export async function importProductsAction(
  previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireAdmin();
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return withSubmission(previousState, {
      status: "error",
      message: "กรุณาเลือกไฟล์ CSV",
      fieldErrors: { file: ["กรุณาเลือกไฟล์ CSV"] },
    });
  }

  if (file.size > MAX_CSV_BYTES) {
    return withSubmission(previousState, {
      status: "error",
      message: "ไฟล์ CSV ต้องมีขนาดไม่เกิน 2 MB",
      fieldErrors: { file: ["ไฟล์ CSV ต้องมีขนาดไม่เกิน 2 MB"] },
    });
  }

  if (!file.name.toLowerCase().endsWith(".csv")) {
    return withSubmission(previousState, {
      status: "error",
      message: "รองรับเฉพาะไฟล์นามสกุล .csv",
      fieldErrors: { file: ["รองรับเฉพาะไฟล์นามสกุล .csv"] },
    });
  }

  let result: { created: number; updated: number; total: number };

  try {
    result = await importProductsCsv(
      { id: actor.id, role: actor.role },
      await file.text(),
    );
  } catch (error) {
    if (error instanceof InventoryError) {
      return inventoryErrorState(previousState, error);
    }
    throw error;
  }

  const params = new URLSearchParams({
    created: String(result.created),
    updated: String(result.updated),
    total: String(result.total),
    limit: String(MAX_IMPORT_ROWS),
  });

  redirect(`/inventory/import?${params.toString()}`);
}
