import { randomInt, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Role } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { createCategory } from "@/server/services/categories";
import { createCustomer } from "@/server/services/customers";
import { createProduct } from "@/server/services/products";
import { adjustStock } from "@/server/services/stock";
import {
  approveBill,
  createBill,
  markBillPaid,
  submitBill,
} from "@/server/services/bills";
import {
  checkClaimEligibility,
  getCustomerPurchasedProducts,
  lookupWarrantyBySerial,
} from "@/server/services/warranty";

const suffix = randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
const categoryCode = `W${suffix.slice(0, 6)}`;
const primaryPhone = `08${randomInt(10_000_000, 99_999_999)}`;
const secondPhone = `09${randomInt(10_000_000, 99_999_999)}`;
const serialPrefix = `WARR-${suffix}`;

const productIds = new Set<string>();
const customerIds = new Set<string>();
const billIds = new Set<string>();

let admin: { id: string; role: Role };
let technician: { id: string; role: Role };
let otherTechnician: { id: string; role: Role };
let categoryId: string;
let serialProduct: { id: string; sku: string; name: string };
let nonSerialProduct: { id: string; sku: string; name: string };
let customerId: string;
let otherCustomerId: string;
let saleTypeId: string;
let inStockSerial: string;
let soldSerial: string;
let purchaseBillId: string;

function adminActor() {
  return { id: admin.id, role: "ADMIN" as const };
}

function technicianActor() {
  return { id: technician.id, role: "TECHNICIAN" as const };
}

function otherTechnicianActor() {
  return { id: otherTechnician.id, role: "TECHNICIAN" as const };
}

beforeAll(async () => {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, role: true },
  });

  admin = users.find((u) => u.role === "ADMIN")!;
  technician = users.find((u) => u.role === "TECHNICIAN")!;
  otherTechnician = users.find(
    (u) => u.role === "TECHNICIAN" && u.id !== technician.id,
  )!;

  const billType = await prisma.billType.findUnique({
    where: { code: "SALE" },
    select: { id: true },
  });
  saleTypeId = billType!.id;

  const category = await createCategory(adminActor(), {
    code: categoryCode,
    name: `Warranty Cat ${suffix}`,
  });
  categoryId = category.id;

  // 1. Create a product with serial tracking (12 months warranty)
  const productWithSerial = await createProduct(adminActor(), {
    categoryId,
    name: `Warranty Serial Laptop ${suffix}`,
    costPrice: "15000",
    salePrice: "25000",
    reorderLevel: 2,
    warrantyMonths: 12,
    trackSerial: true,
    primaryBarcode: `WBAR1${suffix}`,
    primaryBarcodeType: "CODE128",
  });
  serialProduct = productWithSerial;
  productIds.add(productWithSerial.id);

  // 2. Create non-serial product (6 months warranty)
  const productNoSerial = await createProduct(adminActor(), {
    categoryId,
    name: `Warranty Mouse ${suffix}`,
    costPrice: "200",
    salePrice: "450",
    reorderLevel: 5,
    warrantyMonths: 6,
    trackSerial: false,
    primaryBarcode: `WBAR2${suffix}`,
    primaryBarcodeType: "CODE128",
  });
  nonSerialProduct = productNoSerial;
  productIds.add(productNoSerial.id);

  inStockSerial = `${serialPrefix}-STOCK`;
  soldSerial = `${serialPrefix}-SOLD`;

  // Adjust stock & add serials
  await adjustStock(adminActor(), {
    productId: serialProduct.id,
    direction: "IN",
    quantity: 2,
    unitCost: "15000",
    reason: "Initial serial stock for warranty test",
    serialNumbers: [inStockSerial, soldSerial],
  });

  await adjustStock(adminActor(), {
    productId: nonSerialProduct.id,
    direction: "IN",
    quantity: 10,
    unitCost: "200",
    reason: "Initial non-serial stock",
    serialNumbers: [],
  });

  // Create Customers
  const customer1 = await createCustomer(adminActor(), {
    name: `Warranty Customer A ${suffix}`,
    phone: primaryPhone,
  });
  customerId = customer1.id;
  customerIds.add(customer1.id);

  const customer2 = await createCustomer(adminActor(), {
    name: `Warranty Customer B ${suffix}`,
    phone: secondPhone,
  });
  otherCustomerId = customer2.id;
  customerIds.add(customer2.id);

  // Sell `soldSerial` and `nonSerialProduct` to Customer A in an approved & paid bill
  const soldSerialRow = await prisma.productSerial.findUniqueOrThrow({
    where: { serialNumber: soldSerial },
    select: { id: true },
  });

  const saleBill = await createBill(adminActor(), {
    billTypeId: saleTypeId,
    customerId,
    technicianId: technician.id,
    title: `Sale with serial ${suffix}`,
    description: undefined,
    note: undefined,
    discountType: null,
    discountValue: "0",
    items: [
      {
        kind: "PRODUCT",
        productId: serialProduct.id,
        description: serialProduct.name,
        quantity: 1,
        unitPrice: "25000",
        discountType: null,
        discountValue: "0",
        serialIds: [soldSerialRow.id],
      },
      {
        kind: "PRODUCT",
        productId: nonSerialProduct.id,
        description: nonSerialProduct.name,
        quantity: 2,
        unitPrice: "450",
        discountType: null,
        discountValue: "0",
        serialIds: [],
      },
    ],
  });
  purchaseBillId = saleBill.id;
  billIds.add(saleBill.id);

  await submitBill(adminActor(), saleBill.id);
  await approveBill(adminActor(), saleBill.id);
  await markBillPaid(adminActor(), saleBill.id, "TRANSFER");
});

