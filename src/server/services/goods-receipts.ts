import "server-only";

import { prisma } from "@/lib/db";
import {
  calculateLineTotal,
  calculateWeightedAverageCost,
} from "@/lib/inventory-calculations";
import {
  currentBuddhistYear,
  parseBangkokDateInput,
} from "@/lib/inventory-labels";
import { Decimal } from "@/lib/money";
import { writeAuditLog } from "@/server/audit";
import {
  InventoryError,
  isUniqueConstraintError,
} from "@/server/services/inventory-error";
import {
  assertInventoryAdmin,
  type InventoryActor,
} from "@/server/services/inventory-actor";
import {
  lockInventoryKey,
  nextDocumentSequence,
} from "@/server/services/document-sequences";

type GoodsReceiptInput = {
  supplierId: string;
  receivedDate: string;
  note?: string;
  items: Array<{
    productId: string;
    quantity: number;
    unitCost: string;
    serialNumbers: string[];
  }>;
};

export async function createGoodsReceipt(
  actor: InventoryActor,
  input: GoodsReceiptInput,
) {
  assertInventoryAdmin(actor);

  const receivedAt = parseBangkokDateInput(input.receivedDate);
  if (!receivedAt) {
    throw new InventoryError("NOT_FOUND", "วันที่รับสินค้าไม่ถูกต้อง");
  }

  const duplicateProduct = findDuplicateProduct(input.items);
  if (duplicateProduct) {
    throw new InventoryError(
      "DUPLICATE_PRODUCT_LINE",
      "ไม่สามารถมีสินค้าเดียวกันมากกว่าหนึ่งบรรทัดในใบรับสินค้า",
    );
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.findFirst({
        where: {
          id: input.supplierId,
          isActive: true,
          deletedAt: null,
        },
        select: { id: true, name: true },
      });

      if (!supplier) {
        throw new InventoryError(
          "SUPPLIER_INACTIVE",
          "ไม่พบผู้จัดจำหน่ายที่เปิดใช้งาน",
        );
      }

      const productIds = input.items
        .map((item) => item.productId)
        .sort((left, right) => left.localeCompare(right));

      for (const productId of productIds) {
        await lockInventoryKey(tx, `stock:${productId}`);
      }

      const products = await tx.product.findMany({
        where: { id: { in: productIds } },
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
      const productMap = new Map(products.map((product) => [product.id, product]));

      const allSerialNumbers = new Set<string>();
      const duplicateSerials = new Set<string>();

      for (const item of input.items) {
        const product = productMap.get(item.productId);

        if (!product) {
          throw new InventoryError("NOT_FOUND", "ไม่พบสินค้าในรายการ");
        }

        if (!product.isActive || product.deletedAt) {
          throw new InventoryError(
            "INVALID_STOCK_ADJUSTMENT",
            `สินค้า ${product.sku} ถูกเก็บถาวรหรือปิดใช้งาน`,
          );
        }

        const serialNumbers = item.serialNumbers
          .map((serial) => serial.trim())
          .filter(Boolean);

        if (new Set(serialNumbers).size !== serialNumbers.length) {
          throw new InventoryError(
            "SERIAL_DUPLICATE",
            `พบ Serial ซ้ำในสินค้า ${product.sku}`,
          );
        }

        if (product.trackSerial && serialNumbers.length !== item.quantity) {
          throw new InventoryError(
            "SERIAL_REQUIRED",
            `สินค้า ${product.sku} ต้องระบุ Serial ให้ครบ ${item.quantity} รายการ`,
          );
        }

        if (!product.trackSerial && serialNumbers.length > 0) {
          throw new InventoryError(
            "PRODUCT_NOT_TRACKING_SERIAL",
            `สินค้า ${product.sku} ไม่ได้ติดตาม Serial`,
          );
        }

        for (const serial of serialNumbers) {
          if (allSerialNumbers.has(serial)) {
            duplicateSerials.add(serial);
          }
          allSerialNumbers.add(serial);
        }
      }

      if (duplicateSerials.size > 0) {
        throw new InventoryError(
          "SERIAL_DUPLICATE",
          `พบ Serial ซ้ำในใบรับสินค้า: ${Array.from(duplicateSerials)
            .slice(0, 5)
            .join(", ")}`,
        );
      }

      if (allSerialNumbers.size > 0) {
        const existingSerials = await tx.productSerial.findMany({
          where: { serialNumber: { in: Array.from(allSerialNumbers) } },
          select: { serialNumber: true },
        });

        if (existingSerials.length > 0) {
          throw new InventoryError(
            "SERIAL_DUPLICATE",
            `Serial นี้มีอยู่ในระบบแล้ว: ${existingSerials
              .slice(0, 5)
              .map((row) => row.serialNumber)
              .join(", ")}`,
          );
        }
      }

      const preparedItems = input.items.map((item) => {
        const lineTotal = calculateLineTotal(item.quantity, item.unitCost);
        return { ...item, lineTotal };
      });
      const totalCost = preparedItems.reduce(
        (sum, item) => sum.plus(item.lineTotal),
        new Decimal(0),
      );

      const sequence = await nextDocumentSequence(
        tx,
        `GR-${currentBuddhistYear(receivedAt)}`,
        { padding: 4, createdById: actor.id },
      );
      const receiptNo = `GR-${currentBuddhistYear(receivedAt)}-${sequence}`;

      const receipt = await tx.goodsReceipt.create({
        data: {
          receiptNo,
          supplierId: supplier.id,
          receivedAt,
          totalCost: totalCost.toFixed(2),
          note: input.note ?? null,
          createdById: actor.id,
        },
      });

      for (const item of preparedItems) {
        const product = productMap.get(item.productId);
        if (!product) {
          throw new InventoryError("NOT_FOUND", "ไม่พบสินค้าในรายการ");
        }

        const receiptItem = await tx.goodsReceiptItem.create({
          data: {
            goodsReceiptId: receipt.id,
            productId: product.id,
            quantity: item.quantity,
            unitCost: new Decimal(item.unitCost).toFixed(2),
            lineTotal: item.lineTotal.toFixed(2),
            createdById: actor.id,
          },
        });

        const nextCost = calculateWeightedAverageCost(
          product.stockQty,
          product.costPrice.toString(),
          item.quantity,
          item.unitCost,
        );
        const updatedProduct = await tx.product.update({
          where: { id: product.id },
          data: {
            stockQty: product.stockQty + item.quantity,
            costPrice: nextCost.toFixed(2),
          },
          select: { stockQty: true },
        });

        await tx.stockMovement.create({
          data: {
            productId: product.id,
            goodsReceiptItemId: receiptItem.id,
            type: "GOODS_RECEIPT",
            quantityDelta: item.quantity,
            unitCost: new Decimal(item.unitCost).toFixed(2),
            balanceAfter: updatedProduct.stockQty,
            note: `รับสินค้า ${receiptNo}`,
            createdById: actor.id,
          },
        });

        if (product.trackSerial) {
          const serials = item.serialNumbers
            .map((serial) => serial.trim())
            .filter(Boolean);
          await tx.productSerial.createMany({
            data: serials.map((serialNumber) => ({
              productId: product.id,
              goodsReceiptItemId: receiptItem.id,
              serialNumber,
              status: "IN_STOCK" as const,
              unitCost: new Decimal(item.unitCost).toFixed(2),
              createdById: actor.id,
            })),
          });
        }
      }

      await writeAuditLog(
        {
          actorId: actor.id,
          action: "GOODS_RECEIPT_CREATED",
          entityType: "GoodsReceipt",
          entityId: receipt.id,
          after: {
            receiptNo: receipt.receiptNo,
            supplierId: supplier.id,
            supplierName: supplier.name,
            receivedAt: receivedAt.toISOString(),
            totalCost: totalCost.toFixed(2),
            itemCount: preparedItems.length,
            unitCount: preparedItems.reduce(
              (sum, item) => sum + item.quantity,
              0,
            ),
          },
        },
        tx,
      );

      return receipt;
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new InventoryError(
        "SERIAL_DUPLICATE",
        "มี Serial หรือเลขที่ใบรับสินค้าซ้ำในระบบ",
      );
    }
    throw error;
  }
}

export async function listGoodsReceipts(actor: InventoryActor) {
  assertInventoryAdmin(actor);

  return prisma.goodsReceipt.findMany({
    orderBy: { receivedAt: "desc" },
    take: 100,
    select: {
      id: true,
      receiptNo: true,
      receivedAt: true,
      totalCost: true,
      note: true,
      supplier: { select: { id: true, name: true } },
      _count: { select: { items: true } },
    },
  });
}

export const GOODS_RECEIPTS_PAGE_SIZE = 50;

export async function listGoodsReceiptsPaginated(
  actor: InventoryActor,
  options: { page?: number; pageSize?: number } = {},
) {
  assertInventoryAdmin(actor);

  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(
    100,
    Math.max(10, options.pageSize ?? GOODS_RECEIPTS_PAGE_SIZE),
  );
  const skip = (page - 1) * pageSize;

  const [items, totalCount] = await Promise.all([
    prisma.goodsReceipt.findMany({
      orderBy: { receivedAt: "desc" },
      skip,
      take: pageSize,
      select: {
        id: true,
        receiptNo: true,
        receivedAt: true,
        totalCost: true,
        note: true,
        supplier: { select: { id: true, name: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.goodsReceipt.count(),
  ]);

  return { items, totalCount, page, pageSize };
}

export async function getGoodsReceiptById(
  actor: InventoryActor,
  receiptId: string,
) {
  assertInventoryAdmin(actor);

  return prisma.goodsReceipt.findUnique({
    where: { id: receiptId },
    select: {
      id: true,
      receiptNo: true,
      receivedAt: true,
      totalCost: true,
      note: true,
      createdAt: true,
      supplier: {
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          contactName: true,
        },
      },
      items: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          quantity: true,
          unitCost: true,
          lineTotal: true,
          product: {
            select: {
              id: true,
              sku: true,
              name: true,
              trackSerial: true,
            },
          },
          serials: {
            orderBy: { serialNumber: "asc" },
            select: { id: true, serialNumber: true },
          },
        },
      },
    },
  });
}

export async function getProductReceiptHistory(productId: string) {
  return prisma.goodsReceiptItem.findMany({
    where: { productId },
    orderBy: { goodsReceipt: { receivedAt: "desc" } },
    take: 20,
    select: {
      id: true,
      quantity: true,
      unitCost: true,
      lineTotal: true,
      goodsReceipt: {
        select: {
          id: true,
          receiptNo: true,
          receivedAt: true,
          supplier: { select: { name: true } },
        },
      },
    },
  });
}

function findDuplicateProduct(
  items: Array<{ productId: string }>,
): string | null {
  const seen = new Set<string>();

  for (const item of items) {
    if (seen.has(item.productId)) {
      return item.productId;
    }
    seen.add(item.productId);
  }

  return null;
}
