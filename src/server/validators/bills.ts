import { z } from "zod";

const idSchema = z.string().trim().min(1, "ไม่พบรหัสอ้างอิง").max(64);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `ข้อความต้องไม่เกิน ${max} ตัวอักษร`)
    .optional()
    .transform((value) => (value ? value : undefined));

const moneySchema = z
  .string()
  .trim()
  .min(1, "กรุณากรอกจำนวนเงิน")
  .max(20, "จำนวนเงินยาวเกินไป")
  .regex(/^\d{1,10}(?:\.\d{1,2})?$/, "จำนวนเงินไม่ถูกต้อง")
  .refine((value) => Number(value) <= 9_999_999_999.99, {
    message: "จำนวนเงินเกินขีดจำกัด",
  });

const discountTypeSchema = z.preprocess(
  (value) => (value === "" || value == null ? null : value),
  z.enum(["PERCENT", "AMOUNT"]).nullable(),
);

const discountValueSchema = z
  .string()
  .trim()
  .max(20, "ส่วนลดยาวเกินไป")
  .regex(/^\d{1,10}(?:\.\d{1,2})?$/, "ส่วนลดไม่ถูกต้อง")
  .default("0");

export const billItemSchema = z
  .object({
    kind: z.enum(["PRODUCT", "SERVICE"]),
    productId: z
      .string()
      .trim()
      .max(64)
      .optional()
      .transform((value) => (value ? value : undefined)),
    description: optionalText(500),
    quantity: z.coerce
      .number()
      .int("จำนวนต้องเป็นจำนวนเต็ม")
      .min(1, "จำนวนต้องมากกว่า 0")
      .max(10_000, "จำนวนสูงเกินไป"),
    unitPrice: moneySchema,
    discountType: discountTypeSchema,
    discountValue: discountValueSchema,
    serialIds: z
      .array(z.string().trim().min(1).max(64))
      .max(1_000, "จำนวน Serial สูงเกินไป")
      .default([]),
  })
  .superRefine((item, context) => {
    if (item.kind === "PRODUCT" && !item.productId) {
      context.addIssue({
        code: "custom",
        path: ["productId"],
        message: "กรุณาเลือกสินค้า",
      });
    }

    if (item.kind === "SERVICE" && (!item.description || item.description.length < 2)) {
      context.addIssue({
        code: "custom",
        path: ["description"],
        message: "กรุณาระบุรายละเอียดค่าบริการ",
      });
    }

    if (
      item.discountType === "PERCENT" &&
      Number(item.discountValue) > 100
    ) {
      context.addIssue({
        code: "custom",
        path: ["discountValue"],
        message: "ส่วนลดเปอร์เซ็นต์ต้องไม่เกิน 100",
      });
    }
  });

const repairSchema = z.object({
  deviceBrand: optionalText(100),
  deviceModel: optionalText(100),
  deviceSerial: optionalText(128),
  reportedSymptoms: optionalText(2_000),
  diagnosis: optionalText(2_000),
  resolution: optionalText(2_000),
  repairStatus: z
    .enum([
      "RECEIVED",
      "INSPECTING",
      "WAITING_PARTS",
      "REPAIRING",
      "COMPLETED",
      "DELIVERED",
    ])
    .optional(),
});

const claimSchema = z.object({
  productId: z
    .string()
    .trim()
    .max(64)
    .optional()
    .transform((value) => (value ? value : undefined)),
  serialNumber: optionalText(128),
  note: optionalText(2_000),
});

const commonBillSchema = z.object({
  billTypeId: idSchema,
  customerId: idSchema,
  technicianId: z
    .string()
    .trim()
    .max(64)
    .optional()
    .transform((value) => (value ? value : undefined)),
  title: z
    .string()
    .trim()
    .min(2, "กรุณากรอกชื่อบิลอย่างน้อย 2 ตัวอักษร")
    .max(200, "ชื่อบิลต้องไม่เกิน 200 ตัวอักษร"),
  description: optionalText(2_000),
  note: optionalText(2_000),
  discountType: discountTypeSchema,
  discountValue: discountValueSchema,
  items: z.array(billItemSchema).max(100, "บิลมีรายการมากเกินไป"),
  repair: repairSchema.optional(),
  claim: claimSchema.optional(),
});

export const billCreateSchema = commonBillSchema;
export const billUpdateSchema = commonBillSchema.extend({ billId: idSchema });

export const billSubmitSchema = z.object({
  billId: idSchema,
});

export const billApproveSchema = z.object({
  billId: idSchema,
  overrideReason: optionalText(2_000),
});

export const billRejectSchema = z.object({
  billId: idSchema,
  reason: z
    .string()
    .trim()
    .min(3, "กรุณาระบุเหตุผลอย่างน้อย 3 ตัวอักษร")
    .max(1_000, "เหตุผลต้องไม่เกิน 1,000 ตัวอักษร"),
});

export const billPaySchema = z.object({
  billId: idSchema,
  paymentMethod: z.enum(["CASH", "TRANSFER", "CARD"], {
    message: "กรุณาเลือกวิธีชำระเงิน",
  }),
});

export const billVoidSchema = z.object({
  billId: idSchema,
  reason: z
    .string()
    .trim()
    .min(3, "กรุณาระบุเหตุผลการยกเลิกอย่างน้อย 3 ตัวอักษร")
    .max(1_000, "เหตุผลต้องไม่เกิน 1,000 ตัวอักษร"),
});

export type BillCreateInput = z.infer<typeof billCreateSchema>;
export type BillUpdateInput = z.infer<typeof billUpdateSchema>;
export type BillItemInput = z.infer<typeof billItemSchema>;
export type BillRepairInput = z.infer<typeof repairSchema>;
export type BillClaimInput = z.infer<typeof claimSchema>;