afterAll(async () => {
  const billIdList = [...billIds];
  const productIdList = [...productIds];
  const customerIdList = [...customerIds];

  await prisma.commissionEntry.deleteMany({
    where: { billId: { in: billIdList } },
  });
  await prisma.billWarrantyClaim.deleteMany({
    where: {
      OR: [
        { billId: { in: billIdList } },
        { originalBillId: { in: billIdList } },
      ],
    },
  });
  await prisma.stockMovement.deleteMany({
    where: {
      OR: [
        { billId: { in: billIdList } },
        { productId: { in: productIdList } },
      ],
    },
  });
  await prisma.billItemSerial.deleteMany({
    where: { billItem: { billId: { in: billIdList } } },
  });
  await prisma.billStatusHistory.deleteMany({
    where: { billId: { in: billIdList } },
  });
  await prisma.billItem.deleteMany({
    where: { billId: { in: billIdList } },
  });
  await prisma.bill.deleteMany({
    where: { id: { in: billIdList } },
  });
  await prisma.productSerial.deleteMany({
    where: { productId: { in: productIdList } },
  });
  await prisma.productBarcode.deleteMany({
    where: { productId: { in: productIdList } },
  });
  await prisma.product.deleteMany({
    where: { id: { in: productIdList } },
  });
  await prisma.category.deleteMany({
    where: { id: categoryId },
  });
  await prisma.customer.deleteMany({
    where: { id: { in: customerIdList } },
  });
});

