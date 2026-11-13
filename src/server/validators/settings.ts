import { z } from "zod";

const optionalText = (max: number, label: string) =>
  z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? undefined : value,
    z
      .string()
      .trim()
      .max(max, `${label}ต้องไม่เกิน ${max} ตัวอักษร`)
      .optional(),
  );

const optionalEmail = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  z
    .string()
    .trim()
    .max(254, "อีเมลยาวเกินกำหนด")
    .email("รูปแบบอีเมลไม่ถูกต้อง")
    .transform((value) => value.toLowerCase())
    .optional(),
);

const optionalPhone = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  z
    .string()
    .trim()
    .max(32, "เบอร์โทรยาวเกินกำหนด")
    .regex(/^[0-9+\-() ]{6,32}$/, "รูปแบบเบอร์โทรไม่ถูกต้อง")
    .optional(),
);

const optionalTaxId = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  z
    .string()
    .trim()
    .regex(/^[0-9]{13}$/, "เลขประจำตัวผู้เสียภาษีต้องมี 13 หลัก")
    .optional(),
);

const optionalLogoUrl = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  z
    .string()
    .trim()
    .max(500, "พาธโลโก้ยาวเกินกำหนด")
    .regex(
      /^\/[A-Za-z0-9/._~-]*$/,
      "พาธโลโก้ต้องขึ้นต้นด้วย / และใช้ได้เฉพาะตัวอักษรอังกฤษ ตัวเลข / . _ ~ -",
    )
    .optional(),
);

const vatRateSchema = z
  .string()
  .trim()
  .min(1, "กรุณากรอกอัตรา VAT")
  .regex(/^\d{1,3}(?:\.\d{1,2})?$/, "อัตรา VAT ต้องมีทศนิยมไม่เกิน 2 ตำแหน่ง")
  .transform((value) => Number(value))
  .refine(
    (value) => Number.isFinite(value) && value >= 0 && value <= 100,
    "อัตรา VAT ต้องอยู่ระหว่าง 0–100",
  );

const optionalPromptPayId = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  z
    .string()
    .trim()
    .max(32, "พร้อมเพย์ยาวเกินกำหนด")
    .regex(/^[0-9+\-\s()]+$/, "พร้อมเพย์ใช้ได้เฉพาะตัวเลขและเครื่องหมาย")
    .optional(),
);

const dayCountSchema = (
  label: string,
  max: number,
  fallback: number,
  min = 0,
) =>
  z.preprocess(
    (value) => (value === "" || value == null ? fallback : value),
    z.coerce
      .number()
      .int(`${label}ต้องเป็นจำนวนเต็ม`)
      .min(min, min > 0 ? `${label}ต้องมากกว่า 0` : `${label}ต้องไม่ติดลบ`)
      .max(max, `${label}สูงเกินกำหนด`),
  );

export const shopSettingsSchema = z.object({
  shopName: z
    .string()
    .trim()
    .min(1, "กรุณากรอกชื่อร้าน")
    .max(120, "ชื่อร้านยาวเกินกำหนด"),
  address: optionalText(600, "ที่อยู่"),
  phone: optionalPhone,
  email: optionalEmail,
  taxId: optionalTaxId,
  vatEnabled: z.boolean(),
  vatRate: vatRateSchema,
  vatIncluded: z.boolean(),
  receiptFooter: optionalText(1_000, "ข้อความท้ายใบเสร็จ"),
  logoUrl: optionalLogoUrl,
  promptpayId: optionalPromptPayId,
  bankInfo: optionalText(1_000, "ข้อมูลบัญชีธนาคาร"),
  lineId: optionalText(100, "LINE ID"),
  whatsapp: optionalPhone,
  repairWarrantyDays: dayCountSchema("ระยะประกันงานซ่อม", 3_650, 30),
  quoteValidityDays: dayCountSchema("อายุใบเสนอราคา", 365, 7, 1),
  repairTerms: optionalText(2_000, "เงื่อนไขงานซ่อม"),
  messageTemplates: z
    .record(z.string(), z.string().trim().max(2_000, "ข้อความยาวเกินกำหนด"))
    .optional(),
});

export type ShopSettingsInput = z.infer<typeof shopSettingsSchema>;
