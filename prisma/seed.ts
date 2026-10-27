import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";

import { PrismaClient } from "../src/generated/prisma/client";
import {
  BarcodeType,
  CommissionRuleType,
  Role,
} from "../src/generated/prisma/enums";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env before seeding.",
  );
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const OPENING_BALANCE_NOTE = "OPENING_BALANCE";

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function normalizedEmail(value: string): string {
  return value.trim().toLowerCase();
}

function barcodeFor(index: number, variant = 0): string {
  return `88510000${String(1000 + index * 10 + variant).padStart(5, "0")}`;
}

type SeedProduct = {
  sku: string;
  name: string;
  categoryCode: string;
  brand: string;
  model: string;
  costPrice: string;
  salePrice: string;
  initialStock: number;
  reorderLevel: number;
  warrantyMonths: number;
  trackSerial: boolean;
  extraBarcode?: string;
};

const categories = [
  { code: "CPU", name: "ซีพียู", description: "หน่วยประมวลผล" },
  { code: "MB", name: "เมนบอร์ด", description: "แผงวงจรหลัก" },
  { code: "RAM", name: "หน่วยความจำ", description: "RAM สำหรับคอมพิวเตอร์" },
  { code: "SSD", name: "อุปกรณ์จัดเก็บข้อมูล", description: "SSD และ HDD" },
  { code: "GPU", name: "การ์ดจอ", description: "การ์ดแสดงผล" },
  { code: "PSU", name: "เพาเวอร์ซัพพลาย", description: "แหล่งจ่ายไฟ" },
  { code: "CASE", name: "เคสคอมพิวเตอร์", description: "เคสและอุปกรณ์ระบายความร้อน" },
  { code: "MON", name: "จอมอนิเตอร์", description: "หน้าจอแสดงผล" },
  { code: "PER", name: "อุปกรณ์เสริม", description: "คีย์บอร์ด เมาส์ และอุปกรณ์เสริม" },
  { code: "NET", name: "อุปกรณ์เครือข่าย", description: "เราเตอร์ สวิตช์ และอุปกรณ์เครือข่าย" },
];

const suppliers = [
  {
    name: "บริษัท ซินเน็ค (ประเทศไทย) จำกัด (ตัวอย่าง)",
    contactName: "ฝ่ายขายซินเน็ค",
    phone: "021234567",
    email: "sales@example-supplier.local",
    address: "กรุงเทพมหานคร",
  },
  {
    name: "ร้านอะไหล่คอมพิวเตอร์ (ตัวอย่าง)",
    contactName: "คุณวิชัย",
    phone: "029876543",
    email: "parts@example-supplier.local",
    address: "นนทบุรี",
  },
];

