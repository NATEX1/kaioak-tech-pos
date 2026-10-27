import { z } from "zod";

import { isValidBarcode, normalizeBarcode } from "@/lib/barcode";
import { Decimal } from "@/lib/money";

const MAX_MONEY = new Decimal("9999999999.99");
const MONEY_PATTERN = /^\d{1,10}(?:\.\d{1,2})?$/;

const idSchema = z.string().trim().min(1).max(64);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value === "" ? undefined : value));

const moneySchema = z
  .string()
  .trim()
  .min(1, "กรุณากรอกจำนวนเงิน")
  .refine((value) => MONEY_PATTERN.test(value), "รูปแบบจำนวนเงินไม่ถูกต้อง")
  .refine(
    (value) => new Decimal(value).lessThanOrEqualTo(MAX_MONEY),
    "จำนวนเงินเกินกำหนด",
  )
  .transform((value) => new Decimal(value).toFixed(2));

const optionalMoneySchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? "0" : value),
  moneySchema,
);

const booleanSchema = z.preprocess(
  (value) => value === "on" || value === "true" || value === true,
  z.boolean(),
);

const integerSchema = (label: string, max: number) =>
  z.preprocess(
    (value) => (value === "" || value === undefined || value === null ? "0" : value),
    z.coerce
      .number()
      .int(`${label}ต้องเป็นจำนวนเต็ม`)
      .min(0, `${label}ต้องไม่ติดลบ`)
      .max(max, `${label}เกินกำหนด`),
  );

export const categorySchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, "รหัสหมวดหมู่ต้องมีอย่างน้อย 2 ตัวอักษร")
    .max(20, "รหัสหมวดหมู่ยาวเกินกำหนด")
    .transform((value) => value.toUpperCase())
    .refine(
      (value) => /^[A-Z0-9]+$/.test(value),
      "รหัสหมวดหมู่ใช้ได้เฉพาะ A-Z และตัวเลข",
    ),
  name: z
    .string()
    .trim()
    .min(2, "ชื่อหมวดหมู่ต้องมีอย่างน้อย 2 ตัวอักษร")
    .max(100, "ชื่อหมวดหมู่ยาวเกินกำหนด"),
  description: optionalText(2000),
});

export const categoryUpdateSchema = categorySchema.omit({ code: true }).extend({
  categoryId: idSchema,
});

export const supplierSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "ชื่อผู้จัดจำหน่ายต้องมีอย่างน้อย 2 ตัวอักษร")
    .max(200, "ชื่อผู้จัดจำหน่ายยาวเกินกำหนด"),
  contactName: optionalText(150),
  phone: z
    .string()
    .trim()
    .max(32, "เบอร์โทรยาวเกินกำหนด")
    .optional()
    .refine(
      (value) => !value || /^[0-9+\-() ]+$/.test(value),
      "รูปแบบเบอร์โทรไม่ถูกต้อง",
    )
    .transform((value) => (value === "" ? undefined : value)),
  email: z
    .string()
    .trim()
    .max(254)
    .optional()
    .refine(
      (value) => !value || z.string().email().safeParse(value).success,
      "รูปแบบอีเมลไม่ถูกต้อง",
    )
    .transform((value) => (value === "" ? undefined : value)),
  address: optionalText(2000),
  taxId: optionalText(20),
  note: optionalText(2000),
});

export const supplierUpdateSchema = supplierSchema.extend({
  supplierId: idSchema,
});

const skuSchema = z
  .string()
  .trim()
  .min(1, "กรุณากรอก SKU")
  .max(64, "SKU ยาวเกินกำหนด")
  .transform((value) => value.toUpperCase())
  .refine(
    (value) => /^[A-Z0-9][A-Z0-9_-]*$/.test(value),
    "SKU ใช้ได้เฉพาะ A-Z ตัวเลข ขีดกลาง และขีดล่าง",
  );

const optionalSkuSchema = z
  .string()
  .trim()
  .max(64, "SKU ยาวเกินกำหนด")
  .transform((value) => value.toUpperCase())
  .refine(
    (value) => value === "" || /^[A-Z0-9][A-Z0-9_-]*$/.test(value),
    "SKU ใช้ได้เฉพาะ A-Z ตัวเลข ขีดกลาง และขีดล่าง",
  )
  .transform((value) => (value === "" ? undefined : value));

export const barcodeFieldsSchema = z
  .object({
    barcode: z
      .string()
      .trim()
      .min(1, "กรุณากรอกบาร์โค้ด")
      .max(64, "บาร์โค้ดยาวเกินกำหนด")
      .transform(normalizeBarcode),
    type: z.enum(["CODE128", "EAN13"]).default("CODE128"),
    isPrimary: booleanSchema.optional().default(false),
  })
  .superRefine((value, context) => {
    if (!isValidBarcode(value.barcode, value.type)) {
      context.addIssue({
        code: "custom",
        path: ["barcode"],
        message:
          value.type === "EAN13"
            ? "EAN-13 ต้องเป็นตัวเลข 13 หลักและ checksum ถูกต้อง"
            : "บาร์โค้ด Code 128 ต้องเป็นตัวอักษร ASCII 1–64 ตัว",
      });
    }
  });

