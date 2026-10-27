import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Role } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { parseCsv, toCsv } from "@/lib/csv";
import { inventoryDateInputValue } from "@/lib/inventory-labels";
import { Decimal } from "@/lib/money";
import { createCategory, setCategoryActive } from "@/server/services/categories";
import {
  createGoodsReceipt,
  getGoodsReceiptById,
  getProductReceiptHistory,
} from "@/server/services/goods-receipts";
import {
  adjustStock,
  getProductSerials,
  listStockMovements,
} from "@/server/services/stock";
import {
  buildProductCsv,
  importProductsCsv,
} from "@/server/services/product-import";
import {
  addProductBarcode,
  createProduct,
  getInventorySummary,
  getProductById,
  listLowStockProducts,
  listProductOptions,
  listProducts,
  removeProductBarcode,
  setPrimaryProductBarcode,
  setProductActive,
} from "@/server/services/products";
import { createSupplier } from "@/server/services/suppliers";
import { productCsvHeaders } from "@/server/validators/inventory";

const suffix = randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
const categoryCode = `T${suffix.slice(0, 6)}`;
const barcodePrefix = `TST${suffix}`;
const importSku = `IMP-${suffix}`;
const invalidImportSku = `IMPBAD-${suffix}`;

let admin: { id: string; role: Role };
let technician: { id: string; role: Role };
let category: { id: string; code: string };
let supplier: { id: string };
let productA: { id: string; sku: string };
let productB: { id: string; sku: string };
let productC: { id: string; sku: string };

const productIds = new Set<string>();
const receiptIds = new Set<string>();

function apiActor(): { id: string; role: Role } {
  return { id: admin.id, role: "ADMIN" };
}

async function expectInventoryError(
  promise: Promise<unknown>,
  code: string,
): Promise<void> {
  await expect(promise).rejects.toMatchObject({ name: "InventoryError", code });
}

beforeAll(async () => {
  const seedAdmin = await prisma.user.findFirst({
    where: { role: "ADMIN", isActive: true },
    select: { id: true },
  });

  if (!seedAdmin) {
    throw new Error("Seeded admin user is required for inventory tests");
  }

  admin = { id: seedAdmin.id, role: "ADMIN" };
  technician = { id: seedAdmin.id, role: "TECHNICIAN" };

  category = await createCategory(apiActor(), {
    code: categoryCode,
    name: `Test Category ${suffix}`,
    description: "Created by Vitest",
  });
  supplier = await createSupplier(apiActor(), {
    name: `Test Supplier ${suffix}`,
    contactName: "Test Contact",
    phone: "020000000",
  });

  productA = await createProduct(apiActor(), {
    name: `Test Monitor ${suffix}`,
    categoryId: category.id,
    defaultSupplierId: supplier.id,
    brand: "TestBrand",
    model: "MON-1",
    description: "Non-serialized test product",
    costPrice: "0.00",
    salePrice: "1590.00",
    reorderLevel: 5,
    warrantyMonths: 12,
    trackSerial: false,
    primaryBarcode: `${barcodePrefix}A1`,
    primaryBarcodeType: "CODE128",
  });
  productIds.add(productA.id);

  productB = await createProduct(apiActor(), {
    name: `Test Notebook ${suffix}`,
    categoryId: category.id,
    defaultSupplierId: supplier.id,
    brand: "TestBrand",
    model: "NB-1",
    costPrice: "0.00",
    salePrice: "25900.00",
    reorderLevel: 2,
    warrantyMonths: 24,
    trackSerial: true,
    primaryBarcode: `${barcodePrefix}B1`,
    primaryBarcodeType: "CODE128",
  });
  productIds.add(productB.id);

  productC = await createProduct(apiActor(), {
    name: `Test Cable ${suffix}`,
    categoryId: category.id,
    brand: "TestBrand",
    costPrice: "0.00",
    salePrice: "99.00",
    reorderLevel: 2,
    warrantyMonths: 0,
    trackSerial: false,
    primaryBarcodeType: "CODE128",
  });
  productIds.add(productC.id);
});

