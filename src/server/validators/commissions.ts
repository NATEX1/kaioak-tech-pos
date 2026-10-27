import { z } from "zod";

import { parseBangkokCommissionDate } from "@/lib/commission-labels";
import { Decimal } from "@/lib/money";

const idSchema = z.string().trim().min(1, "ไม่พบรหัสอ้างอิง").max(64);

const optionalIdSchema = z
  .string()
  .trim()
  .max(64)
  .optional()
  .transform((value) => (value ? value : undefined));

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `ข้อความต้องไม่เกิน ${max} ตัวอักษร`)
    .optional()
    .transform((value) => (value ? value : undefined));

const dateSchema = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `กรุณาเลือก${label}`)
    .refine(
      (value) => parseBangkokCommissionDate(value) !== null,
      `${label}ไม่ถูกต้อง`,
    );

const endDateSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined))
  .refine(
    (value) => !value || parseBangkokCommissionDate(value, true) !== null,
    "วันสิ้นสุดไม่ถูกต้อง",
  );

const booleanSchema = z.preprocess(
  (value) => value === "on" || value === "true" || value === true,
  z.boolean(),
);

const valueSchema = z
  .string()
  .trim()
  .min(1, "กรุณากรอกอัตราค่าคอมมิชชั่น")
  .max(20, "อัตราค่าคอมมิชชั่นยาวเกินไป")
  .regex(
    /^\d{1,8}(?:\.\d{1,4})?$/,
    "อัตราต้องเป็นตัวเลขไม่เกิน 4 ตำแหน่งทศนิยม",
  )
  .refine(
    (value) => new Decimal(value).lessThanOrEqualTo("99999999.9999"),
    "อัตราค่าคอมมิชชั่นเกินขีดจำกัด",
  );

export const commissionRuleSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "ชื่อกติกาต้องมีอย่างน้อย 2 ตัวอักษร")
      .max(120, "ชื่อกติกายาวเกินไป"),
    description: optionalText(2_000),
    ruleType: z.enum(
      ["PERCENT_REVENUE", "PERCENT_PROFIT", "FIXED_PER_BILL"],
      { message: "กรุณาเลือกประเภทค่าคอมมิชชั่น" },
    ),
    value: valueSchema,
    technicianId: optionalIdSchema,
    billTypeId: optionalIdSchema,
    categoryId: optionalIdSchema,
    priority: z.coerce
      .number()
      .int("ลำดับความสำคัญต้องเป็นจำนวนเต็ม")
      .min(0, "ลำดับความสำคัญต้องไม่ติดลบ")
      .max(9_999, "ลำดับความสำคัญสูงเกินไป")
      .default(0),
    effectiveFrom: dateSchema("วันเริ่มมีผล"),
    effectiveTo: endDateSchema,
    isActive: booleanSchema.default(true),
  })
  .superRefine((value, context) => {
    const amount = new Decimal(value.value);

    if (
      (value.ruleType === "PERCENT_REVENUE" ||
        value.ruleType === "PERCENT_PROFIT") &&
      amount.greaterThan(100)
    ) {
      context.addIssue({
        code: "custom",
        path: ["value"],
        message: "ค่าคอมมิชชั่นแบบเปอร์เซ็นต์ต้องไม่เกิน 100",
      });
    }

    const from = parseBangkokCommissionDate(value.effectiveFrom);
    const to = value.effectiveTo
      ? parseBangkokCommissionDate(value.effectiveTo, true)
      : null;

    if (from && to && to.getTime() < from.getTime()) {
      context.addIssue({
        code: "custom",
        path: ["effectiveTo"],
        message: "วันสิ้นสุดต้องไม่ก่อนวันเริ่มมีผล",
      });
    }
  })
  .transform((value) => ({
    ...value,
    value: new Decimal(value.value).toFixed(4),
    effectiveFrom: parseBangkokCommissionDate(value.effectiveFrom)!,
    effectiveTo: value.effectiveTo
      ? parseBangkokCommissionDate(value.effectiveTo, true)!
      : undefined,
  }));

export const commissionRuleUpdateSchema = commissionRuleSchema.and(
  z.object({ ruleId: idSchema }),
);

export const commissionRuleStatusSchema = z.object({
  ruleId: idSchema,
  active: booleanSchema,
});

export const commissionPayoutSchema = z
  .object({
    technicianId: idSchema,
    periodStart: dateSchema("วันเริ่มรอบ"),
    periodEnd: dateSchema("วันสิ้นสุดรอบ"),
    note: optionalText(2_000),
  })
  .superRefine((value, context) => {
    const start = parseBangkokCommissionDate(value.periodStart);
    const end = parseBangkokCommissionDate(value.periodEnd, true);

    if (start && end && end.getTime() < start.getTime()) {
      context.addIssue({
        code: "custom",
        path: ["periodEnd"],
        message: "วันสิ้นสุดต้องไม่ก่อนวันเริ่มรอบ",
      });
    }
  })
  .transform((value) => ({
    ...value,
    periodStart: parseBangkokCommissionDate(value.periodStart)!,
    periodEnd: parseBangkokCommissionDate(value.periodEnd, true)!,
  }));

export type CommissionRuleInput = z.infer<typeof commissionRuleSchema>;
export type CommissionRuleUpdateInput = z.infer<
  typeof commissionRuleUpdateSchema
>;
export type CommissionPayoutInput = z.infer<typeof commissionPayoutSchema>;
