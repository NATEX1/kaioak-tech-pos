import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { StockMovementType } from "@/generated/prisma/enums";

import { prisma } from "@/lib/db";
import {
  calculateWeightedAverageCost,
} from "@/lib/inventory-calculations";
import { Decimal, roundMoney } from "@/lib/money";
import { writeAuditLog } from "@/server/audit";
import {
  InventoryError,
  isUniqueConstraintError,
} from "@/server/services/inventory-error";
import {
  assertInventoryAdmin,
  type InventoryActor,
} from "@/server/services/inventory-actor";
import { lockInventoryKey } from "@/server/services/document-sequences";

const movementSelect = {
  id: true,
  type: true,
  quantityDelta: true,
  unitCost: true,
  balanceAfter: true,
  note: true,
  createdAt: true,
  product: { select: { id: true, sku: true, name: true } },
  goodsReceiptItem: {
    select: {
      goodsReceipt: { select: { id: true, receiptNo: true } },
    },
  },
} satisfies Prisma.StockMovementSelect;

export async function listStockMovements(
  actor: InventoryActor,
  options: {
    productId?: string;
    type?: StockMovementType;
    take?: number;
  } = {},
) {
  return prisma.stockMovement.findMany({
    where: {
      ...(options.productId ? { productId: options.productId } : {}),
      ...(options.type ? { type: options.type } : {}),
    },
    select: movementSelect,
    orderBy: { createdAt: "desc" },
    take: Math.min(options.take ?? 100, 200),
  });
}

export const STOCK_MOVEMENTS_PAGE_SIZE = 50;