afterAll(async () => {
  const importedProducts = await prisma.product.findMany({
    where: { sku: { in: [importSku, invalidImportSku] } },
    select: { id: true },
  });
  for (const product of importedProducts) {
    productIds.add(product.id);
  }

  const ids = [...productIds];
  const receiptIdList = [...receiptIds];

  await prisma.stockMovement.deleteMany({
    where: {
      OR: [
        { productId: { in: ids } },
        { goodsReceiptItem: { goodsReceiptId: { in: receiptIdList } } },
      ],
    },
  });
  await prisma.productSerial.deleteMany({
    where: { productId: { in: ids } },
  });
  await prisma.goodsReceiptItem.deleteMany({
    where: {
      OR: [
        { goodsReceiptId: { in: receiptIdList } },
        { productId: { in: ids } },
      ],
    },
  });
  await prisma.goodsReceipt.deleteMany({
    where: { id: { in: receiptIdList } },
  });
  await prisma.productBarcode.deleteMany({
    where: { productId: { in: ids } },
  });
  await prisma.product.deleteMany({ where: { id: { in: ids } } });
  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        {
          entityId: {
            in: [...ids, ...receiptIdList, category?.id, supplier?.id].filter(
              (value): value is string => Boolean(value),
            ),
          },
        },
        {
          action: "PRODUCTS_IMPORTED",
          metadata: { path: ["skus"], array_contains: importSku },
        },
      ],
    },
  });
  if (category) {
    await prisma.documentSequence.deleteMany({
      where: { key: `SKU-${category.code}` },
    });
    await prisma.category.deleteMany({ where: { id: category.id } });
  }
  if (supplier) {
    await prisma.supplier.deleteMany({ where: { id: supplier.id } });
  }
});