describe("warranty service", () => {
  it("lookupWarrantyBySerial returns not found for non-existent serial", async () => {
    const result = await lookupWarrantyBySerial(technicianActor(), "NON-EXISTENT-XYZ");
    expect(result.found).toBe(false);
    expect(result.status).toBe("NOT_FOUND");
    expect(result.product).toBeNull();
  });

  it("lookupWarrantyBySerial returns IN_STOCK for unsold serial", async () => {
    const result = await lookupWarrantyBySerial(technicianActor(), inStockSerial);
    expect(result.found).toBe(true);
    expect(result.status).toBe("IN_STOCK");
    expect(result.product?.name).toContain("Laptop");
    expect(result.customer).toBeNull();
    expect(result.originalBill).toBeNull();
    // Unit cost is hidden from technician
    expect(result.serial?.unitCost).toBeNull();

    // Unit cost is visible to admin
    const adminResult = await lookupWarrantyBySerial(adminActor(), inStockSerial);
    expect(Number(adminResult.serial?.unitCost)).toBe(15000);
  });

  it("lookupWarrantyBySerial returns IN_WARRANTY and customer info for sold serial", async () => {
    const result = await lookupWarrantyBySerial(technicianActor(), soldSerial);
    expect(result.found).toBe(true);
    expect(result.status).toBe("IN_WARRANTY");
    expect(result.product?.name).toContain("Laptop");
    expect(result.customer?.id).toBe(customerId);
    expect(result.originalBill?.id).toBe(purchaseBillId);
    expect(result.warranty?.isInWarranty).toBe(true);
    expect(result.warranty?.daysRemaining).toBeGreaterThan(300);
    expect(result.restricted).toBe(false);
  });

  it("hides another technician's sale and customer info from a technician", async () => {
    const result = await lookupWarrantyBySerial(otherTechnicianActor(), soldSerial);

    expect(result.found).toBe(true);
    expect(result.status).toBe("IN_WARRANTY");
    expect(result.restricted).toBe(true);
    expect(result.product?.name).toContain("Laptop");
    expect(result.customer).toBeNull();
    expect(result.originalBill).toBeNull();
    expect(result.claimHistory).toEqual([]);
    expect(result.serial?.unitCost).toBeNull();

    const adminResult = await lookupWarrantyBySerial(adminActor(), soldSerial);
    expect(adminResult.restricted).toBe(false);
    expect(adminResult.customer?.id).toBe(customerId);
    expect(adminResult.originalBill?.id).toBe(purchaseBillId);
  });

  it("checkClaimEligibility by serial matches customer and returns FOUND_IN_WARRANTY", async () => {
    const result = await checkClaimEligibility(technicianActor(), {
      customerId,
      productId: serialProduct.id,
      serialNumber: soldSerial,
    });

    expect(result.result).toBe("FOUND_IN_WARRANTY");
    expect(result.requiresAdminOverride).toBe(false);
    expect(result.originalBill?.id).toBe(purchaseBillId);
    expect(result.daysRemaining).toBeGreaterThan(0);
    expect(result.message).toContain("อยู่ในประกัน");
  });

  it("does not expose another technician's purchase during claim eligibility check", async () => {
    const result = await checkClaimEligibility(otherTechnicianActor(), {
      customerId,
      productId: serialProduct.id,
      serialNumber: soldSerial,
    });

    expect(result.result).toBe("NOT_FOUND");
    expect(result.restricted).toBe(true);
    expect(result.customer).toBeNull();
    expect(result.originalBill).toBeNull();
    expect(result.requiresAdminOverride).toBe(true);
    expect(result.message).toContain("ช่างคนอื่น");
  });

  it("checkClaimEligibility rejects serial if productId does not match", async () => {
    const result = await checkClaimEligibility(technicianActor(), {
      customerId,
      productId: nonSerialProduct.id, // wrong product
      serialNumber: soldSerial,
    });

    expect(result.result).toBe("NOT_FOUND");
    expect(result.requiresAdminOverride).toBe(true);
    expect(result.message).toContain("ไม่ตรงกับสินค้าที่เลือก");
  });

  it("checkClaimEligibility rejects serial if sold to a different customer", async () => {
    const result = await checkClaimEligibility(technicianActor(), {
      customerId: otherCustomerId, // customer B did not buy this
      productId: serialProduct.id,
      serialNumber: soldSerial,
    });

    expect(result.result).toBe("NOT_FOUND");
    expect(result.requiresAdminOverride).toBe(true);
    expect(result.message).toContain("ไม่พบประวัติการซื้อ");
  });

  it("checkClaimEligibility by Customer + Non-serial Product finds purchase history", async () => {
    const result = await checkClaimEligibility(technicianActor(), {
      customerId,
      productId: nonSerialProduct.id,
    });

    expect(result.result).toBe("FOUND_IN_WARRANTY");
    expect(result.requiresAdminOverride).toBe(false);
    expect(result.originalBill?.id).toBe(purchaseBillId);
    expect(result.warrantyMonths).toBe(6);
  });

  it("checkClaimEligibility returns NOT_FOUND if customer never bought the product", async () => {
    const result = await checkClaimEligibility(technicianActor(), {
      customerId: otherCustomerId,
      productId: nonSerialProduct.id,
    });

    expect(result.result).toBe("NOT_FOUND");
    expect(result.requiresAdminOverride).toBe(true);
  });

  it("getCustomerPurchasedProducts lists all items bought by customer", async () => {
    const items = await getCustomerPurchasedProducts(technicianActor(), customerId);
    expect(items.length).toBeGreaterThanOrEqual(2);

    const serialItem = items.find((i) => i.productId === serialProduct.id);
    expect(serialItem).toBeDefined();
    expect(serialItem?.serialNumbers).toContain(soldSerial);
    expect(serialItem?.warrantyStatus).toBe("IN_WARRANTY");

    const nonSerialItem = items.find((i) => i.productId === nonSerialProduct.id);
    expect(nonSerialItem).toBeDefined();
    expect(nonSerialItem?.quantity).toBe(2);
    expect(nonSerialItem?.warrantyStatus).toBe("IN_WARRANTY");
  });

  it("scopes purchased-product history to the owning technician", async () => {
    const otherItems = await getCustomerPurchasedProducts(
      otherTechnicianActor(),
      customerId,
    );
    expect(otherItems).toEqual([]);

    const adminItems = await getCustomerPurchasedProducts(adminActor(), customerId);
    expect(adminItems.length).toBeGreaterThanOrEqual(2);
  });
});
