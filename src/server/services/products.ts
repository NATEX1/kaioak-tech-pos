import "server-only";

import type { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/db";
import { formatSku, isLowStock } from "@/lib/inventory-calculations";
import { Decimal } from "@/lib/money";
import { writeAuditLog } from "@/server/audit";
import {
  InventoryError,
  isUniqueConstraintError,
  uniqueConstraintTargets,
} from "@/server/services/inventory-error";
import {
  assertInventoryAdmin,
  type InventoryActor,
} from "@/server/services/inventory-actor";
import {
  lockInventoryKey,
  nextDocumentSequence,
} from "@/server/services/document-sequences";

const barcodeSelect = {
  id: true,
  barcode: true,
  type: true,
  isPrimary: true,
  createdAt: true,
} as const;

const productSelect = {
  id: true,
  sku: true,
  name: true,
  categoryId: true,
  defaultSupplierId: true,
  brand: true,
  model: true,
  description: true,
  costPrice: true,
  salePrice: true,
  stockQty: true,
  reorderLevel: true,
  warrantyMonths: true,
  trackSerial: true,
  isActive: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
  category: {
    select: { id: true, code: true, name: true, isActive: true },
  },
  defaultSupplier: {
    select: { id: true, name: true, isActive: true },
  },
  barcodes: {
    orderBy: [{ isPrimary: "desc" as const }, { createdAt: "asc" as const }],
    select: barcodeSelect,
  },
  _count: {
    select: { serials: true },
  },
} satisfies Prisma.ProductSelect;

export type ProductListItem = Prisma.ProductGetPayload<{
  select: typeof productSelect;
}>;

export type ProductListFilter = {
  query?: string;
  categoryId?: string;
  status?: "active" | "archived" | "all";
  lowStockOnly?: boolean;
};

export async function listProducts(
  actor: InventoryActor,
  filter: ProductListFilter = {},
) {
  const isAdmin = actor.role === "ADMIN";
  const status = isAdmin ? (filter.status ?? "active") : "active";
  const where: Prisma.ProductWhereInput = {
    ...(status === "archived"
      ? { deletedAt: { not: null } }
      : status === "active"
        ? { isActive: true, deletedAt: null }
        : {}),
    ...(filter.categoryId ? { categoryId: filter.categoryId } : {}),
    ...(filter.query?.trim()
      ? {
          OR: [
            {
              sku: {
                contains: filter.query.trim().toUpperCase(),
                mode: "insensitive",
              },
            },
            {
              name: {
                contains: filter.query.trim(),
                mode: "insensitive",
              },
            },
            {
              barcodes: {
                some: {
                  barcode: { contains: filter.query.trim(), mode: "insensitive" },
                },
              },
            },
          ],
        }
      : {}),
  };

  const products = await prisma.product.findMany({
    where,
    select: productSelect,
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    take: 200,
  });

  return filter.lowStockOnly
    ? products.filter((product) => isLowStock(product.stockQty, product.reorderLevel))
    : products;
}

export const PRODUCTS_PAGE_SIZE = 50;

export async function listProductsPaginated(
  actor: InventoryActor,
  filter: ProductListFilter & { page?: number; pageSize?: number } = {},
) {
  const isAdmin = actor.role === "ADMIN";
  const status = isAdmin ? (filter.status ?? "active") : "active";
  const page = Math.max(1, filter.page ?? 1);
  const pageSize = Math.min(
    100,
    Math.max(10, filter.pageSize ?? PRODUCTS_PAGE_SIZE),
  );
  const skip = (page - 1) * pageSize;

  const where: Prisma.ProductWhereInput = {
    ...(status === "archived"
      ? { deletedAt: { not: null } }
      : status === "active"
        ? { isActive: true, deletedAt: null }
        : {}),
    ...(filter.categoryId ? { categoryId: filter.categoryId } : {}),
    ...(filter.query?.trim()
      ? {
          OR: [
            {
              sku: {
                contains: filter.query.trim().toUpperCase(),
                mode: "insensitive",
              },
            },
            {
              name: {
                contains: filter.query.trim(),
                mode: "insensitive",
              },
            },
            {
              barcodes: {
                some: {
                  barcode: {
                    contains: filter.query.trim(),
                    mode: "insensitive",
                  },
                },
              },
            },
          ],
        }
      : {}),
  };

  if (filter.lowStockOnly) {
    const allMatching = await prisma.product.findMany({
      where,
      select: productSelect,
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    });
    const lowStock = allMatching.filter((product) =>
      isLowStock(product.stockQty, product.reorderLevel),
    );
    const totalCount = lowStock.length;
    const items = lowStock.slice(skip, skip + pageSize);
    return { items, totalCount, page, pageSize };
  }

  const [items, totalCount] = await Promise.all([
    prisma.product.findMany({
      where,
      select: productSelect,
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      skip,
      take: pageSize,
    }),
    prisma.product.count({ where }),
  ]);

  return { items, totalCount, page, pageSize };
}

export async function findExactProductId(
  actor: InventoryActor,
  query: string,
): Promise<string | null> {
  const trimmed = query.trim();

  if (!trimmed) {
    return null;
  }

  const product = await prisma.product.findFirst({
    where: {
      ...(actor.role === "ADMIN"
        ? {}
        : { isActive: true, deletedAt: null }),
      OR: [
        { sku: trimmed.toUpperCase() },
        { barcodes: { some: { barcode: trimmed } } },
      ],
    },
    select: { id: true },
  });

  return product?.id ?? null;
}

export async function getProductById(
  actor: InventoryActor,
  productId: string,
) {
  return prisma.product.findFirst({
    where: {
      id: productId,
      ...(actor.role === "ADMIN"
        ? {}
        : { isActive: true, deletedAt: null }),
    },
    select: productSelect,
  });
}

export async function listLowStockProducts() {
  const products = await prisma.product.findMany({
    where: { isActive: true, deletedAt: null },
    select: productSelect,
    orderBy: [{ stockQty: "asc" }, { name: "asc" }],
  });

  return products
    .filter((product) => isLowStock(product.stockQty, product.reorderLevel))
    .sort((left, right) => {
      const leftGap = left.reorderLevel - left.stockQty;
      const rightGap = right.reorderLevel - right.stockQty;
      return rightGap - leftGap;
    });
}

export async function listProductOptions(actor: InventoryActor) {
  assertInventoryAdmin(actor);

  return prisma.product.findMany({
    where: { isActive: true, deletedAt: null },
    orderBy: { name: "asc" },
    select: {
      id: true,
      sku: true,
      name: true,
      costPrice: true,
      stockQty: true,
      trackSerial: true,
      warrantyMonths: true,
      barcodes: {
        select: { barcode: true, isPrimary: true },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      },
    },
  });
}

export async function getInventorySummary(actor: InventoryActor) {
  const products = await prisma.product.findMany({
    where: { isActive: true, deletedAt: null },
    select: {
      stockQty: true,
      reorderLevel: true,
      costPrice: true,
    },
  });

  const productCount = products.length;
  const stockUnits = products.reduce((sum, product) => sum + product.stockQty, 0);
  const lowStockCount = products.filter((product) =>
    isLowStock(product.stockQty, product.reorderLevel),
  ).length;

  if (actor.role !== "ADMIN") {
    return { productCount, stockUnits, lowStockCount, stockValue: null };
  }

  const stockValue = products.reduce((sum, product) => {
    return sum.plus(product.costPrice.times(product.stockQty));
  }, new Decimal(0));

  return { productCount, stockUnits, lowStockCount, stockValue };
}

export async function createProduct(
  actor: InventoryActor,
  input: {
    name: string;
    sku?: string;
    categoryId: string;
    defaultSupplierId?: string;
    brand?: string;
    model?: string;
    description?: string;
    costPrice: string;
    salePrice: string;
    reorderLevel: number;
    warrantyMonths: number;
    trackSerial: boolean;
    primaryBarcode?: string;
    primaryBarcodeType: "CODE128" | "EAN13";
  },
) {
  assertInventoryAdmin(actor);

  try {
    return await prisma.$transaction(async (tx) => {
      const category = await tx.category.findFirst({
        where: { id: input.categoryId, isActive: true, deletedAt: null },
        select: { id: true, code: true },
      });

      if (!category) {
        throw new InventoryError(
          "CATEGORY_INACTIVE",
          "ไม่พบหมวดหมู่ที่เปิดใช้งาน",
        );
      }

      if (input.defaultSupplierId) {
        const supplier = await tx.supplier.findFirst({
          where: {
            id: input.defaultSupplierId,
            isActive: true,
            deletedAt: null,
          },
          select: { id: true },
        });

        if (!supplier) {
          throw new InventoryError(
            "SUPPLIER_INACTIVE",
            "ไม่พบผู้จัดจำหน่ายที่เปิดใช้งาน",
          );
        }
      }

      let sku = input.sku;
      if (!sku) {
        sku = await generateSku(tx, category.code, actor.id);
      }

      const product = await tx.product.create({
        data: {
          sku,
          name: input.name,
          categoryId: category.id,
          defaultSupplierId: input.defaultSupplierId ?? null,
          brand: input.brand ?? null,
          model: input.model ?? null,
          description: input.description ?? null,
          costPrice: input.costPrice,
          salePrice: input.salePrice,
          reorderLevel: input.reorderLevel,
          warrantyMonths: input.warrantyMonths,
          trackSerial: input.trackSerial,
          createdById: actor.id,
        },
      });

      if (input.primaryBarcode?.trim()) {
        await tx.productBarcode.create({
          data: {
            productId: product.id,
            barcode: input.primaryBarcode.trim(),
            type: input.primaryBarcodeType,
            isPrimary: true,
            createdById: actor.id,
          },
        });
      }

      await writeAuditLog(
        {
          actorId: actor.id,
          action: "PRODUCT_CREATED",
          entityType: "Product",
          entityId: product.id,
          after: toProductAudit(product),
        },
        tx,
      );

      return product;
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const targets = uniqueConstraintTargets(error);
      if (targets.some((target) => target.toLowerCase().includes("sku"))) {
        throw new InventoryError("SKU_EXISTS", "SKU นี้ถูกใช้งานแล้ว");
      }
      throw new InventoryError("BARCODE_EXISTS", "บาร์โค้ดนี้ถูกใช้งานแล้ว");
    }
    throw error;
  }
}

export async function updateProduct(
  actor: InventoryActor,
  input: {
    productId: string;
    name: string;
    sku: string;
    categoryId: string;
    defaultSupplierId?: string;
    brand?: string;
    model?: string;
    description?: string;
    salePrice: string;
    reorderLevel: number;
    warrantyMonths: number;
    trackSerial: boolean;
  },
) {
  assertInventoryAdmin(actor);

  try {
    return await prisma.$transaction(async (tx) => {
      await lockInventoryKey(tx, `product:${input.productId}`);

      const existing = await tx.product.findUnique({
        where: { id: input.productId },
        select: {
          ...productSelect,
          costPrice: true,
        },
      });

      if (!existing) {
        throw new InventoryError("NOT_FOUND", "ไม่พบสินค้านี้");
      }

      const category = await tx.category.findFirst({
        where: { id: input.categoryId, isActive: true, deletedAt: null },
        select: { id: true },
      });

      if (!category) {
        throw new InventoryError(
          "CATEGORY_INACTIVE",
          "ไม่พบหมวดหมู่ที่เปิดใช้งาน",
        );
      }

      if (input.defaultSupplierId) {
        const supplier = await tx.supplier.findFirst({
          where: {
            id: input.defaultSupplierId,
            isActive: true,
            deletedAt: null,
          },
          select: { id: true },
        });

        if (!supplier) {
          throw new InventoryError(
            "SUPPLIER_INACTIVE",
            "ไม่พบผู้จัดจำหน่ายที่เปิดใช้งาน",
          );
        }
      }

      if (
        existing.trackSerial !== input.trackSerial &&
        (existing.stockQty > 0 || existing._count.serials > 0)
      ) {
        throw new InventoryError(
          "SERIAL_TRACKING_LOCKED",
          "เปลี่ยนการติดตาม Serial ไม่ได้เมื่อสินค้ามีสต๊อกหรือประวัติ Serial แล้ว",
        );
      }

      const updated = await tx.product.update({
        where: { id: existing.id },
        data: {
          sku: input.sku,
          name: input.name,
          categoryId: category.id,
          defaultSupplierId: input.defaultSupplierId ?? null,
          brand: input.brand ?? null,
          model: input.model ?? null,
          description: input.description ?? null,
          salePrice: input.salePrice,
          reorderLevel: input.reorderLevel,
          warrantyMonths: input.warrantyMonths,
          trackSerial: input.trackSerial,
        },
      });

      await writeAuditLog(
        {
          actorId: actor.id,
          action: "PRODUCT_UPDATED",
          entityType: "Product",
          entityId: existing.id,
          before: toProductAudit(existing),
          after: toProductAudit(updated),
        },
        tx,
      );

      return updated;
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new InventoryError("SKU_EXISTS", "SKU นี้ถูกใช้งานแล้ว");
    }
    throw error;
  }
}

export async function setProductActive(
  actor: InventoryActor,
  productId: string,
  active: boolean,
) {
  assertInventoryAdmin(actor);

  return prisma.$transaction(async (tx) => {
    await lockInventoryKey(tx, `product:${productId}`);

    const existing = await tx.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        sku: true,
        stockQty: true,
        isActive: true,
        deletedAt: true,
        category: { select: { isActive: true, deletedAt: true } },
      },
    });

    if (!existing) {
      throw new InventoryError("NOT_FOUND", "ไม่พบสินค้านี้");
    }

    if (!active && existing.stockQty > 0) {
      throw new InventoryError(
        "PRODUCT_HAS_STOCK",
        "ยังมีสินค้าในสต๊อก กรุณาปรับยอดให้เหลือ 0 ก่อนเก็บถาวร",
      );
    }

    if (active && (!existing.category.isActive || existing.category.deletedAt)) {
      throw new InventoryError(
        "CATEGORY_INACTIVE",
        "หมวดหมู่ของสินค้านี้ถูกปิดใช้งาน กรุณาเปิดหมวดหมู่ก่อน",
      );
    }

    if (existing.isActive === active) {
      return existing;
    }

    const updated = await tx.product.update({
      where: { id: existing.id },
      data: {
        isActive: active,
        deletedAt: active ? null : new Date(),
      },
    });

    await writeAuditLog(
      {
        actorId: actor.id,
        action: active ? "PRODUCT_RESTORED" : "PRODUCT_ARCHIVED",
        entityType: "Product",
        entityId: existing.id,
        before: { isActive: existing.isActive },
        after: { isActive: updated.isActive },
      },
      tx,
    );

    return updated;
  });
}

