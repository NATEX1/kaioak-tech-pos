import "server-only";

import type { Role } from "@/generated/prisma/enums";

import { prisma } from "@/lib/db";
import { Decimal } from "@/lib/money";
import { writeAuditLog } from "@/server/audit";
import type { ShopSettingsInput } from "@/server/validators/settings";

export type SettingsActor = {
  id: string;
  role: Role;
};

export type ShopSettings = {
  id: string;
  shopName: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  taxId: string | null;
  vatEnabled: boolean;
  vatRate: Decimal;
  vatIncluded: boolean;
  receiptFooter: string | null;
  logoUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdById: string | null;
  updatedById: string | null;
};

export class SettingsServiceError extends Error {
  constructor(
    public readonly code: "FORBIDDEN" | "NOT_FOUND",
    message: string,
  ) {
    super(message);
    this.name = "SettingsServiceError";
  }
}

const settingsSelect = {
  id: true,
  shopName: true,
  address: true,
  phone: true,
  email: true,
  taxId: true,
  vatEnabled: true,
  vatRate: true,
  vatIncluded: true,
  receiptFooter: true,
  logoUrl: true,
  createdAt: true,
  updatedAt: true,
  createdById: true,
  updatedById: true,
} as const;

const fallbackSettings = (): ShopSettings => ({
  id: "main",
  shopName: "KAIOAK TECH",
  address: null,
  phone: null,
  email: null,
  taxId: null,
  vatEnabled: false,
  vatRate: new Decimal(7),
  vatIncluded: true,
  receiptFooter: null,
  logoUrl: "/brand/kaioak-tech-mark.svg",
  createdAt: new Date(0),
  updatedAt: new Date(0),
  createdById: null,
  updatedById: null,
});

function assertAdmin(actor: SettingsActor): void {
  if (actor.role !== "ADMIN") {
    throw new SettingsServiceError(
      "FORBIDDEN",
      "เฉพาะผู้ดูแลระบบเท่านั้นที่แก้ไขข้อมูลร้านได้",
    );
  }
}

export async function getShopSettings(): Promise<ShopSettings> {
  const setting = await prisma.appSetting.findUnique({
    where: { id: "main" },
    select: settingsSelect,
  });

  return setting ?? fallbackSettings();
}

function optional(value?: string): string | null {
  return value?.trim() ? value.trim() : null;
}

function toAuditSettings(settings: ShopSettings) {
  return {
    shopName: settings.shopName,
    address: settings.address,
    phone: settings.phone,
    email: settings.email,
    taxId: settings.taxId,
    vatEnabled: settings.vatEnabled,
    vatRate: settings.vatRate.toFixed(2),
    vatIncluded: settings.vatIncluded,
    receiptFooter: settings.receiptFooter,
    logoUrl: settings.logoUrl,
  };
}

export async function updateShopSettings(
  actor: SettingsActor,
  input: ShopSettingsInput,
) {
  assertAdmin(actor);

  return prisma.$transaction(async (tx) => {
    const before = await tx.appSetting.findUnique({
      where: { id: "main" },
      select: settingsSelect,
    });

    const data = {
      shopName: input.shopName.trim(),
      address: optional(input.address),
      phone: optional(input.phone),
      email: optional(input.email)?.toLowerCase() ?? null,
      taxId: optional(input.taxId),
      vatEnabled: input.vatEnabled,
      vatRate: new Decimal(input.vatRate).toFixed(2),
      vatIncluded: input.vatIncluded,
      receiptFooter: optional(input.receiptFooter),
      logoUrl: optional(input.logoUrl),
      updatedById: actor.id,
    };

    const updated = await tx.appSetting.upsert({
      where: { id: "main" },
      create: {
        id: "main",
        ...data,
        createdById: actor.id,
      },
      update: data,
      select: settingsSelect,
    });

    await writeAuditLog(
      {
        actorId: actor.id,
        action: "SETTINGS_UPDATED",
        entityType: "AppSetting",
        entityId: updated.id,
        before: before ? toAuditSettings(before) : undefined,
        after: toAuditSettings(updated),
      },
      tx,
    );

    return updated;
  });
}