export const productCreateSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "ชื่อสินค้าต้องมีอย่างน้อย 2 ตัวอักษร")
      .max(150, "ชื่อสินค้ายาวเกินกำหนด"),
    sku: optionalSkuSchema,
    categoryId: idSchema,
    defaultSupplierId: z
      .string()
      .trim()
      .optional()
      .transform((value) => (value === "" ? undefined : value)),
    brand: optionalText(100),
    model: optionalText(100),
    description: optionalText(2000),
    costPrice: optionalMoneySchema,
    salePrice: moneySchema,
    reorderLevel: integerSchema("จุดสั่งซื้อ", 1_000_000),
    warrantyMonths: integerSchema("ระยะประกัน", 1_200),
    trackSerial: booleanSchema,
    primaryBarcode: z
      .string()
      .trim()
      .max(64, "บาร์โค้ดยาวเกินกำหนด")
      .transform(normalizeBarcode)
      .optional(),
    primaryBarcodeType: z.enum(["CODE128", "EAN13"]).default("CODE128"),
  })
  .superRefine((value, context) => {
    if (
      value.primaryBarcode &&
      !isValidBarcode(value.primaryBarcode, value.primaryBarcodeType)
    ) {
      context.addIssue({
        code: "custom",
        path: ["primaryBarcode"],
        message:
          value.primaryBarcodeType === "EAN13"
            ? "EAN-13 ต้องเป็นตัวเลข 13 หลักและ checksum ถูกต้อง"
            : "บาร์โค้ด Code 128 ต้องเป็นตัวอักษร ASCII 1–64 ตัว",
      });
    }
  });

export const productUpdateSchema = z.object({
  productId: idSchema,
  name: z
    .string()
    .trim()
    .min(2, "ชื่อสินค้าต้องมีอย่างน้อย 2 ตัวอักษร")
    .max(150, "ชื่อสินค้ายาวเกินกำหนด"),
  sku: skuSchema,
  categoryId: idSchema,
  defaultSupplierId: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value === "" ? undefined : value)),
  brand: optionalText(100),
  model: optionalText(100),
  description: optionalText(2000),
  salePrice: moneySchema,
  reorderLevel: integerSchema("จุดสั่งซื้อ", 1_000_000),
  warrantyMonths: integerSchema("ระยะประกัน", 1_200),
  trackSerial: booleanSchema,
});

export const serialNumbersSchema = z
  .array(z.string().trim().min(1).max(128))
  .max(10_000);

export const stockAdjustmentSchema = z.object({
  productId: idSchema,
  direction: z.enum(["IN", "OUT"]),
  quantity: z.coerce
    .number()
    .int("จำนวนต้องเป็นจำนวนเต็ม")
    .min(1, "จำนวนต้องมากกว่า 0")
    .max(10_000, "จำนวนเกินกำหนด"),
  unitCost: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value === "" ? undefined : value))
    .refine(
      (value) => value === undefined || MONEY_PATTERN.test(value),
      "รูปแบบต้นทุนไม่ถูกต้อง",
    ),
  reason: z
    .string()
    .trim()
    .min(3, "กรุณาระบุเหตุผลอย่างน้อย 3 ตัวอักษร")
    .max(500, "เหตุผลยาวเกินกำหนด"),
  serialNumbers: z.array(z.string().trim().min(1).max(128)).max(10_000),
});

export const goodsReceiptItemSchema = z.object({
  productId: idSchema,
  quantity: z.coerce
    .number()
    .int("จำนวนต้องเป็นจำนวนเต็ม")
    .min(1, "จำนวนต้องมากกว่า 0")
    .max(10_000, "จำนวนเกินกำหนด"),
  unitCost: moneySchema,
  serialNumbers: z.array(z.string().trim().min(1).max(128)).max(10_000),
});

export const goodsReceiptSchema = z.object({
  supplierId: idSchema,
  receivedDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "รูปแบบวันที่ไม่ถูกต้อง"),
  note: optionalText(1000),
  items: z
    .array(goodsReceiptItemSchema)
    .min(1, "ต้องมีรายการสินค้าอย่างน้อย 1 รายการ")
    .max(100, "รายการสินค้าเกินกำหนด"),
});

export const productImportRowSchema = z.object({
  sku: skuSchema,
  name: z
    .string()
    .trim()
    .min(2, "ชื่อสินค้าต้องมีอย่างน้อย 2 ตัวอักษร")
    .max(150, "ชื่อสินค้ายาวเกินกำหนด"),
  categorycode: z
    .string()
    .trim()
    .min(1, "กรุณาระบุรหัสหมวดหมู่")
    .transform((value) => value.toUpperCase()),
  brand: optionalText(100),
  model: optionalText(100),
  description: optionalText(2000),
  costprice: optionalMoneySchema,
  saleprice: moneySchema,
  reorderlevel: integerSchema("จุดสั่งซื้อ", 1_000_000),
  warrantymonths: integerSchema("ระยะประกัน", 1_200),
  trackserial: booleanSchema,
  barcodes: z.string().trim().optional().default(""),
});

export const productCsvHeaders = [
  "sku",
  "name",
  "categorycode",
  "brand",
  "model",
  "description",
  "costprice",
  "saleprice",
  "reorderlevel",
  "warrantymonths",
  "trackserial",
  "barcodes",
] as const;