const products: SeedProduct[] = [
  {
    sku: "CPU-INT-0001",
    name: "Intel Core i5-14400F",
    categoryCode: "CPU",
    brand: "Intel",
    model: "i5-14400F",
    costPrice: "6200.00",
    salePrice: "7490.00",
    initialStock: 8,
    reorderLevel: 3,
    warrantyMonths: 36,
    trackSerial: true,
  },
  {
    sku: "CPU-AMD-0001",
    name: "AMD Ryzen 5 7600",
    categoryCode: "CPU",
    brand: "AMD",
    model: "Ryzen 5 7600",
    costPrice: "6900.00",
    salePrice: "8290.00",
    initialStock: 6,
    reorderLevel: 2,
    warrantyMonths: 36,
    trackSerial: true,
  },
  {
    sku: "MB-ASU-0001",
    name: "ASUS PRIME B760M-A D4",
    categoryCode: "MB",
    brand: "ASUS",
    model: "PRIME B760M-A D4",
    costPrice: "3200.00",
    salePrice: "3990.00",
    initialStock: 5,
    reorderLevel: 2,
    warrantyMonths: 36,
    trackSerial: true,
  },
  {
    sku: "MB-MSI-0001",
    name: "MSI PRO B650M-P",
    categoryCode: "MB",
    brand: "MSI",
    model: "PRO B650M-P",
    costPrice: "3100.00",
    salePrice: "3890.00",
    initialStock: 4,
    reorderLevel: 2,
    warrantyMonths: 36,
    trackSerial: true,
  },
  {
    sku: "RAM-KIN-0001",
    name: "Kingston FURY Beast DDR4 16GB 3200MHz",
    categoryCode: "RAM",
    brand: "Kingston",
    model: "KF432C16BB/16",
    costPrice: "1150.00",
    salePrice: "1590.00",
    initialStock: 20,
    reorderLevel: 6,
    warrantyMonths: 60,
    trackSerial: true,
    extraBarcode: barcodeFor(4, 1),
  },
  {
    sku: "RAM-COR-0001",
    name: "Corsair Vengeance DDR5 16GB 5600MHz",
    categoryCode: "RAM",
    brand: "Corsair",
    model: "CMK16GX5M1B5600C40",
    costPrice: "1750.00",
    salePrice: "2290.00",
    initialStock: 15,
    reorderLevel: 5,
    warrantyMonths: 60,
    trackSerial: true,
  },
  {
    sku: "SSD-SAM-0001",
    name: "Samsung 980 NVMe M.2 1TB",
    categoryCode: "SSD",
    brand: "Samsung",
    model: "MZ-V8V1T0BW",
    costPrice: "2350.00",
    salePrice: "2990.00",
    initialStock: 12,
    reorderLevel: 4,
    warrantyMonths: 60,
    trackSerial: true,
    extraBarcode: barcodeFor(6, 1),
  },
  {
    sku: "SSD-WD-0001",
    name: "WD Blue SN580 NVMe M.2 500GB",
    categoryCode: "SSD",
    brand: "Western Digital",
    model: "WDS500G3B0C",
    costPrice: "1150.00",
    salePrice: "1590.00",
    initialStock: 18,
    reorderLevel: 5,
    warrantyMonths: 60,
    trackSerial: true,
  },
  {
    sku: "GPU-ASU-0001",
    name: "ASUS Dual GeForce RTX 4060 8GB",
    categoryCode: "GPU",
    brand: "ASUS",
    model: "DUAL-RTX4060-8G",
    costPrice: "10500.00",
    salePrice: "12490.00",
    initialStock: 3,
    reorderLevel: 1,
    warrantyMonths: 36,
    trackSerial: true,
    extraBarcode: barcodeFor(8, 1),
  },
  {
    sku: "PSU-COR-0001",
    name: "Corsair RM750e 750W 80+ Gold",
    categoryCode: "PSU",
    brand: "Corsair",
    model: "RM750e",
    costPrice: "3200.00",
    salePrice: "3990.00",
    initialStock: 7,
    reorderLevel: 2,
    warrantyMonths: 60,
    trackSerial: true,
  },
  {
    sku: "CASE-NZX-0001",
    name: "NZXT H5 Flow Mid Tower",
    categoryCode: "CASE",
    brand: "NZXT",
    model: "H5 Flow",
    costPrice: "2300.00",
    salePrice: "2890.00",
    initialStock: 4,
    reorderLevel: 2,
    warrantyMonths: 12,
    trackSerial: false,
  },
  {
    sku: "MON-LG-0001",
    name: 'LG 24MR400 24" IPS 100Hz',
    categoryCode: "MON",
    brand: "LG",
    model: "24MR400",
    costPrice: "3300.00",
    salePrice: "3990.00",
    initialStock: 6,
    reorderLevel: 2,
    warrantyMonths: 36,
    trackSerial: true,
  },
  {
    sku: "PER-LOG-0001",
    name: "Logitech K120 Keyboard",
    categoryCode: "PER",
    brand: "Logitech",
    model: "K120",
    costPrice: "290.00",
    salePrice: "390.00",
    initialStock: 30,
    reorderLevel: 10,
    warrantyMonths: 12,
    trackSerial: false,
  },
  {
    sku: "PER-LOG-0002",
    name: "Logitech M331 Silent Mouse",
    categoryCode: "PER",
    brand: "Logitech",
    model: "M331",
    costPrice: "590.00",
    salePrice: "790.00",
    initialStock: 25,
    reorderLevel: 8,
    warrantyMonths: 12,
    trackSerial: false,
  },
  {
    sku: "NET-TPL-0001",
    name: "TP-Link Archer AX23 WiFi 6",
    categoryCode: "NET",
    brand: "TP-Link",
    model: "Archer AX23",
    costPrice: "1590.00",
    salePrice: "1990.00",
    initialStock: 10,
    reorderLevel: 3,
    warrantyMonths: 36,
    trackSerial: true,
  },
  {
    sku: "PER-UGR-0001",
    name: "UGREEN USB-C Hub 6-in-1",
    categoryCode: "PER",
    brand: "UGREEN",
    model: "CM511",
    costPrice: "650.00",
    salePrice: "890.00",
    initialStock: 22,
    reorderLevel: 6,
    warrantyMonths: 12,
    trackSerial: false,
  },
  {
    sku: "CASE-NOC-0001",
    name: "Noctua NF-A12x25 PWM Fan",
    categoryCode: "CASE",
    brand: "Noctua",
    model: "NF-A12x25 PWM",
    costPrice: "890.00",
    salePrice: "1190.00",
    initialStock: 15,
    reorderLevel: 5,
    warrantyMonths: 72,
    trackSerial: false,
  },
  {
    sku: "SSD-KIN-0001",
    name: "Kingston NV2 NVMe M.2 1TB",
    categoryCode: "SSD",
    brand: "Kingston",
    model: "SNV2S/1000G",
    costPrice: "1900.00",
    salePrice: "2490.00",
    initialStock: 9,
    reorderLevel: 3,
    warrantyMonths: 36,
    trackSerial: true,
  },
  {
    sku: "PER-RAZ-0001",
    name: "Razer BlackWidow V4 X Keyboard",
    categoryCode: "PER",
    brand: "Razer",
    model: "BlackWidow V4 X",
    costPrice: "2900.00",
    salePrice: "3590.00",
    initialStock: 6,
    reorderLevel: 2,
    warrantyMonths: 24,
    trackSerial: false,
  },
  {
    sku: "NET-DLI-0001",
    name: "D-Link DGS-105 5-Port Gigabit Switch",
    categoryCode: "NET",
    brand: "D-Link",
    model: "DGS-105",
    costPrice: "550.00",
    salePrice: "790.00",
    initialStock: 12,
    reorderLevel: 4,
    warrantyMonths: 24,
    trackSerial: false,
  },
];