describe("inventory services", () => {
  it("creates products with generated SKUs, audit history and barcode management", async () => {
    expect(productA.sku).toMatch(new RegExp(`^${category.code}-\\d{4}$`));
    expect(productB.sku).toMatch(new RegExp(`^${category.code}-\\d{4}$`));
    expect(productA.sku).not.toBe(productB.sku);

    const createdAudit = await prisma.auditLog.findFirst({
      where: { action: "PRODUCT_CREATED", entityId: productA.id },
    });
    expect(createdAudit).not.toBeNull();

    const product = await getProductById(apiActor(), productA.id);
    expect(product?.stockQty).toBe(0);
    expect(product?.barcodes).toHaveLength(1);
    expect(product?.barcodes[0]?.isPrimary).toBe(true);

    const secondBarcode = await addProductBarcode(apiActor(), {
      productId: productA.id,
      barcode: `${barcodePrefix}A2`,
      type: "CODE128",
      isPrimary: false,
    });
    expect(secondBarcode.isPrimary).toBe(false);

    await setPrimaryProductBarcode(apiActor(), productA.id, secondBarcode.id);
    let withBarcodes = await getProductById(apiActor(), productA.id);
    expect(
      withBarcodes?.barcodes.find((barcode) => barcode.isPrimary)?.barcode,
    ).toBe(`${barcodePrefix}A2`);

    await removeProductBarcode(apiActor(), productA.id, secondBarcode.id);
    withBarcodes = await getProductById(apiActor(), productA.id);
    expect(withBarcodes?.barcodes).toHaveLength(1);
    expect(withBarcodes?.barcodes[0]?.barcode).toBe(`${barcodePrefix}A1`);
    expect(withBarcodes?.barcodes[0]?.isPrimary).toBe(true);

    await expectInventoryError(
      addProductBarcode(apiActor(), {
        productId: productA.id,
        barcode: `${barcodePrefix}B1`,
        type: "CODE128",
        isPrimary: false,
      }),
      "BARCODE_EXISTS",
    );
  });

  it("receives stock, validates serials and calculates weighted average cost", async () => {
    const receivedDate = inventoryDateInputValue();
    const firstReceipt = await createGoodsReceipt(apiActor(), {
      supplierId: supplier.id,
      receivedDate,
      note: "Vitest first receipt",
      items: [
        {
          productId: productA.id,
          quantity: 10,
          unitCost: "100.00",
          serialNumbers: [],
        },
      ],
    });
    receiptIds.add(firstReceipt.id);

    const secondReceipt = await createGoodsReceipt(apiActor(), {
      supplierId: supplier.id,
      receivedDate,
      items: [
        {
          productId: productA.id,
          quantity: 10,
          unitCost: "200.00",
          serialNumbers: [],
        },
        {
          productId: productB.id,
          quantity: 2,
          unitCost: "500.00",
          serialNumbers: [`SN-${suffix}-1`, `SN-${suffix}-2`],
        },
      ],
    });
    receiptIds.add(secondReceipt.id);

    const storedA = await prisma.product.findUniqueOrThrow({
      where: { id: productA.id },
    });
    const storedB = await prisma.product.findUniqueOrThrow({
      where: { id: productB.id },
    });

    expect(storedA.stockQty).toBe(20);
    expect(storedA.costPrice.toFixed(2)).toBe("150.00");
    expect(storedB.stockQty).toBe(2);
    expect(storedB.costPrice.toFixed(2)).toBe("500.00");

    const receiptDetail = await getGoodsReceiptById(
      apiActor(),
      secondReceipt.id,
    );
    expect(receiptDetail?.items).toHaveLength(2);
    expect(
      new Decimal(receiptDetail?.totalCost.toString() ?? "0").toFixed(2),
    ).toBe("3000.00");

    const serials = await getProductSerials(productB.id);
    expect(serials).toHaveLength(2);
    expect(serials.every((serial) => serial.status === "IN_STOCK")).toBe(true);

    const movementsA = await listStockMovements(apiActor(), {
      productId: productA.id,
    });
    expect(movementsA).toHaveLength(2);
    expect(
      movementsA.map((movement) => movement.balanceAfter).sort((a, b) => a - b),
    ).toEqual([10, 20]);

    const historyA = await getProductReceiptHistory(productA.id);
    expect(historyA).toHaveLength(2);

    const receiptCountBefore = await prisma.goodsReceipt.count({
      where: { supplierId: supplier.id },
    });
    await expectInventoryError(
      createGoodsReceipt(apiActor(), {
        supplierId: supplier.id,
        receivedDate,
        items: [
          {
            productId: productB.id,
            quantity: 2,
            unitCost: "500.00",
            serialNumbers: [`SN-${suffix}-1`],
          },
        ],
      }),
      "SERIAL_REQUIRED",
    );
    await expectInventoryError(
      createGoodsReceipt(apiActor(), {
        supplierId: supplier.id,
        receivedDate,
        items: [
          {
            productId: productB.id,
            quantity: 1,
            unitCost: "500.00",
            serialNumbers: [`SN-${suffix}-1`],
          },
        ],
      }),
      "SERIAL_DUPLICATE",
    );
    expect(
      await prisma.goodsReceipt.count({ where: { supplierId: supplier.id } }),
    ).toBe(receiptCountBefore);

    expect(await prisma.productSerial.count({ where: { productId: productA.id } })).toBe(0);
  });

  it("adjusts stock atomically and disposes or creates serials", async () => {
    await adjustStock(apiActor(), {
      productId: productA.id,
      direction: "OUT",
      quantity: 5,
      reason: "Vitest stock count",
      serialNumbers: [],
    });

    let storedA = await prisma.product.findUniqueOrThrow({
      where: { id: productA.id },
    });
    expect(storedA.stockQty).toBe(15);
    expect(storedA.costPrice.toFixed(2)).toBe("150.00");

    await expectInventoryError(
      adjustStock(apiActor(), {
        productId: productA.id,
        direction: "OUT",
        quantity: 999,
        reason: "Overdraw test",
        serialNumbers: [],
      }),
      "STOCK_INSUFFICIENT",
    );

    const serialsBefore = await getProductSerials(productB.id);
    const serialToDispose = serialsBefore.find(
      (serial) => serial.status === "IN_STOCK",
    );
    if (!serialToDispose) {
      throw new Error("Expected an in-stock serial");
    }

    await adjustStock(apiActor(), {
      productId: productB.id,
      direction: "OUT",
      quantity: 1,
      reason: "Vitest damage disposal",
      serialNumbers: [serialToDispose.serialNumber],
    });

    const disposed = await prisma.productSerial.findUniqueOrThrow({
      where: { id: serialToDispose.id },
    });
    expect(disposed.status).toBe("DISPOSED");

    const newSerial = `SN-${suffix}-3`;
    await adjustStock(apiActor(), {
      productId: productB.id,
      direction: "IN",
      quantity: 1,
      unitCost: "600.00",
      reason: "Vitest serial replacement",
      serialNumbers: [newSerial],
    });

    const storedB = await prisma.product.findUniqueOrThrow({
      where: { id: productB.id },
    });
    expect(storedB.stockQty).toBe(2);
    expect(storedB.costPrice.toFixed(2)).toBe("550.00");

    const serialStatuses = new Map(
      (await getProductSerials(productB.id)).map((serial) => [
        serial.serialNumber,
        serial.status,
      ]),
    );
    expect(serialStatuses.get(newSerial)).toBe("IN_STOCK");
    expect(serialStatuses.get(serialToDispose.serialNumber)).toBe("DISPOSED");

    await expectInventoryError(
      adjustStock(apiActor(), {
        productId: productB.id,
        direction: "OUT",
        quantity: 1,
        reason: "Missing serial test",
        serialNumbers: ["SN-DOES-NOT-EXIST"],
      }),
      "SERIAL_NOT_FOUND",
    );

    await expectInventoryError(
      adjustStock(apiActor(), {
        productId: productB.id,
        direction: "IN",
        quantity: 1,
        unitCost: "600.00",
        reason: "Duplicate serial test",
        serialNumbers: [serialToDispose.serialNumber],
      }),
      "SERIAL_DUPLICATE",
    );

    await expectInventoryError(
      adjustStock(apiActor(), {
        productId: productA.id,
        direction: "OUT",
        quantity: 1,
        reason: "Serial on non-serial product",
        serialNumbers: ["SN-NOT-TRACKED"],
      }),
      "PRODUCT_NOT_TRACKING_SERIAL",
    );

    storedA = await prisma.product.findUniqueOrThrow({
      where: { id: productA.id },
    });
    expect(storedA.stockQty).toBe(15);

    const lowStock = await listLowStockProducts();
    expect(lowStock.some((product) => product.id === productC.id)).toBe(true);
    expect(lowStock.some((product) => product.id === productA.id)).toBe(false);

    await expectInventoryError(
      setProductActive(apiActor(), productA.id, false),
      "PRODUCT_HAS_STOCK",
    );

    await setProductActive(apiActor(), productC.id, false);
    const archivedC = await prisma.product.findUniqueOrThrow({
      where: { id: productC.id },
    });
    expect(archivedC.deletedAt).not.toBeNull();
    expect(
      (await listProducts(apiActor(), { status: "archived" })).some(
        (product) => product.id === productC.id,
      ),
    ).toBe(true);
    expect(
      (await listProducts(technician)).some(
        (product) => product.id === productC.id,
      ),
    ).toBe(false);

    await expectInventoryError(
      setCategoryActive(apiActor(), category.id, false),
      "CATEGORY_IN_USE",
    );

    await setProductActive(apiActor(), productC.id, true);
    const restoredC = await prisma.product.findUniqueOrThrow({
      where: { id: productC.id },
    });
    expect(restoredC.deletedAt).toBeNull();
  });

  it("exports and imports CSV atomically without changing stock", async () => {
    const exported = await buildProductCsv(apiActor());
    const parsedExport = parseCsv(exported.csv);
    expect(parsedExport.headers).toEqual([...productCsvHeaders]);
    const exportedA = parsedExport.records.find(
      (record) => record.sku === productA.sku,
    );
    expect(exportedA?.name).toBe(`Test Monitor ${suffix}`);
    expect(exportedA?.barcodes).toBe(`${barcodePrefix}A1`);

    const importCsv = toCsv([...productCsvHeaders], [
      [
        importSku,
        `Test Import ${suffix}`,
        category.code,
        "ImportBrand",
        "IMP-1",
        "Created by Vitest CSV import",
        "250.00",
        "399.00",
        "2",
        "6",
        "false",
        `${barcodePrefix}D1`,
      ],
    ]);
    const imported = await importProductsCsv(apiActor(), importCsv);
    expect(imported).toEqual({ created: 1, updated: 0, total: 1 });

    const importedProduct = await prisma.product.findUniqueOrThrow({
      where: { sku: importSku },
    });
    productIds.add(importedProduct.id);
    expect(importedProduct.stockQty).toBe(0);
    expect(importedProduct.costPrice.toFixed(2)).toBe("250.00");
    expect(importedProduct.salePrice.toFixed(2)).toBe("399.00");

    const updateCsv = toCsv([...productCsvHeaders], [
      [
        importSku,
        `Test Import Updated ${suffix}`,
        category.code,
        "ImportBrand",
        "IMP-1",
        "Updated by Vitest CSV import",
        "250.00",
        "449.00",
        "2",
        "6",
        "false",
        "",
      ],
    ]);
    const updated = await importProductsCsv(apiActor(), updateCsv);
    expect(updated).toEqual({ created: 0, updated: 1, total: 1 });
    const updatedProduct = await prisma.product.findUniqueOrThrow({
      where: { sku: importSku },
    });
    expect(updatedProduct.name).toBe(`Test Import Updated ${suffix}`);
    expect(updatedProduct.salePrice.toFixed(2)).toBe("449.00");

    const invalidCsv = toCsv([...productCsvHeaders], [
      [
        invalidImportSku,
        `Test Invalid ${suffix}`,
        category.code,
        "",
        "",
        "",
        "10.00",
        "20.00",
        "1",
        "0",
        "false",
        "",
      ],
      [
        `${invalidImportSku}-2`,
        `Test Invalid Category ${suffix}`,
        "NO_SUCH_CATEGORY",
        "",
        "",
        "",
        "10.00",
        "20.00",
        "1",
        "0",
        "false",
        "",
      ],
    ]);
    await expectInventoryError(
      importProductsCsv(apiActor(), invalidCsv),
      "IMPORT_ERROR",
    );
    expect(
      await prisma.product.count({
        where: { sku: { startsWith: invalidImportSku } },
      }),
    ).toBe(0);

    const costChangeCsv = toCsv([...productCsvHeaders], [
      [
        productA.sku,
        `Test Monitor ${suffix}`,
        category.code,
        "TestBrand",
        "MON-1",
        "Attempted cost change",
        "999.00",
        "1590.00",
        "5",
        "12",
        "false",
        `${barcodePrefix}A1`,
      ],
    ]);
    await expectInventoryError(
      importProductsCsv(apiActor(), costChangeCsv),
      "IMPORT_ERROR",
    );
    const unchangedA = await prisma.product.findUniqueOrThrow({
      where: { id: productA.id },
    });
    expect(unchangedA.costPrice.toFixed(2)).toBe("150.00");
  });

  it("enforces admin-only writes while allowing read access for technicians", async () => {
    await expectInventoryError(
      createProduct(technician, {
        name: "Forbidden Product",
        categoryId: category.id,
        costPrice: "0.00",
        salePrice: "1.00",
        reorderLevel: 0,
        warrantyMonths: 0,
        trackSerial: false,
        primaryBarcodeType: "CODE128",
      }),
      "FORBIDDEN",
    );

    await expectInventoryError(
      importProductsCsv(technician, "sku,name\nA,B"),
      "FORBIDDEN",
    );

    await expectInventoryError(
      createGoodsReceipt(technician, {
        supplierId: supplier.id,
        receivedDate: inventoryDateInputValue(),
        items: [
          {
            productId: productA.id,
            quantity: 1,
            unitCost: "1.00",
            serialNumbers: [],
          },
        ],
      }),
      "FORBIDDEN",
    );

    await expectInventoryError(
      adjustStock(technician, {
        productId: productA.id,
        direction: "IN",
        quantity: 1,
        unitCost: "1.00",
        reason: "Forbidden adjustment",
        serialNumbers: [],
      }),
      "FORBIDDEN",
    );

    await expectInventoryError(listProductOptions(technician), "FORBIDDEN");

    const techSummary = await getInventorySummary(technician);
    expect(techSummary.stockValue).toBeNull();
    expect(techSummary.productCount).toBeGreaterThanOrEqual(3);

    const adminSummary = await getInventorySummary(apiActor());
    expect(adminSummary.stockValue).not.toBeNull();
    expect(
      (adminSummary.stockValue as Decimal).greaterThanOrEqualTo(0),
    ).toBe(true);

    const techProducts = await listProducts(technician);
    expect(techProducts.some((product) => product.id === productA.id)).toBe(
      true,
    );
  });
});
