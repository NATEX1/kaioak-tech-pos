import "server-only";

import { isValidBarcode } from "@/lib/barcode";
import { parseCsv, toCsv } from "@/lib/csv";
import { prisma } from "@/lib/db";
import { Decimal } from "@/lib/money";
import { writeAuditLog } from "@/server/audit";
import { InventoryError } from "@/server/services/inventory-error";
import {
  assertInventoryAdmin,
  type InventoryActor,
} from "@/server/services/inventory-actor";
import { lockInventoryKey } from "@/server/services/document-sequences";
import {
  productCsvHeaders,
  productImportRowSchema,
} from "@/server/validators/inventory";

export const MAX_IMPORT_ROWS = 500;

type ImportCandidate = {
  rowNumber: number;
  sku: string;
  name: string;
  categoryCode: string;
  brand?: string;
  model?: string;
  description?: string;
  costPrice: string;
  salePrice: string;
  reorderLevel: number;
  warrantyMonths: number;
  trackSerial: boolean;
  barcodes: string[];
};

type ImportIssue = {
  rowNumber: number;
  message: string;
};

export async function buildProductCsv(actor: InventoryActor) {
  assertInventoryAdmin(actor);

  const products = await prisma.product.findMany({
    where: { isActive: true, deletedAt: null },
    orderBy: { sku: "asc" },
    select: {
      sku: true,
      name: true,
      category: { select: { code: true } },
      brand: true,
      model: true,
      description: true,
      costPrice: true,
      salePrice: true,
      reorderLevel: true,
      warrantyMonths: true,
      trackSerial: true,
      barcodes: {
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
        select: { barcode: true },
      },
    },
  });

  const csv = toCsv(
    [...productCsvHeaders],
    products.map((product) => [
      product.sku,
      product.name,
      product.category.code,
      product.brand ?? "",
      product.model ?? "",
      product.description ?? "",
      product.costPrice.toString(),
      product.salePrice.toString(),
      product.reorderLevel,
      product.warrantyMonths,
      product.trackSerial,
      product.barcodes.map((barcode) => barcode.barcode).join("|"),
    ]),
  );

  return { csv, count: products.length };
}

