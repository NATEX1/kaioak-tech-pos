import { z } from "zod";

import { strongPasswordSchema } from "@/server/validators/auth";

const nameSchema = z
  .string()
  .trim()
  .min(2, "ชื่อต้องมีอย่างน้อย 2 ตัวอักษร")
  .max(100, "ชื่อยาวเกินกำหนด");

const emailSchema = z
  .string()
  .trim()
  .min(1, "กรุณากรอกอีเมล")
  .max(254, "อีเมลยาวเกินกำหนด")
  .email("รูปแบบอีเมลไม่ถูกต้อง")
  .transform((value) => value.toLowerCase());

const optionalPhoneSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z
    .string()
    .trim()
    .max(32, "เบอร์โทรยาวเกินกำหนด")
    .regex(/^[0-9+\-() ]+$/, "รูปแบบเบอร์โทรไม่ถูกต้อง")
    .optional(),
);

const roleSchema = z.enum(["ADMIN", "TECHNICIAN"], {
  message: "กรุณาเลือกบทบาท",
});

export const userIdSchema = z.string().trim().min(1).max(64);

export const createUserSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    phone: optionalPhoneSchema,
    role: roleSchema,
    password: strongPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "รหัสผ่านยืนยันไม่ตรงกัน",
  });

export const updateUserSchema = z.object({
  userId: userIdSchema,
  name: nameSchema,
  phone: optionalPhoneSchema,
  role: roleSchema,
});

export const resetUserPasswordSchema = z
  .object({
    userId: userIdSchema,
    password: strongPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "รหัสผ่านยืนยันไม่ตรงกัน",
  });

export const updateUserStatusSchema = z.object({
  userId: userIdSchema,
  active: z.enum(["true", "false"]).transform((value) => value === "true"),
});

export const changeOwnPasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "กรุณากรอกรหัสผ่านปัจจุบัน"),
    password: strongPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "รหัสผ่านยืนยันไม่ตรงกัน",
  });
