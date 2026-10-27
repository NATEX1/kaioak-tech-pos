import "server-only";

import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/server/audit";
import {
  InventoryError,
  isUniqueConstraintError,
} from "@/server/services/inventory-error";
import {
  assertInventoryAdmin,
  type InventoryActor,
} from "@/server/services/inventory-actor";

export async function listCategories(actor: InventoryActor) {
  assertInventoryAdmin(actor);

  return prisma.category.findMany({
    orderBy: [{ deletedAt: "asc" }, { name: "asc" }],
    select: {
      id: true,
      code: true,
      name: true,
      description: true,
      isActive: true,
      deletedAt: true,
      createdAt: true,
      _count: {
        select: {
          products: {
            where: { isActive: true, deletedAt: null },
          },
        },
      },
    },
  });
}

export async function listActiveCategories() {
  return prisma.category.findMany({
    where: { isActive: true, deletedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, code: true, name: true },
  });
}

export async function getCategoryById(
  actor: InventoryActor,
  categoryId: string,
) {
  assertInventoryAdmin(actor);

  return prisma.category.findUnique({
    where: { id: categoryId },
    select: {
      id: true,
      code: true,
      name: true,
      description: true,
      isActive: true,
      deletedAt: true,
      createdAt: true,
      _count: {
        select: {
          products: {
            where: { isActive: true, deletedAt: null },
          },
        },
      },
    },
  });
}

export async function createCategory(
  actor: InventoryActor,
  input: { code: string; name: string; description?: string },
) {
  assertInventoryAdmin(actor);

  try {
    return await prisma.$transaction(async (tx) => {
      const category = await tx.category.create({
        data: {
          code: input.code,
          name: input.name,
          description: input.description ?? null,
          createdById: actor.id,
        },
      });

      await writeAuditLog(
        {
          actorId: actor.id,
          action: "CATEGORY_CREATED",
          entityType: "Category",
          entityId: category.id,
          after: {
            code: category.code,
            name: category.name,
          },
        },
        tx,
      );

      return category;
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new InventoryError(
        "CATEGORY_CODE_EXISTS",
        "รหัสหมวดหมู่นี้ถูกใช้งานแล้ว",
      );
    }
    throw error;
  }
}

export async function updateCategory(
  actor: InventoryActor,
  input: {
    categoryId: string;
    name: string;
    description?: string;
  },
) {
  assertInventoryAdmin(actor);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.category.findUnique({
      where: { id: input.categoryId },
    });

    if (!existing) {
      throw new InventoryError("NOT_FOUND", "ไม่พบหมวดหมู่นี้");
    }

    const updated = await tx.category.update({
      where: { id: existing.id },
      data: {
        name: input.name,
        description: input.description ?? null,
      },
    });

    await writeAuditLog(
      {
        actorId: actor.id,
        action: "CATEGORY_UPDATED",
        entityType: "Category",
        entityId: existing.id,
        before: { name: existing.name, description: existing.description },
        after: { name: updated.name, description: updated.description },
      },
      tx,
    );

    return updated;
  });
}

export async function setCategoryActive(
  actor: InventoryActor,
  categoryId: string,
  active: boolean,
) {
  assertInventoryAdmin(actor);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.category.findUnique({
      where: { id: categoryId },
      select: {
        id: true,
        name: true,
        isActive: true,
        _count: {
          select: {
            products: {
              where: { isActive: true, deletedAt: null },
            },
          },
        },
      },
    });

    if (!existing) {
      throw new InventoryError("NOT_FOUND", "ไม่พบหมวดหมู่นี้");
    }

    if (!active && existing._count.products > 0) {
      throw new InventoryError(
        "CATEGORY_IN_USE",
        `หมวดหมู่นี้ยังมีสินค้าใช้งาน ${existing._count.products} รายการ กรุณาย้ายสินค้าก่อน`,
      );
    }

    if (existing.isActive === active) {
      return existing;
    }

    const updated = await tx.category.update({
      where: { id: existing.id },
      data: {
        isActive: active,
        deletedAt: active ? null : new Date(),
      },
    });

    await writeAuditLog(
      {
        actorId: actor.id,
        action: active ? "CATEGORY_RESTORED" : "CATEGORY_ARCHIVED",
        entityType: "Category",
        entityId: existing.id,
        before: { isActive: existing.isActive },
        after: { isActive: updated.isActive },
      },
      tx,
    );

    return updated;
  });
}
