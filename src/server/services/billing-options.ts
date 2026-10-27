import "server-only";

import type { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/db";
import type { BillActor } from "@/server/services/bills";

const billTypeSelect = {
  id: true,
  code: true,
  name: true,
  prefix: true,
  requiresRepairDetail: true,
  requiresWarrantyCheck: true,
  description: true,
  sortOrder: true,
} satisfies Prisma.BillTypeSelect;

const customerOptionSelect = {
  id: true,
  name: true,
  phone: true,
  email: true,
} satisfies Prisma.CustomerSelect;

const technicianOptionSelect = {
  id: true,
  name: true,
  email: true,
} satisfies Prisma.UserSelect;

export async function listActiveBillTypes() {
  return prisma.billType.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: billTypeSelect,
  });
}

export async function listBillingCustomers() {
  return prisma.customer.findMany({
    where: { isActive: true, deletedAt: null },
    orderBy: { name: "asc" },
    take: 500,
    select: customerOptionSelect,
  });
}

export async function listActiveTechnicians() {
  return prisma.user.findMany({
    where: { isActive: true, role: "TECHNICIAN" },
    orderBy: { name: "asc" },
    select: technicianOptionSelect,
  });
}

export async function listBillingProducts() {
  return prisma.product.findMany({
    where: { isActive: true, deletedAt: null },
    orderBy: [{ name: "asc" }, { sku: "asc" }],
    take: 500,
    select: {
      id: true,
      sku: true,
      name: true,
      brand: true,
      model: true,
      salePrice: true,
      stockQty: true,
      warrantyMonths: true,
      trackSerial: true,
      barcodes: {
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
        select: { barcode: true, isPrimary: true },
      },
      serials: {
        where: { status: "IN_STOCK" },
        orderBy: { serialNumber: "asc" },
        take: 500,
        select: { id: true, serialNumber: true },
      },
    },
  });
}

export async function getBillingSettings() {
  const setting = await prisma.appSetting.findUnique({
    where: { id: "main" },
    select: {
      shopName: true,
      vatEnabled: true,
      vatRate: true,
      vatIncluded: true,
    },
  });

  return {
    shopName: setting?.shopName ?? "KAIOAK TECH",
    vatEnabled: setting?.vatEnabled ?? false,
    vatRate: setting?.vatRate?.toString() ?? "7",
    vatIncluded: setting?.vatIncluded ?? true,
  };
}

export async function getBillFormOptions(actor: BillActor) {
  const [billTypes, customers, products, settings] = await Promise.all([
    listActiveBillTypes(),
    listBillingCustomers(),
    listBillingProducts(),
    getBillingSettings(),
  ]);

  const technicians =
    actor.role === "ADMIN" ? await listActiveTechnicians() : [];

  return {
    billTypes,
    customers,
    products: products.map((product) => ({
      ...product,
      salePrice: product.salePrice.toFixed(2),
      barcodes: product.barcodes.map((barcode) => barcode.barcode),
    })),
    technicians,
    settings,
  };
}
