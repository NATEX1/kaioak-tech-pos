import "server-only";

import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/server/audit";
import {
  InventoryError,
} from "@/server/services/inventory-error";
import {
  assertInventoryAdmin,
  type InventoryActor,
} from "@/server/services/inventory-actor";

type SupplierInput = {
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  taxId?: string;
  note?: string;
};

export async function listSuppliers(actor: InventoryActor) {
  assertInventoryAdmin(actor);

  return prisma.supplier.findMany({
    orderBy: [{ deletedAt: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      contactName: true,
      phone: true,
      email: true,
      isActive: true,
      deletedAt: true,
      createdAt: true,
      _count: {
        select: { goodsReceipts: true, products: true },
      },
    },
  });
}

export async function listActiveSuppliers() {
  return prisma.supplier.findMany({
    where: { isActive: true, deletedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

export async function getSupplierById(
  actor: InventoryActor,
  supplierId: string,
) {
  assertInventoryAdmin(actor);

  return prisma.supplier.findUnique({
    where: { id: supplierId },
    select: {
      id: true,
      name: true,
      contactName: true,
      phone: true,
      email: true,
      address: true,
      taxId: true,
      note: true,
      isActive: true,
      deletedAt: true,
      createdAt: true,
      _count: {
        select: { goodsReceipts: true, products: true },
      },
    },
  });
}

export async function createSupplier(
  actor: InventoryActor,
  input: SupplierInput,
) {
  assertInventoryAdmin(actor);

  return prisma.$transaction(async (tx) => {
    const supplier = await tx.supplier.create({
      data: {
        name: input.name,
        contactName: input.contactName ?? null,
        phone: input.phone ?? null,
        email: input.email ?? null,
        address: input.address ?? null,
        taxId: input.taxId ?? null,
        note: input.note ?? null,
        createdById: actor.id,
      },
    });

    await writeAuditLog(
      {
        actorId: actor.id,
        action: "SUPPLIER_CREATED",
        entityType: "Supplier",
        entityId: supplier.id,
        after: { name: supplier.name },
      },
      tx,
    );

    return supplier;
  });
}

export async function updateSupplier(
  actor: InventoryActor,
  supplierId: string,
  input: SupplierInput,
) {
  assertInventoryAdmin(actor);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.supplier.findUnique({
      where: { id: supplierId },
    });

    if (!existing) {
      throw new InventoryError("NOT_FOUND", "ไม่พบผู้จัดจำหน่ายนี้");
    }

    const updated = await tx.supplier.update({
      where: { id: existing.id },
      data: {
        name: input.name,
        contactName: input.contactName ?? null,
        phone: input.phone ?? null,
        email: input.email ?? null,
        address: input.address ?? null,
        taxId: input.taxId ?? null,
        note: input.note ?? null,
      },
    });

    await writeAuditLog(
      {
        actorId: actor.id,
        action: "SUPPLIER_UPDATED",
        entityType: "Supplier",
        entityId: existing.id,
        before: { name: existing.name },
        after: { name: updated.name },
      },
      tx,
    );

    return updated;
  });
}

export async function setSupplierActive(
  actor: InventoryActor,
  supplierId: string,
  active: boolean,
) {
  assertInventoryAdmin(actor);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.supplier.findUnique({
      where: { id: supplierId },
    });

    if (!existing) {
      throw new InventoryError("NOT_FOUND", "ไม่พบผู้จัดจำหน่ายนี้");
    }

    if (existing.isActive === active) {
      return existing;
    }

    const updated = await tx.supplier.update({
      where: { id: existing.id },
      data: {
        isActive: active,
        deletedAt: active ? null : new Date(),
      },
    });

    await writeAuditLog(
      {
        actorId: actor.id,
        action: active ? "SUPPLIER_RESTORED" : "SUPPLIER_ARCHIVED",
        entityType: "Supplier",
        entityId: existing.id,
        before: { isActive: existing.isActive },
        after: { isActive: updated.isActive },
      },
      tx,
    );

    return updated;
  });
}