const customers = [
  {
    name: "คุณสมชาย ใจดี",
    phone: "0812345678",
    email: "somchai@example.local",
    address: "99/1 ถนนสุขุมวิท กรุงเทพมหานคร 10110",
    note: "ลูกค้าประจำ",
  },
  {
    name: "คุณมาลี สุขใจ",
    phone: "0898765432",
    email: "malee@example.local",
    address: "12/3 ถนนรัชดาภิเษก กรุงเทพมหานคร 10400",
  },
  {
    name: "บริษัท กรีนเทค จำกัด",
    phone: "0865551234",
    email: "accounting@greentech.example.local",
    address: "88 อาคารกรีนทาวเวอร์ ชั้น 5 ถนนพระราม 9 กรุงเทพมหานคร 10310",
    taxId: "0105559999999",
    note: "ออกใบกำกับภาษีในนามบริษัท",
  },
  {
    name: "คุณปิยะ วงศ์ไพบูลย์",
    phone: "0923456789",
    address: "45/6 หมู่ 2 ตำบลบางรักน้อย อำเภอเมือง นนทบุรี 11000",
  },
  {
    name: "คุณอารีย์ แสงทอง",
    phone: "0847778899",
    email: "aree@example.local",
    address: "231 ถนนเพชรเกษม เขตภาษีเจริญ กรุงเทพมหานคร 10160",
    note: "สะดวกติดต่อช่วงบ่าย",
  },
];

