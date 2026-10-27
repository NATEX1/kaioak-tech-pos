import { z } from "zod";

import {
  hasSupportedPhoneCharacters,
  isValidThaiPhone,
  normalizePhone,
} from "@/lib/phone";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value === "" ? undefined : value));

const phoneSchema = z
  .string()
  .trim()
  .min(1, "กรุณากรอกเบอร์โทร")
  .max(32, "เบอร์โทรยาวเกินกำหนด")
  .refine(
    hasSupportedPhoneCharacters,
    "เบอร์โทรใช้ได้เฉพาะตัวเลข ช่องว่าง ขีดกลาง วงเล็บ และเครื่องหมาย +",
  )
  .transform(normalizePhone)
  .refine(
    isValidThaiPhone,
    "เบอร์โทรต้องเป็นเบอร์ไทย 9–10 หลัก ขึ้นต้นด้วย 0 (รองรับ +66)",
  );

const emailSchema = z
  .string()
  .trim()
  .max(254, "อีเมลยาวเกินกำหนด")
  .optional()
  .refine(
    (value) => !value || z.string().email().safeParse(value).success,
    "รูปแบบอีเมลไม่ถูกต้อง",
  )
  .transform((value) => (value ? value.toLowerCase() : undefined));

const taxIdSchema = z
  .string()
  .trim()
  .max(20, "เลขผู้เสียภาษียาวเกินกำหนด")
  .optional()
  .refine(
    (value) => !value || /^[0-9\-\s]+$/.test(value),
    "เลขผู้เสียภาษีใช้ได้เฉพาะตัวเลข ขีดกลาง และช่องว่าง",
  )
  .transform((value) => (value ? value.replace(/\D/g, "") : undefined))
  .refine(
    (value) => !value || value.length === 13,
    "เลขผู้เสียภาษีต้องมี 13 หลัก",
  );

const customerFields = {
  name: z
    .string()
    .trim()
    .min(2, "ชื่อลูกค้าต้องมีอย่างน้อย 2 ตัวอักษร")
    .max(200, "ชื่อลูกค้ายาวเกินกำหนด"),
  phone: phoneSchema,
  email: emailSchema,
  address: optionalText(2000),
  taxId: taxIdSchema,
  note: optionalText(2000),
};

export const customerCreateSchema = z.object(customerFields);

export const customerUpdateSchema = z.object({
  ...customerFields,
  customerId: z.string().trim().min(1).max(64),
});

export const customerListStatusSchema = z.enum(["active", "archived", "all"]);

export type CustomerListStatus = z.infer<typeof customerListStatusSchema>;
