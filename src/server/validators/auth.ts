import { z } from "zod";

const emailSchema = z
  .string()
  .trim()
  .min(1, "กรุณากรอกอีเมล")
  .max(254, "อีเมลยาวเกินกำหนด")
  .email("รูปแบบอีเมลไม่ถูกต้อง")
  .transform((value) => value.toLowerCase());

export const loginSchema = z.object({
  email: emailSchema,
  password: z
    .string()
    .min(1, "กรุณากรอกรหัสผ่าน")
    .max(128, "รหัสผ่านยาวเกินกำหนด"),
});

export const strongPasswordSchema = z
  .string()
  .min(12, "รหัสผ่านต้องมีอย่างน้อย 12 ตัวอักษร")
  .max(64, "รหัสผ่านต้องไม่เกิน 64 ตัวอักษร")
  .refine(
    (value) => new TextEncoder().encode(value).length <= 72,
    "รหัสผ่านต้องมีขนาดไม่เกิน 72 ไบต์",
  )
  .refine(
    (value) => /[A-Za-z]/.test(value),
    "รหัสผ่านต้องมีตัวอักษรอังกฤษอย่างน้อย 1 ตัว",
  )
  .refine(
    (value) => /[0-9]/.test(value),
    "รหัสผ่านต้องมีตัวเลขอย่างน้อย 1 ตัว",
  );