export async function listStockMovementsPaginated(
  actor: InventoryActor,
  options: {
    productId?: string;
    type?: StockMovementType;
    page?: number;
    pageSize?: number;
  } = {},
) {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, options.pageSize ?? STOCK_MOVEMENTS_PAGE_SIZE));
  const skip = (page - 1) * pageSize;
  const where = {
    ...(options.productId ? { productId: options.productId } : {}),
    ...(options.type ? { type: options.type } : {}),
  };

  const [items, totalCount] = await Promise.all([
    prisma.stockMovement.findMany({
      where,
      select: movementSelect,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.stockMovement.count({ where }),
  ]);

  return { items, totalCount, page, pageSize };
}

export async function getProductStockMovements(
  productId: string,
  take = 30,
) {
  return prisma.stockMovement.findMany({
    where: { productId },
    select: movementSelect,
    orderBy: { createdAt: "desc" },
    take: Math.min(take, 100),
  });
}

export async function getProductSerials(productId: string, take = 100) {
  return prisma.productSerial.findMany({
    where: { productId },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: Math.min(take, 200),
    select: {
      id: true,
      serialNumber: true,
      status: true,
      unitCost: true,
      soldAt: true,
      warrantyStartAt: true,
      warrantyEndAt: true,
      createdAt: true,
      goodsReceiptItem: {
        select: {
          goodsReceipt: { select: { id: true, receiptNo: true } },
        },
      },
    },
  });
}

export async function adjustStock(
  actor: InventoryActor,
  input: {
    productId: string;
    direction: "IN" | "OUT";
    quantity: number;
    unitCost?: string;
    reason: string;
    serialNumbers: string[];
  },
) {
  assertInventoryAdmin(actor);

  try {
    return await prisma.$transaction(async (tx) => {
      await lockInventoryKey(tx, `stock:${input.productId}`);

      const product = await tx.product.findUnique({
        where: { id: input.productId },
        select: {
          id: true,
          sku: true,
          name: true,
          trackSerial: true,
          stockQty: true,
          costPrice: true,
          isActive: true,
          deletedAt: true,
        },
      });

      if (!product) {
        throw new InventoryError("NOT_FOUND", "ไม่พบสินค้านี้");
      }

      if (!product.isActive || product.deletedAt) {
        throw new InventoryError(
          "INVALID_STOCK_ADJUSTMENT",
          "ไม่สามารถปรับสต๊อกสินค้าที่เก็บถาวรแล้ว",
        );
      }

      const serialNumbers = input.serialNumbers
        .map((serial) => serial.trim())
        .filter(Boolean);
      const uniqueSerials = Array.from(new Set(serialNumbers));

      if (uniqueSerials.length !== serialNumbers.length) {
        throw new InventoryError(
          "SERIAL_DUPLICATE",
          "พบ Serial ซ้ำในรายการปรับสต๊อก",
        );
      }

      if (!product.trackSerial && serialNumbers.length > 0) {
        throw new InventoryError(
          "PRODUCT_NOT_TRACKING_SERIAL",
          "สินค้านี้ไม่ได้ติดตาม Serial",
        );
      }

      if (product.trackSerial && uniqueSerials.length !== input.quantity) {
        throw new InventoryError(
          "SERIAL_REQUIRED",
          `สินค้านี้ต้องระบุ Serial ให้ครบ ${input.quantity} รายการ`,
        );
      }

      const previousCost = new Decimal(product.costPrice.toString());
      const isIncoming = input.direction === "IN";
      const nextQuantity = isIncoming
        ? product.stockQty + input.quantity
        : product.stockQty - input.quantity;

      if (nextQuantity < 0) {
        throw new InventoryError(
          "STOCK_INSUFFICIENT",
          `สต๊อกไม่พอสำหรับการปรับออก (คงเหลือ ${product.stockQty} ชิ้น)`,
        );
      }

      let nextCost = previousCost;
      let movementUnitCost = previousCost;

      if (isIncoming) {
        if (input.unitCost !== undefined && input.unitCost.trim() !== "") {
          movementUnitCost = roundMoney(input.unitCost);
        }
        nextCost = calculateWeightedAverageCost(
          product.stockQty,
          previousCost,
          input.quantity,
          movementUnitCost,
        );
      }

      if (product.trackSerial && isIncoming && uniqueSerials.length > 0) {
        const existingSerials = await tx.productSerial.findMany({
          where: { serialNumber: { in: uniqueSerials } },
          select: { serialNumber: true },
        });

        if (existingSerials.length > 0) {
          throw new InventoryError(
            "SERIAL_DUPLICATE",
            `Serial นี้มีอยู่แล้ว: ${existingSerials
              .slice(0, 5)
              .map((row) => row.serialNumber)
              .join(", ")}`,
          );
        }
      }

      if (product.trackSerial && !isIncoming) {
        const availableSerials = await tx.productSerial.findMany({
          where: {
            productId: product.id,
            serialNumber: { in: uniqueSerials },
            status: "IN_STOCK",
          },
          select: { id: true, serialNumber: true },
        });

        if (availableSerials.length !== uniqueSerials.length) {
          throw new InventoryError(
            "SERIAL_NOT_FOUND",
            "ไม่พบ Serial ที่พร้อมขายตามรายการที่ระบุ",
          );
        }

        await tx.productSerial.updateMany({
          where: { id: { in: availableSerials.map((serial) => serial.id) } },
          data: { status: "DISPOSED", note: `ปรับสต๊อก: ${input.reason}` },
        });
      }

      const updatedProduct = await tx.product.update({
        where: { id: product.id },
        data: {
          stockQty: nextQuantity,
          ...(isIncoming ? { costPrice: nextCost.toFixed(2) } : {}),
        },
        select: { stockQty: true, costPrice: true },
      });

      const movement = await tx.stockMovement.create({
        data: {
          productId: product.id,
          type: "ADJUSTMENT",
          quantityDelta: isIncoming ? input.quantity : -input.quantity,
          unitCost: movementUnitCost.toFixed(2),
          balanceAfter: updatedProduct.stockQty,
          note: input.reason,
          createdById: actor.id,
        },
      });

      if (product.trackSerial && isIncoming) {
        await tx.productSerial.createMany({
          data: uniqueSerials.map((serialNumber) => ({
            productId: product.id,
            serialNumber,
            status: "IN_STOCK" as const,
            unitCost: movementUnitCost.toFixed(2),
            createdById: actor.id,
          })),
        });
      }

      await writeAuditLog(
        {
          actorId: actor.id,
          action: "STOCK_ADJUSTED",
          entityType: "Product",
          entityId: product.id,
          metadata: {
            sku: product.sku,
            direction: input.direction,
            quantity: input.quantity,
            unitCost: movementUnitCost.toFixed(2),
            reason: input.reason,
            serials: uniqueSerials.slice(0, 50),
            balanceAfter: updatedProduct.stockQty,
          },
        },
        tx,
      );

      return movement;
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new InventoryError(
        "SERIAL_DUPLICATE",
        "มี Serial นี้อยู่ในระบบแล้ว",
      );
    }
    throw error;
  }
}
