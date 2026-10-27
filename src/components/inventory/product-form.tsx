"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Barcode, Save, TriangleAlert } from "lucide-react";

import {
  ActionFeedback,
  FieldError,
} from "@/components/forms/form-feedback";
import { SubmitButton } from "@/components/forms/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
import { inputClassName, selectClassName } from "@/lib/form-styles";
import { cn } from "@/lib/utils";
import {
  createProductAction,
  updateProductAction,
} from "@/server/actions/products";

type CategoryOption = { id: string; code: string; name: string };
type SupplierOption = { id: string; name: string };

export type ProductFormInitial = {
  name: string;
  sku: string;
  categoryId: string;
  defaultSupplierId: string;
  brand: string;
  model: string;
  description: string;
  costPrice: string;
  salePrice: string;
  reorderLevel: string;
  warrantyMonths: string;
  trackSerial: boolean;
};

type ProductFormProps = {
  mode: "create" | "edit";
  categories: CategoryOption[];
  suppliers: SupplierOption[];
  productId?: string;
  initial?: ProductFormInitial;
  trackSerialLocked?: boolean;
};

export function ProductForm({
  mode,
  categories,
  suppliers,
  productId,
  initial,
  trackSerialLocked = false,
}: ProductFormProps) {
  const action = mode === "create" ? createProductAction : updateProductAction;
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);
  const values = state.values;
  const fieldErrors = state.fieldErrors;

  const value = (name: string, fallback = "") =>
    values?.[name] ?? fallback;
  const categoryValue = value("categoryId", initial?.categoryId ?? "");
  const supplierValue = value(
    "defaultSupplierId",
    initial?.defaultSupplierId ?? "",
  );
  const trackSerialValue =
    values?.trackSerial ?? (initial?.trackSerial ? "true" : "false");
  const trackSerialChecked = trackSerialValue === "true";
  const cancelHref =
    mode === "edit" && productId
      ? `/inventory/products/${productId}`
      : "/inventory/products";

  return (
    <form
      key={state.submissionId ?? 0}
      action={formAction}
      className="space-y-6"
      autoComplete="off"
    >
      {mode === "edit" && productId ? (
        <input type="hidden" name="productId" value={productId} />
      ) : null}

      <ActionFeedback state={state} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <section className="rounded-xl border bg-background p-4 shadow-xs sm:p-5">
            <div className="mb-4">
              <h3 className="font-semibold">ข้อมูลสินค้า</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                ชื่อและรหัสที่ใช้ค้นหาในหน้ารับสินค้าและหน้าเปิดบิล
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="name">ชื่อสินค้า *</Label>
                <Input
                  id="name"
                  name="name"
                  required
                  maxLength={150}
                  defaultValue={value("name", initial?.name ?? "")}
                  aria-invalid={Boolean(fieldErrors?.name)}
                  className={inputClassName}
                  placeholder="เช่น การ์ดจอ ASUS RTX 4060"
                />
                <FieldError fieldErrors={fieldErrors} field="name" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="categoryId">หมวดหมู่ *</Label>
                <select
                  id="categoryId"
                  name="categoryId"
                  required
                  defaultValue={categoryValue}
                  aria-invalid={Boolean(fieldErrors?.categoryId)}
                  className={selectClassName}
                >
                  <option value="">เลือกหมวดหมู่</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.code} · {category.name}
                    </option>
                  ))}
                </select>
                <FieldError fieldErrors={fieldErrors} field="categoryId" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="defaultSupplierId">ผู้จัดจำหน่ายหลัก</Label>
                <select
                  id="defaultSupplierId"
                  name="defaultSupplierId"
                  defaultValue={supplierValue}
                  aria-invalid={Boolean(fieldErrors?.defaultSupplierId)}
                  className={selectClassName}
                >
                  <option value="">ไม่ระบุ</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
                <FieldError
                  fieldErrors={fieldErrors}
                  field="defaultSupplierId"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sku">
                  SKU {mode === "edit" ? "*" : "(เว้นว่างเพื่อสร้างอัตโนมัติ)"}
                </Label>
                <Input
                  id="sku"
                  name="sku"
                  required={mode === "edit"}
                  maxLength={64}
                  defaultValue={value("sku", initial?.sku ?? "")}
                  aria-invalid={Boolean(fieldErrors?.sku)}
                  className={cn(inputClassName, "font-mono uppercase")}
                  placeholder={
                    mode === "create" ? "เช่น CPU-0001" : initial?.sku
                  }
                />
                <FieldError fieldErrors={fieldErrors} field="sku" />
                {mode === "create" ? (
                  <p className="text-[11px] text-muted-foreground">
                    ระบบจะสร้าง SKU จากรหัสหมวดหมู่และลำดับถัดไป
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="brand">แบรนด์</Label>
                <Input
                  id="brand"
                  name="brand"
                  maxLength={100}
                  defaultValue={value("brand", initial?.brand ?? "")}
                  className={inputClassName}
                  placeholder="เช่น ASUS"
                />
                <FieldError fieldErrors={fieldErrors} field="brand" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="model">รุ่น</Label>
                <Input
                  id="model"
                  name="model"
                  maxLength={100}
                  defaultValue={value("model", initial?.model ?? "")}
                  className={inputClassName}
                  placeholder="เช่น DUAL-RTX4060-O8G"
                />
                <FieldError fieldErrors={fieldErrors} field="model" />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="description">รายละเอียด</Label>
                <Textarea
                  id="description"
                  name="description"
                  maxLength={2000}
                  defaultValue={value(
                    "description",
                    initial?.description ?? "",
                  )}
                  className="min-h-20"
                  placeholder="สเปกหรือหมายเหตุเพิ่มเติม"
                />
                <FieldError fieldErrors={fieldErrors} field="description" />
              </div>
            </div>
          </section>

          {mode === "edit" ? (
            <section className="rounded-xl border bg-background p-4 shadow-xs sm:p-5">
              <div className="mb-4">
                <h3 className="font-semibold">บาร์โค้ด</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  เพิ่มบาร์โค้ดได้หลายรายการจากหน้าสินค้า หลังบันทึกข้อมูลแล้ว
                </p>
              </div>
              <Link
                href={`/inventory/products/${productId}#barcodes`}
                className={cn(buttonVariants({ variant: "outline" }), "h-9")}
              >
                <Barcode aria-hidden />
                จัดการบาร์โค้ด
              </Link>
            </section>
          ) : null}
        </div>

        <div className="space-y-6">
          <section className="rounded-xl border bg-background p-4 shadow-xs sm:p-5">
            <div className="mb-4">
              <h3 className="font-semibold">ราคาและสต๊อก</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                ราคาขายเป็นราคารวม VAT ตามนโยบายร้าน
              </p>
            </div>
            <div className="space-y-4">
              {mode === "create" ? (
                <div className="space-y-2">
                  <Label htmlFor="costPrice">ต้นทุนเริ่มต้น (บาท)</Label>
                  <Input
                    id="costPrice"
                    name="costPrice"
                    inputMode="decimal"
                    defaultValue={value(
                      "costPrice",
                      initial?.costPrice ?? "0.00",
                    )}
                    aria-invalid={Boolean(fieldErrors?.costPrice)}
                    className={inputClassName}
                    placeholder="0.00"
                  />
                  <FieldError fieldErrors={fieldErrors} field="costPrice" />
                  <p className="text-[11px] text-muted-foreground">
                    ต้นทุนจริงจะถูกคำนวณใหม่จากใบรับสินค้าแบบถัวเฉลี่ย
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-800 dark:text-amber-200">
                  <div className="flex gap-2">
                    <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                    <p>
                      ต้นทุนเฉลี่ยปัจจุบัน{" "}
                      <span className="font-semibold">
                        {initial?.costPrice ?? "0.00"} บาท
                      </span>{" "}
                      แก้ไขโดยตรงไม่ได้ เพื่อรักษาประวัติต้นทุนจากใบรับสินค้า
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="salePrice">ราคาขาย *</Label>
                <Input
                  id="salePrice"
                  name="salePrice"
                  inputMode="decimal"
                  required
                  defaultValue={value(
                    "salePrice",
                    initial?.salePrice ?? "",
                  )}
                  aria-invalid={Boolean(fieldErrors?.salePrice)}
                  className={inputClassName}
                  placeholder="0.00"
                />
                <FieldError fieldErrors={fieldErrors} field="salePrice" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="reorderLevel">จุดสั่งซื้อ</Label>
                  <Input
                    id="reorderLevel"
                    name="reorderLevel"
                    type="number"
                    min={0}
                    step={1}
                    defaultValue={value(
                      "reorderLevel",
                      initial?.reorderLevel ?? "5",
                    )}
                    aria-invalid={Boolean(fieldErrors?.reorderLevel)}
                    className={inputClassName}
                  />
                  <FieldError
                    fieldErrors={fieldErrors}
                    field="reorderLevel"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="warrantyMonths">ประกัน (เดือน)</Label>
                  <Input
                    id="warrantyMonths"
                    name="warrantyMonths"
                    type="number"
                    min={0}
                    max={1200}
                    step={1}
                    defaultValue={value(
                      "warrantyMonths",
                      initial?.warrantyMonths ?? "12",
                    )}
                    aria-invalid={Boolean(fieldErrors?.warrantyMonths)}
                    className={inputClassName}
                  />
                  <FieldError
                    fieldErrors={fieldErrors}
                    field="warrantyMonths"
                  />
                </div>
              </div>

              <div className="rounded-lg border bg-muted/30 p-3">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    name={trackSerialLocked ? undefined : "trackSerial"}
                    defaultChecked={trackSerialChecked}
                    disabled={trackSerialLocked}
                    className="mt-0.5 size-4 accent-primary"
                  />
                  <span>
                    <span className="block text-sm font-medium">
                      ติดตาม Serial Number
                    </span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                      เปิดสำหรับสินค้าที่มีเลขเครื่องและต้องตรวจประกันรายชิ้น
                    </span>
                  </span>
                </label>
                {trackSerialLocked ? (
                  <>
                    <input
                      type="hidden"
                      name="trackSerial"
                      value={trackSerialValue}
                    />
                    <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-300">
                      ไม่สามารถเปลี่ยนได้เมื่อมีสต๊อกหรือประวัติ Serial แล้ว
                    </p>
                  </>
                ) : null}
                <FieldError fieldErrors={fieldErrors} field="trackSerial" />
              </div>
            </div>
          </section>

          {mode === "create" ? (
            <section className="rounded-xl border bg-background p-4 shadow-xs sm:p-5">
              <div className="mb-4">
                <h3 className="font-semibold">บาร์โค้ดหลัก</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  ไม่บังคับ สามารถเว้นว่างและเพิ่มภายหลังได้
                </p>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="primaryBarcode">บาร์โค้ด</Label>
                  <Input
                    id="primaryBarcode"
                    name="primaryBarcode"
                    maxLength={64}
                    defaultValue={value("primaryBarcode")}
                    aria-invalid={Boolean(fieldErrors?.primaryBarcode)}
                    className={cn(inputClassName, "font-mono")}
                    placeholder="สแกนหรือพิมพ์บาร์โค้ด"
                  />
                  <FieldError
                    fieldErrors={fieldErrors}
                    field="primaryBarcode"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="primaryBarcodeType">ชนิดบาร์โค้ด</Label>
                  <select
                    id="primaryBarcodeType"
                    name="primaryBarcodeType"
                    defaultValue={value(
                      "primaryBarcodeType",
                      "CODE128",
                    )}
                    className={selectClassName}
                  >
                    <option value="CODE128">Code 128</option>
                    <option value="EAN13">EAN-13</option>
                  </select>
                </div>
              </div>
            </section>
          ) : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Link
              href={cancelHref}
              className={cn(buttonVariants({ variant: "outline" }), "h-10")}
            >
              ยกเลิก
            </Link>
            <SubmitButton className="h-10" pendingText="กำลังบันทึก...">
              <Save aria-hidden />
              {mode === "create" ? "สร้างสินค้า" : "บันทึกการแก้ไข"}
            </SubmitButton>
          </div>
        </div>
      </div>
    </form>
  );
}