async function seedUsers() {
  const adminPassword = requiredEnv("SEED_ADMIN_PASSWORD");
  const tech1Password = requiredEnv("SEED_TECH1_PASSWORD");
  const tech2Password = requiredEnv("SEED_TECH2_PASSWORD");

  const [adminHash, tech1Hash, tech2Hash] = await Promise.all([
    hash(adminPassword, 12),
    hash(tech1Password, 12),
    hash(tech2Password, 12),
  ]);

  const admin = await prisma.user.upsert({
    where: { email: normalizedEmail(requiredEnv("SEED_ADMIN_EMAIL")) },
    create: {
      email: normalizedEmail(requiredEnv("SEED_ADMIN_EMAIL")),
      name: "ผู้จัดการร้าน KAIOAK TECH",
      passwordHash: adminHash,
      role: Role.ADMIN,
      phone: "0800000001",
    },
    update: {
      name: "ผู้จัดการร้าน KAIOAK TECH",
      passwordHash: adminHash,
      role: Role.ADMIN,
      isActive: true,
      deactivatedAt: null,
    },
  });

  const tech1 = await prisma.user.upsert({
    where: { email: normalizedEmail(requiredEnv("SEED_TECH1_EMAIL")) },
    create: {
      email: normalizedEmail(requiredEnv("SEED_TECH1_EMAIL")),
      name: "ช่างสมชาย ใจดี",
      passwordHash: tech1Hash,
      role: Role.TECHNICIAN,
      phone: "0800000002",
      createdById: admin.id,
    },
    update: {
      name: "ช่างสมชาย ใจดี",
      passwordHash: tech1Hash,
      role: Role.TECHNICIAN,
      isActive: true,
      deactivatedAt: null,
    },
  });

  const tech2 = await prisma.user.upsert({
    where: { email: normalizedEmail(requiredEnv("SEED_TECH2_EMAIL")) },
    create: {
      email: normalizedEmail(requiredEnv("SEED_TECH2_EMAIL")),
      name: "ช่างณัฐพล ตั้งใจ",
      passwordHash: tech2Hash,
      role: Role.TECHNICIAN,
      phone: "0800000003",
      createdById: admin.id,
    },
    update: {
      name: "ช่างณัฐพล ตั้งใจ",
      passwordHash: tech2Hash,
      role: Role.TECHNICIAN,
      isActive: true,
      deactivatedAt: null,
    },
  });

  return { admin, tech1, tech2 };
}