export async function addProductBarcode(
  actor: InventoryActor,
  input: {
    productId: string;
    barcode: string;
    type: "CODE128" | "EAN13";
    isPrimary: boolean;
  },
) {
  assertInventoryAdmin(actor);

  try {
    return await prisma.$transaction(async (tx) => {
      await lockInventoryKey(tx, `product:${input.productId}`);

      const product = await tx.product.findUnique({
        where: { id: input.productId },
        select: {
          id: true,
          barcodes: { select: { id: true, isPrimary: true } },
        },
      });

      if (!product) {
        throw new InventoryError("NOT_FOUND", "ไม่พบสินค้านี้");
      }

      const hasBarcodes = product.barcodes.length > 0;
      const isPrimary = input.isPrimary || !hasBarcodes;

      if (isPrimary) {
        await tx.productBarcode.updateMany({
          where: { productId: product.id, isPrimary: true },
          data: { isPrimary: false },
        });
      }

      const barcode = await tx.productBarcode.create({
        data: {
          productId: product.id,
          barcode: input.barcode,
          type: input.type,
          isPrimary,
          createdById: actor.id,
        },
      });

      await writeAuditLog(
        {
          actorId: actor.id,
          action: "PRODUCT_BARCODE_ADDED",
          entityType: "Product",
          entityId: product.id,
          metadata: {
            barcode: barcode.barcode,
            type: barcode.type,
            isPrimary: barcode.isPrimary,
          },
        },
        tx,
      );

      return barcode;
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new InventoryError("BARCODE_EXISTS", "บาร์โค้ดนี้ถูกใช้งานแล้ว");
    }
    throw error;
  }
}

export async function removeProductBarcode(
  actor: InventoryActor,
  productId: string,
  barcodeId: string,
) {
  assertInventoryAdmin(actor);

  return prisma.$transaction(async (tx) => {
    await lockInventoryKey(tx, `product:${productId}`);

    const barcode = await tx.productBarcode.findFirst({
      where: { id: barcodeId, productId },
    });

    if (!barcode) {
      throw new InventoryError("NOT_FOUND", "ไม่พบบาร์โค้ดนี้");
    }

    await tx.productBarcode.delete({ where: { id: barcode.id } });

    if (barcode.isPrimary) {
      const nextPrimary = await tx.productBarcode.findFirst({
        where: { productId },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });

      if (nextPrimary) {
        await tx.productBarcode.update({
          where: { id: nextPrimary.id },
          data: { isPrimary: true },
        });
      }
    }

    await writeAuditLog(
      {
        actorId: actor.id,
        action: "PRODUCT_BARCODE_REMOVED",
        entityType: "Product",
        entityId: productId,
        before: { barcode: barcode.barcode, isPrimary: barcode.isPrimary },
      },
      tx,
    );
  });
}

export async function setPrimaryProductBarcode(
  actor: InventoryActor,
  productId: string,
  barcodeId: string,
) {
  assertInventoryAdmin(actor);

  return prisma.$transaction(async (tx) => {
    await lockInventoryKey(tx, `product:${productId}`);

    const barcode = await tx.productBarcode.findFirst({
      where: { id: barcodeId, productId },
    });

    if (!barcode) {
      throw new InventoryError("NOT_FOUND", "ไม่พบบาร์โค้ดนี้");
    }

    if (barcode.isPrimary) {
      return barcode;
    }

    await tx.productBarcode.updateMany({
      where: { productId },
      data: { isPrimary: false },
    });
    const updated = await tx.productBarcode.update({
      where: { id: barcode.id },
      data: { isPrimary: true },
    });

    await writeAuditLog(
      {
        actorId: actor.id,
        action: "PRODUCT_BARCODE_PRIMARY_CHANGED",
        entityType: "Product",
        entityId: productId,
        metadata: { barcode: updated.barcode },
      },
      tx,
    );

    return updated;
  });
}

async function generateSku(
  tx: Prisma.TransactionClient,
  categoryCode: string,
  createdById: string,
): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const sequence = await nextDocumentSequence(
      tx,
      `SKU-${categoryCode}`,
      { padding: 4, createdById },
    );
    const sku = formatSku(categoryCode, Number(sequence));
    const existing = await tx.product.findUnique({
      where: { sku },
      select: { id: true },
    });

    if (!existing) {
      return sku;
    }
  }

  throw new InventoryError(
    "SKU_EXISTS",
    "ไม่สามารถสร้าง SKU อัตโนมัติได้ กรุณากรอก SKU เอง",
  );
}

function toProductAudit(product: {
  sku: string;
  name: string;
  categoryId: string;
  brand: string | null;
  model: string | null;
  costPrice: { toString(): string };
  salePrice: { toString(): string };
  reorderLevel: number;
  warrantyMonths: number;
  trackSerial: boolean;
}) {
  return {
    sku: product.sku,
    name: product.name,
    categoryId: product.categoryId,
    brand: product.brand,
    model: product.model,
    costPrice: product.costPrice.toString(),
    salePrice: product.salePrice.toString(),
    reorderLevel: product.reorderLevel,
    warrantyMonths: product.warrantyMonths,
    trackSerial: product.trackSerial,
  };
}