export async function importProductsCsv(
  actor: InventoryActor,
  text: string,
): Promise<{ created: number; updated: number; total: number }> {
  assertInventoryAdmin(actor);

  let parsed: ReturnType<typeof parseCsv>;
  try {
    parsed = parseCsv(text);
  } catch (error) {
    throw new InventoryError(
      "IMPORT_ERROR",
      error instanceof Error ? error.message : "อ่านไฟล์ CSV ไม่สำเร็จ",
    );
  }

  const headerSet = new Set(parsed.headers);
  const expected = new Set<string>(productCsvHeaders);
  const missing = [...expected].filter((header) => !headerSet.has(header));
  const extra = [...headerSet].filter((header) => !expected.has(header));

  if (missing.length > 0 || extra.length > 0) {
    const parts: string[] = [];
    if (missing.length > 0) {
      parts.push(`ขาดคอลัมน์: ${missing.join(", ")}`);
    }
    if (extra.length > 0) {
      parts.push(`คอลัมน์เกิน: ${extra.join(", ")}`);
    }
    throw new InventoryError("IMPORT_ERROR", `หัวตารางไม่ถูกต้อง (${parts.join("; ")})`);
  }

  if (parsed.records.length === 0) {
    throw new InventoryError("IMPORT_ERROR", "ไฟล์ CSV ไม่มีแถวข้อมูล");
  }

  if (parsed.records.length > MAX_IMPORT_ROWS) {
    throw new InventoryError(
      "IMPORT_ERROR",
      `นำเข้าได้สูงสุด ${MAX_IMPORT_ROWS} แถวต่อครั้ง`,
    );
  }

  const issues: ImportIssue[] = [];
  const candidates: ImportCandidate[] = [];
  const seenSkus = new Map<string, number>();
  const seenBarcodes = new Map<string, number>();

  parsed.records.forEach((record, index) => {
    const rowNumber = index + 2;
    const validated = productImportRowSchema.safeParse(record);

    if (!validated.success) {
      issues.push({
        rowNumber,
        message:
          validated.error.issues[0]?.message ?? "ข้อมูลแถวนี้ไม่ถูกต้อง",
      });
      return;
    }

    const row = validated.data;
    const duplicateSkuRow = seenSkus.get(row.sku);
    if (duplicateSkuRow) {
      issues.push({
        rowNumber,
        message: `SKU ${row.sku} ซ้ำกับแถว ${duplicateSkuRow}`,
      });
      return;
    }
    seenSkus.set(row.sku, rowNumber);

    const barcodes = Array.from(
      new Set(
        row.barcodes
          .split("|")
          .map((barcode) => barcode.trim())
          .filter(Boolean),
      ),
    );

    let barcodeValid = true;
    for (const barcode of barcodes) {
      if (!isValidBarcode(barcode, "CODE128")) {
        issues.push({
          rowNumber,
          message: `บาร์โค้ด "${barcode}" ไม่ถูกต้องสำหรับ Code 128`,
        });
        barcodeValid = false;
        continue;
      }

      const duplicateBarcodeRow = seenBarcodes.get(barcode);
      if (duplicateBarcodeRow) {
        issues.push({
          rowNumber,
          message: `บาร์โค้ด ${barcode} ซ้ำกับแถว ${duplicateBarcodeRow}`,
        });
        barcodeValid = false;
      } else {
        seenBarcodes.set(barcode, rowNumber);
      }
    }

    if (!barcodeValid) {
      return;
    }

    candidates.push({
      rowNumber,
      sku: row.sku,
      name: row.name,
      categoryCode: row.categorycode,
      brand: row.brand,
      model: row.model,
      description: row.description,
      costPrice: row.costprice,
      salePrice: row.saleprice,
      reorderLevel: row.reorderlevel,
      warrantyMonths: row.warrantymonths,
      trackSerial: row.trackserial,
      barcodes,
    });
  });

  if (issues.length > 0) {
    throw new InventoryError(
      "IMPORT_ERROR",
      "ข้อมูล CSV บางแถวไม่ถูกต้อง จึงยังไม่บันทึกข้อมูลทั้งหมด",
      formatIssues(issues),
    );
  }

  try {
    return await prisma.$transaction(async (tx) => {
      await lockInventoryKey(tx, "inventory:product-import");

      const categories = await tx.category.findMany({
        where: {
          code: { in: candidates.map((candidate) => candidate.categoryCode) },
          isActive: true,
          deletedAt: null,
        },
        select: { id: true, code: true },
      });
      const categoryMap = new Map(
        categories.map((category) => [category.code, category.id]),
      );

      const skus = candidates.map((candidate) => candidate.sku);
      const existingProducts = await tx.product.findMany({
        where: { sku: { in: skus } },
        select: {
          id: true,
          sku: true,
          stockQty: true,
          costPrice: true,
          trackSerial: true,
          _count: { select: { serials: true } },
        },
      });
      const existingMap = new Map(
        existingProducts.map((product) => [product.sku, product]),
      );

      const allBarcodes = candidates.flatMap((candidate) => candidate.barcodes);
      const existingBarcodes =
        allBarcodes.length > 0
          ? await tx.productBarcode.findMany({
              where: { barcode: { in: allBarcodes } },
              select: { barcode: true, productId: true },
            })
          : [];
      const barcodeOwner = new Map(
        existingBarcodes.map((barcode) => [barcode.barcode, barcode.productId]),
      );

      const dbIssues: ImportIssue[] = [];

      for (const candidate of candidates) {
        const categoryId = categoryMap.get(candidate.categoryCode);
        if (!categoryId) {
          dbIssues.push({
            rowNumber: candidate.rowNumber,
            message: `ไม่พบหมวดหมู่ ${candidate.categoryCode} ที่เปิดใช้งาน`,
          });
          continue;
        }

        const existing = existingMap.get(candidate.sku);

        if (
          existing &&
          existing.stockQty > 0 &&
          !new Decimal(existing.costPrice.toString()).equals(
            new Decimal(candidate.costPrice),
          )
        ) {
          dbIssues.push({
            rowNumber: candidate.rowNumber,
            message:
              "ไม่สามารถเปลี่ยนต้นทุนผ่าน CSV เมื่อสินค้ามีสต๊อกแล้ว ให้ใช้ใบรับสินค้า",
          });
        }

        if (
          existing &&
          existing.trackSerial !== candidate.trackSerial &&
          (existing.stockQty > 0 || existing._count.serials > 0)
        ) {
          dbIssues.push({
            rowNumber: candidate.rowNumber,
            message:
              "ไม่สามารถเปลี่ยนการติดตาม Serial เมื่อมีสต๊อกหรือประวัติ Serial",
          });
        }

        for (const barcode of candidate.barcodes) {
          const owner = barcodeOwner.get(barcode);
          if (owner && owner !== existing?.id) {
            dbIssues.push({
              rowNumber: candidate.rowNumber,
              message: `บาร์โค้ด ${barcode} ถูกใช้กับสินค้าอื่นแล้ว`,
            });
          }
        }
      }

      if (dbIssues.length > 0) {
        throw new InventoryError(
          "IMPORT_ERROR",
          "ข้อมูล CSV ขัดกับข้อมูลในระบบ จึงยังไม่บันทึกข้อมูลทั้งหมด",
          formatIssues(dbIssues),
        );
      }

      let created = 0;
      let updated = 0;

      for (const candidate of candidates) {
        const categoryId = categoryMap.get(candidate.categoryCode);
        if (!categoryId) {
          continue;
        }

        const existing = existingMap.get(candidate.sku);
        let productId: string;

        if (existing) {
          await tx.product.update({
            where: { id: existing.id },
            data: {
              name: candidate.name,
              categoryId,
              brand: candidate.brand ?? null,
              model: candidate.model ?? null,
              description: candidate.description ?? null,
              salePrice: candidate.salePrice,
              reorderLevel: candidate.reorderLevel,
              warrantyMonths: candidate.warrantyMonths,
              trackSerial: candidate.trackSerial,
              ...(existing.stockQty === 0
                ? { costPrice: candidate.costPrice }
                : {}),
            },
          });
          productId = existing.id;
          updated += 1;
        } else {
          const product = await tx.product.create({
            data: {
              sku: candidate.sku,
              name: candidate.name,
              categoryId,
              brand: candidate.brand ?? null,
              model: candidate.model ?? null,
              description: candidate.description ?? null,
              costPrice: candidate.costPrice,
              salePrice: candidate.salePrice,
              reorderLevel: candidate.reorderLevel,
              warrantyMonths: candidate.warrantyMonths,
              trackSerial: candidate.trackSerial,
              createdById: actor.id,
            },
          });
          productId = product.id;
          created += 1;
        }

        if (candidate.barcodes.length > 0) {
          await tx.productBarcode.updateMany({
            where: { productId },
            data: { isPrimary: false },
          });

          for (const [index, barcode] of candidate.barcodes.entries()) {
            const existingBarcode = await tx.productBarcode.findUnique({
              where: { barcode },
              select: { id: true, productId: true },
            });

            if (existingBarcode) {
              await tx.productBarcode.update({
                where: { id: existingBarcode.id },
                data: { isPrimary: index === 0 },
              });
            } else {
              await tx.productBarcode.create({
                data: {
                  productId,
                  barcode,
                  type: "CODE128",
                  isPrimary: index === 0,
                  createdById: actor.id,
                },
              });
            }
          }
        }
      }

      await writeAuditLog(
        {
          actorId: actor.id,
          action: "PRODUCTS_IMPORTED",
          entityType: "Product",
          metadata: {
            total: candidates.length,
            created,
            updated,
            skus: candidates.slice(0, 100).map((candidate) => candidate.sku),
          },
        },
        tx,
      );

      return { created, updated, total: candidates.length };
    });
  } catch (error) {
    if (error instanceof InventoryError) {
      throw error;
    }

    const message =
      error instanceof Error ? error.message : "นำเข้าข้อมูลไม่สำเร็จ";
    throw new InventoryError("IMPORT_ERROR", message);
  }
}

function formatIssues(issues: ImportIssue[]): string[] {
  return issues
    .slice(0, 20)
    .map((issue) => `แถว ${issue.rowNumber}: ${issue.message}`);
}