function buildCommissionRuleSeeds(input: {
  tech1Id: string;
  tech2Id: string;
  billTypeIds: Map<string, string>;
  categoryIds: Map<string, string>;
}) {
  const billTypeId = (code: string) => {
    const id = input.billTypeIds.get(code);

    if (!id) {
      throw new Error(`Missing bill type: ${code}`);
    }

    return id;
  };

  const categoryId = (code: string) => {
    const id = input.categoryIds.get(code);

    if (!id) {
      throw new Error(`Missing category: ${code}`);
    }

    return id;
  };

  return [
    {
      id: "seed-commission-rule-base-revenue",
      name: "ค่าคอมพื้นฐาน 2% จากยอดขาย",
      description:
        "กติกาตั้งต้นสำหรับทุกบิล ใช้เมื่อไม่มีกติกาที่เฉพาะเจาะจงกว่า (ตัวอย่างจาก seed)",
      ruleType: CommissionRuleType.PERCENT_REVENUE,
      value: "2.0000",
      technicianId: null,
      billTypeId: null,
      categoryId: null,
      priority: 0,
    },
    {
      id: "seed-commission-rule-service-revenue",
      name: "ค่าคอมงานบริการ 10%",
      description:
        "งานบริการคิด 10% จากยอดขายก่อน VAT ของทั้งบิล (ตัวอย่างจาก seed)",
      ruleType: CommissionRuleType.PERCENT_REVENUE,
      value: "10.0000",
      technicianId: null,
      billTypeId: billTypeId("SERVICE"),
      categoryId: null,
      priority: 0,
    },
    {
      id: "seed-commission-rule-repair-profit",
      name: "ค่าคอมงานซ่อม 15% ของกำไร",
      description:
        "งานซ่อมคิด 15% จากกำไรหลังต้นทุนของทั้งบิล; กำไรติดลบคิดเป็น 0 (ตัวอย่างจาก seed)",
      ruleType: CommissionRuleType.PERCENT_PROFIT,
      value: "15.0000",
      technicianId: null,
      billTypeId: billTypeId("REPAIR"),
      categoryId: null,
      priority: 0,
    },
    {
      id: "seed-commission-rule-warranty-fixed",
      name: "ค่าคอมเคลมสินค้า 50 บาทต่อบิล",
      description:
        "บิลเคลมสินค้าให้ค่าคอมคงที่ 50 บาทต่อบิล (ตัวอย่างจาก seed)",
      ruleType: CommissionRuleType.FIXED_PER_BILL,
      value: "50.0000",
      technicianId: null,
      billTypeId: billTypeId("WARRANTY_CLAIM"),
      categoryId: null,
      priority: 0,
    },
    {
      id: "seed-commission-rule-tech1-sale-revenue",
      name: "ค่าคอมช่างสมชาย - ขายสินค้า 3%",
      description:
        "ตัวอย่างกติกาเฉพาะช่าง + ประเภทบิล: ช่างสมชายขายสินค้าได้ 3% ของยอดขาย (ตัวอย่างจาก seed)",
      ruleType: CommissionRuleType.PERCENT_REVENUE,
      value: "3.0000",
      technicianId: input.tech1Id,
      billTypeId: billTypeId("SALE"),
      categoryId: null,
      priority: 0,
    },
    {
      id: "seed-commission-rule-tech2-repair-profit",
      name: "ค่าคอมช่างณัฐพล - งานซ่อม 20% ของกำไร",
      description:
        "ตัวอย่างกติกาเฉพาะช่าง + ประเภทบิล: ช่างณัฐพลงานซ่อมได้ 20% ของกำไร (ตัวอย่างจาก seed)",
      ruleType: CommissionRuleType.PERCENT_PROFIT,
      value: "20.0000",
      technicianId: input.tech2Id,
      billTypeId: billTypeId("REPAIR"),
      categoryId: null,
      priority: 0,
    },
    {
      id: "seed-commission-rule-gpu-profit",
      name: "ค่าคอมขายการ์ดจอ 15% ของกำไร",
      description:
        "จับเมื่อบิลมีสินค้าหมวดการ์ดจออย่างน้อย 1 รายการ และใช้กำไรของทั้งบิล (ตัวอย่างจาก seed; นโยบายฐานทั้งบิล)",
      ruleType: CommissionRuleType.PERCENT_PROFIT,
      value: "15.0000",
      technicianId: null,
      billTypeId: null,
      categoryId: categoryId("GPU"),
      priority: 0,
    },
  ];
}

async function seedCommissionRules(input: {
  adminId: string;
  tech1Id: string;
  tech2Id: string;
  billTypeIds: Map<string, string>;
  categoryIds: Map<string, string>;
}) {
  const bangkokYear = Number(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
    }).format(new Date()),
  );
  // Keep the example rules older than rules an admin creates later, so a
  // same-specificity custom rule wins the effectiveFrom tie-breaker.
  const effectiveFrom = new Date(`${bangkokYear}-01-01T00:00:00+07:00`);
  const rules = buildCommissionRuleSeeds(input);

  for (const rule of rules) {
    await prisma.commissionRule.upsert({
      where: { id: rule.id },
      create: {
        ...rule,
        effectiveFrom,
        isActive: true,
        createdById: input.adminId,
      },
      update: {
        name: rule.name,
        description: rule.description,
        ruleType: rule.ruleType,
        value: rule.value,
        technicianId: rule.technicianId,
        billTypeId: rule.billTypeId,
        categoryId: rule.categoryId,
        priority: rule.priority,
        effectiveFrom,
        effectiveTo: null,
        isActive: true,
      },
    });
  }

  return rules.length;
}

