import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";

import { PrismaClient } from "../src/generated/prisma/client";
import { Role } from "../src/generated/prisma/enums";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env before seeding.",
  );
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const BILL_TYPES = [
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

async function main() {
  const adminEmail = normalizedEmail(requiredEnv("SEED_ADMIN_EMAIL"));
  const adminPassword = requiredEnv("SEED_ADMIN_PASSWORD");

  let admin = await prisma.user.findUnique({
    where: { email: adminEmail },
    select: { id: true, role: true },
  });

  if (!admin) {
    admin = await prisma.user.create({
      data: {
        email: adminEmail,
        name: process.env.SEED_ADMIN_NAME?.trim() || "ผู้จัดการร้าน",
        phone: process.env.SEED_ADMIN_PHONE?.trim() || null,
        passwordHash: await hash(adminPassword, 12),
        role: Role.ADMIN,
      },
      select: { id: true, role: true },
    });
    console.log(`Created base admin: ${adminEmail}`);
  } else if (admin.role !== Role.ADMIN) {
    throw new Error(
      `SEED_ADMIN_EMAIL belongs to a non-admin user (${admin.role}). Refusing to promote it automatically.`,
    );
  } else {
    console.log(`Base admin already exists: ${adminEmail} (left unchanged)`);
  }

  for (const billType of BILL_TYPES) {
    await prisma.billType.upsert({
      where: { code: billType.code },
      create: { ...billType, createdById: admin.id },
      update: {},
    });
  }

  const existingSetting = await prisma.appSetting.findUnique({
    where: { id: "main" },
    select: { id: true },
  });

  if (!existingSetting) {
    await prisma.appSetting.create({
      data: {
        id: "main",
        shopName: process.env.SEED_SHOP_NAME?.trim() || "KAIOAK TECH",
        vatEnabled: false,
        vatRate: "7.00",
        vatIncluded: true,
        logoUrl: "/brand/kaioak-tech-mark.svg",
        createdById: admin.id,
      },
    });
    console.log("Created base shop settings (main)");
  } else {
    console.log("Base shop settings already exist (left unchanged)");
  }

  const currentBuddhistYear = new Date().getFullYear() + 543;
  for (const billType of BILL_TYPES) {
    await prisma.documentSequence.upsert({
      where: { key: `${billType.prefix}-${currentBuddhistYear}` },
      create: {
        key: `${billType.prefix}-${currentBuddhistYear}`,
        lastNumber: 0,
        createdById: admin.id,
      },
      update: {},
    });
  }

  console.log("Base seed completed (no demo products or customers were created)");
}

main()
  .catch((error) => {
    console.error("Base seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