async function main() {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_DEMO_SEED !== "true"
  ) {
    throw new Error(
      "Demo seed is blocked in production. Use `npm run db:seed:base` for a new installation, or set ALLOW_DEMO_SEED=true for an intentional demo environment.",
    );
  }

  const { admin, tech1, tech2 } = await seedUsers();

  const categoryIds = new Map<string, string>();

  for (const category of categories) {
    const row = await prisma.category.upsert({
      where: { code: category.code },
      create: {
        code: category.code,
        name: category.name,
        description: category.description,
        createdById: admin.id,
      },
      update: {
        name: category.name,
        description: category.description,
        isActive: true,
        deletedAt: null,
      },
    });

    categoryIds.set(category.code, row.id);
  }

  const supplierIds: string[] = [];

  for (const supplier of suppliers) {
    let row = await prisma.supplier.findFirst({
      where: { name: supplier.name },
    });

    if (!row) {
      row = await prisma.supplier.create({
        data: {
          ...supplier,
          createdById: admin.id,
        },
      });
    }

    supplierIds.push(row.id);
  }

  const billTypes = [
    {
      code: "SALE",
      name: "บิลขายสินค้า",
      prefix: "INV",
      requiresRepairDetail: false,
      requiresWarrantyCheck: false,
      sortOrder: 10,
    },
    {
      code: "REPAIR",
      name: "บิลซ่อมคอมพิวเตอร์",
      prefix: "RPR",
      requiresRepairDetail: true,
      requiresWarrantyCheck: false,
      sortOrder: 20,
    },
    {
      code: "SERVICE",
      name: "บิลบริการ",
      prefix: "SVC",
      requiresRepairDetail: false,
      requiresWarrantyCheck: false,
      sortOrder: 30,
    },
    {
      code: "WARRANTY_CLAIM",
      name: "บิลเคลมสินค้า",
      prefix: "CLM",
      requiresRepairDetail: false,
      requiresWarrantyCheck: true,
      sortOrder: 40,
    },
  ] as const;

  const billTypeIds = new Map<string, string>();

  for (const billType of billTypes) {
    const row = await prisma.billType.upsert({
      where: { code: billType.code },
      create: { ...billType, createdById: admin.id },
      update: {
        name: billType.name,
        prefix: billType.prefix,
        requiresRepairDetail: billType.requiresRepairDetail,
        requiresWarrantyCheck: billType.requiresWarrantyCheck,
        isActive: true,
        sortOrder: billType.sortOrder,
      },
    });

    billTypeIds.set(billType.code, row.id);
  }

  const commissionRuleCount = await seedCommissionRules({
    adminId: admin.id,
    tech1Id: tech1.id,
    tech2Id: tech2.id,
    billTypeIds,
    categoryIds,
  });

  await prisma.appSetting.upsert({
    where: { id: "main" },
    create: {
      id: "main",
      shopName: "KAIOAK TECH",
      address: "123 ถนนตัวอย่าง แขวงตัวอย่าง เขตตัวอย่าง กรุงเทพมหานคร 10000",
      phone: "021234567",
      email: "contact@kaioak.local",
      vatEnabled: false,
      vatRate: "7.00",
      vatIncluded: true,
      receiptFooter: "ขอบคุณที่ใช้บริการ KAIOAK TECH",
      logoUrl: "/brand/kaioak-tech-mark.svg",
      createdById: admin.id,
    },
    update: {},
  });

  const currentBuddhistYear = new Date().getFullYear() + 543;

  for (const billType of billTypes) {
    await prisma.documentSequence.upsert({
      where: { key: `${billType.prefix}-${currentBuddhistYear}` },
      create: {
        key: `${billType.prefix}-${currentBuddhistYear}`,
        lastNumber: 0,
      },
      update: {},
    });
  }

  for (const customer of customers) {
    await prisma.customer.upsert({
      where: { phone: customer.phone },
      create: { ...customer, createdById: admin.id },
      update: {
        name: customer.name,
        email: customer.email ?? null,
        address: customer.address ?? null,
        taxId: customer.taxId ?? null,
        note: customer.note ?? null,
        isActive: true,
        deletedAt: null,
      },
    });
  }

  for (const [index, product] of products.entries()) {
    const categoryId = categoryIds.get(product.categoryCode);

    if (!categoryId) {
      throw new Error(`Missing category: ${product.categoryCode}`);
    }

    const defaultSupplierId = supplierIds[product.categoryCode === "PER" ? 1 : 0];

    const row = await prisma.product.upsert({
      where: { sku: product.sku },
      create: {
        sku: product.sku,
        name: product.name,
        categoryId,
        defaultSupplierId,
        brand: product.brand,
        model: product.model,
        costPrice: product.costPrice,
        salePrice: product.salePrice,
        stockQty: 0,
        reorderLevel: product.reorderLevel,
        warrantyMonths: product.warrantyMonths,
        trackSerial: product.trackSerial,
        createdById: admin.id,
      },
      update: {
        name: product.name,
        categoryId,
        defaultSupplierId,
        brand: product.brand,
        model: product.model,
        costPrice: product.costPrice,
        salePrice: product.salePrice,
        reorderLevel: product.reorderLevel,
        warrantyMonths: product.warrantyMonths,
        trackSerial: product.trackSerial,
        isActive: true,
        deletedAt: null,
      },
    });

    const barcodeRows = [
      {
        productId: row.id,
        barcode: barcodeFor(index),
        type: BarcodeType.CODE128,
        isPrimary: true,
        createdById: admin.id,
      },
    ];

    if (product.extraBarcode) {
      barcodeRows.push({
        productId: row.id,
        barcode: product.extraBarcode,
        type: BarcodeType.CODE128,
        isPrimary: false,
        createdById: admin.id,
      });
    }

    await prisma.productBarcode.createMany({
      data: barcodeRows,
      skipDuplicates: true,
    });

    await prisma.$transaction(async (tx) => {
      const existingOpening = await tx.stockMovement.findFirst({
        where: {
          productId: row.id,
          note: OPENING_BALANCE_NOTE,
        },
        select: { id: true },
      });

      if (existingOpening) {
        return;
      }

      const updatedProduct = await tx.product.update({
        where: { id: row.id },
        data: { stockQty: product.initialStock },
      });

      await tx.stockMovement.create({
        data: {
          productId: row.id,
          type: "ADJUSTMENT",
          quantityDelta: product.initialStock,
          unitCost: product.costPrice,
          balanceAfter: updatedProduct.stockQty,
          note: OPENING_BALANCE_NOTE,
          createdById: admin.id,
        },
      });

      if (product.trackSerial) {
        await tx.productSerial.createMany({
          data: Array.from({ length: product.initialStock }, (_, serialIndex) => ({
            productId: row.id,
            serialNumber: `SN-${product.sku}-${String(serialIndex + 1).padStart(4, "0")}`,
            unitCost: product.costPrice,
            status: "IN_STOCK" as const,
            createdById: admin.id,
          })),
          skipDuplicates: true,
        });
      }
    });
  }

  const [userCount, productCount, customerCount, serialCount] =
    await Promise.all([
      prisma.user.count(),
      prisma.product.count(),
      prisma.customer.count(),
      prisma.productSerial.count(),
    ]);

  console.log("Seed completed");
  console.log(`  users: ${userCount} (admin 1, technicians 2)`);
  console.log(`  products: ${productCount}`);
  console.log(`  customers: ${customerCount}`);
  console.log(`  product serials: ${serialCount}`);
  console.log(`  commission rules: ${commissionRuleCount} (demo examples)`);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
