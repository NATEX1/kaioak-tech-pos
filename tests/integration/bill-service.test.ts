import { randomInt, randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Role } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { createCategory } from "@/server/services/categories";
import { createCustomer } from "@/server/services/customers";
import { adjustStock } from "@/server/services/stock";
import { createProduct } from "@/server/services/products";
import type {
  BillCreateInput,
  BillItemInput,
  BillUpdateInput,
} from "@/server/validators/bills";
import {
  approveBill,
  canEditBill,
  createBill,
  getBillById,
  getBillSummary,
  listBills,
  markBillPaid,
  rejectBill,
  submitBill,
  updateBill,
  voidBill,
} from "@/server/services/bills";

const suffix = randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
const categoryCode = `B${suffix.slice(0, 6)}`;
const barcodePrefix = `BILL${suffix}`;
const primaryPhone = `06${randomInt(10_000_000, 99_999_999)}`;
const secondPhone = `05${randomInt(10_000_000, 99_999_999)}`;
const serialPrefix = `TST-${suffix}`;

const productIds = new Set<string>();
const customerIds = new Set<string>();
const billIds = new Set<string>();

let admin: { id: string; role: Role };
let technician: { id: string; role: Role };
let otherTechnician: { id: string; role: Role };
let categoryId: string;
let nonSerialProduct: { id: string; sku: string; name: string };
let serialProduct: { id: string; sku: string; name: string };
let serialOneId: string;
let customerId: string;
let secondCustomerId: string;
let saleTypeId: string;
let repairTypeId: string;
let claimTypeId: string;
let mainBillId: string;
let purchaseBillId: string;
let claimBillId: string;
let overrideClaimBillId: string;

function adminActor() {
  return { id: admin.id, role: "ADMIN" as const };
}

function techActor() {
  return technician;
}

function otherTechActor() {
  return otherTechnician;
}

async function expectBillError(
  promise: Promise<unknown>,
  code: string,
): Promise<void> {
  await expect(promise).rejects.toMatchObject({ name: "BillError", code });
}

function productItem(
  quantity: number,
  options: {
    productId?: string;
    unitPrice?: string;
    discountType?: "PERCENT" | "AMOUNT" | null;
    discountValue?: string;
    serialIds?: string[];
  } = {},
): BillItemInput {
  return {
    kind: "PRODUCT",
    productId: options.productId ?? nonSerialProduct.id,
    description: undefined,
    quantity,
    unitPrice: options.unitPrice ?? "1590.00",
    discountType: options.discountType ?? null,
    discountValue: options.discountValue ?? "0",
    serialIds: options.serialIds ?? [],
  };
}

function serviceItem(
  description: string,
  unitPrice = "0.00",
): BillItemInput {
  return {
    kind: "SERVICE",
    productId: undefined,
    description,
    quantity: 1,
    unitPrice,
    discountType: null,
    discountValue: "0",
    serialIds: [],
  };
}

function saleBillInput(
  overrides: Partial<BillCreateInput> & Pick<BillCreateInput, "title">,
): BillCreateInput {
  return {
    billTypeId: saleTypeId,
    customerId,
    technicianId: undefined,
    description: undefined,
    note: undefined,
    discountType: null,
    discountValue: "0",
    items: [productItem(1)],
    repair: undefined,
    claim: undefined,
    ...overrides,
  };
}

async function createTrackedBill(
  actor: { id: string; role: Role },
  input: BillCreateInput,
) {
  const bill = await createBill(actor, input);
  billIds.add(bill.id);
  return bill;
}

async function createPaidPurchase() {
  const bill = await createTrackedBill(
    techActor(),
    saleBillInput({
      title: `Test paid purchase ${suffix}`,
      items: [productItem(1)],
    }),
  );
  await submitBill(techActor(), bill.id);
  await approveBill(adminActor(), bill.id);
  await markBillPaid(adminActor(), bill.id, "CASH");
  return bill.id;
}

beforeAll(async () => {
  const [seedAdmins, seedTechnicians, billTypes] = await Promise.all([
    prisma.user.findMany({
      where: { role: "ADMIN", isActive: true },
      orderBy: { email: "asc" },
      take: 1,
      select: { id: true },
    }),
    prisma.user.findMany({
      where: { role: "TECHNICIAN", isActive: true },
      orderBy: { email: "asc" },
      take: 2,
      select: { id: true },
    }),
    prisma.billType.findMany({
      where: { code: { in: ["SALE", "REPAIR", "WARRANTY_CLAIM"] } },
      select: { id: true, code: true },
    }),
  ]);

  if (
    !seedAdmins[0] ||
    !seedTechnicians[0] ||
    !seedTechnicians[1] ||
    billTypes.length !== 3
  ) {
    throw new Error("Seed users and bill types are required for bill tests");
  }

  admin = { id: seedAdmins[0].id, role: "ADMIN" };
  technician = { id: seedTechnicians[0].id, role: "TECHNICIAN" };
  otherTechnician = { id: seedTechnicians[1].id, role: "TECHNICIAN" };
  saleTypeId = billTypes.find((type) => type.code === "SALE")!.id;
  repairTypeId = billTypes.find((type) => type.code === "REPAIR")!.id;
  claimTypeId = billTypes.find((type) => type.code === "WARRANTY_CLAIM")!.id;

  const category = await createCategory(adminActor(), {
    code: categoryCode,
    name: `Bill Test Category ${suffix}`,
    description: "Created by Vitest bill tests",
  });
  categoryId = category.id;

  nonSerialProduct = await createProduct(adminActor(), {
    name: `Bill Test Monitor ${suffix}`,
    categoryId,
    brand: "TestBrand",
    model: "BILL-MON",
    description: "Non-serialized bill test product",
    costPrice: "0.00",
    salePrice: "1590.00",
    reorderLevel: 3,
    warrantyMonths: 12,
    trackSerial: false,
    primaryBarcode: `${barcodePrefix}NS`,
    primaryBarcodeType: "CODE128",
  });
  productIds.add(nonSerialProduct.id);

  serialProduct = await createProduct(adminActor(), {
    name: `Bill Test Notebook ${suffix}`,
    categoryId,
    brand: "TestBrand",
    model: "BILL-NB",
    description: "Serialized bill test product",
    costPrice: "0.00",
    salePrice: "25900.00",
    reorderLevel: 1,
    warrantyMonths: 24,
    trackSerial: true,
    primaryBarcode: `${barcodePrefix}SN`,
    primaryBarcodeType: "CODE128",
  });
  productIds.add(serialProduct.id);

  await adjustStock(adminActor(), {
    productId: nonSerialProduct.id,
    direction: "IN",
    quantity: 10,
    unitCost: "100.00",
    reason: `Bill test fixture ${suffix}`,
    serialNumbers: [],
  });
  await adjustStock(adminActor(), {
    productId: serialProduct.id,
    direction: "IN",
    quantity: 2,
    unitCost: "500.00",
    reason: `Bill test serial fixture ${suffix}`,
    serialNumbers: [`${serialPrefix}-01`, `${serialPrefix}-02`],
  });

  const serialRow = await prisma.productSerial.findUnique({
    where: { serialNumber: `${serialPrefix}-01` },
    select: { id: true },
  });
  if (!serialRow) {
    throw new Error("Serial fixture was not created");
  }
  serialOneId = serialRow.id;

  const customer = await createCustomer(adminActor(), {
    name: `Bill Test Customer ${suffix}`,
    phone: primaryPhone,
    email: "bill-customer@example.local",
  });
  customerId = customer.id;
  customerIds.add(customer.id);

  const secondCustomer = await createCustomer(adminActor(), {
    name: `Bill Test Customer 2 ${suffix}`,
    phone: secondPhone,
  });
  secondCustomerId = secondCustomer.id;
  customerIds.add(secondCustomer.id);
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
  await prisma.bill.deleteMany({ where: { id: { in: billIdList } } });
  await prisma.productSerial.deleteMany({
    where: { productId: { in: productIdList } },
  });
  await prisma.productBarcode.deleteMany({
    where: { productId: { in: productIdList } },
  });
  await prisma.product.deleteMany({ where: { id: { in: productIdList } } });
  await prisma.customer.deleteMany({
    where: { id: { in: customerIdList } },
  });
  await prisma.auditLog.deleteMany({
    where: {
      entityId: {
        in: [...billIdList, ...productIdList, ...customerIdList, categoryId].filter(
          (value): value is string => Boolean(value),
        ),
      },
    },
  });
  if (categoryId) {
    await prisma.documentSequence.deleteMany({
      where: { key: `SKU-${categoryCode}` },
    });
    await prisma.category.deleteMany({ where: { id: categoryId } });
  }
});

describe("bill service", () => {
  it("creates a draft bill with server-calculated totals without deducting stock", async () => {
    const bill = await createTrackedBill(techActor(), {
      ...saleBillInput({
        title: `Test sale ${suffix}`,
        technicianId: otherTechnician.id,
        discountType: "AMOUNT",
        discountValue: "100.00",
        items: [
          productItem(2, {
            unitPrice: "1590.00",
            discountType: "PERCENT",
            discountValue: "10",
          }),
          productItem(1, {
            productId: serialProduct.id,
            unitPrice: "25900.00",
            serialIds: [serialOneId],
          }),
        ],
      }),
    });
    mainBillId = bill.id;

    expect(bill.billNumber).toMatch(/^INV-\d{4}-\d{6}$/);

    const detail = await getBillById(adminActor(), bill.id);
    expect(detail?.status).toBe("DRAFT");
    expect(detail?.technicianId).toBe(technician.id);
    expect(detail?.subtotal.toFixed(2)).toBe("28762.00");
    expect(detail?.lineDiscountTotal.toFixed(2)).toBe("318.00");
    expect(detail?.discountAmount.toFixed(2)).toBe("100.00");
    expect(detail?.grandTotal.toFixed(2)).toBe("28662.00");
    expect(detail?.items).toHaveLength(2);
    expect(detail?.statusHistory).toHaveLength(1);

    const product = await prisma.product.findUnique({
      where: { id: nonSerialProduct.id },
      select: { stockQty: true },
    });
    const serial = await prisma.productSerial.findUnique({
      where: { id: serialOneId },
      select: { status: true },
    });
    expect(product?.stockQty).toBe(10);
    expect(serial?.status).toBe("IN_STOCK");

    const audit = await prisma.auditLog.findFirst({
      where: { action: "BILL_CREATED", entityId: bill.id },
    });
    expect(audit?.actorId).toBe(technician.id);
  });

  it("enforces technician bill visibility, ownership and edit rules", async () => {
    const { items: techBills } = await listBills(techActor());
    expect(techBills.length).toBeGreaterThan(0);
    expect(techBills.every((bill) => bill.technician.id === technician.id)).toBe(
      true,
    );

    const { items: otherBills } = await listBills(otherTechActor());
    expect(otherBills.some((bill) => bill.id === mainBillId)).toBe(false);
    expect(await getBillById(otherTechActor(), mainBillId)).toBeNull();

    const detail = await getBillById(techActor(), mainBillId);
    expect(detail?.status).toBe("DRAFT");
    expect(
      canEditBill(otherTechActor(), {
        id: mainBillId,
        status: "DRAFT",
        technicianId: technician.id,
      }),
    ).toBe(false);

    const updateInput: BillUpdateInput = {
      ...saleBillInput({ title: `Forbidden edit ${suffix}` }),
      billId: mainBillId,
    };

    await expectBillError(
      updateBill(otherTechActor(), updateInput),
      "INVALID_STATUS",
    );
  });

  it("submits a draft and rechecks stock without deducting it", async () => {
    await submitBill(techActor(), mainBillId);

    const detail = await getBillById(techActor(), mainBillId);
    expect(detail?.status).toBe("PENDING_APPROVAL");
    expect(detail?.submittedAt).not.toBeNull();

    const product = await prisma.product.findUnique({
      where: { id: nonSerialProduct.id },
      select: { stockQty: true },
    });
    expect(product?.stockQty).toBe(10);
  });

  it("prevents technicians from approving, rejecting, paying or voiding bills", async () => {
    await expectBillError(
      approveBill(techActor(), mainBillId),
      "FORBIDDEN",
    );
    await expectBillError(
      rejectBill(techActor(), mainBillId, "Forbidden reject"),
      "FORBIDDEN",
    );
    await expectBillError(
      markBillPaid(techActor(), mainBillId, "CASH"),
      "FORBIDDEN",
    );
    await expectBillError(
      voidBill(techActor(), mainBillId, "Forbidden void"),
      "FORBIDDEN",
    );
  });

  it("approves atomically, deducts stock, sells serials and snapshots warranty", async () => {
    await approveBill(adminActor(), mainBillId);

    const detail = await getBillById(adminActor(), mainBillId);
    expect(detail?.status).toBe("APPROVED");
    expect(detail?.approvedAt).not.toBeNull();
    expect(detail?.stockDeductedAt).not.toBeNull();
    expect(detail?.statusHistory.map((entry) => entry.toStatus)).toEqual([
      "DRAFT",
      "PENDING_APPROVAL",
      "APPROVED",
    ]);

    const product = await prisma.product.findUnique({
      where: { id: nonSerialProduct.id },
      select: { stockQty: true },
    });
    const serialProductRow = await prisma.product.findUnique({
      where: { id: serialProduct.id },
      select: { stockQty: true },
    });
    expect(product?.stockQty).toBe(8);
    expect(serialProductRow?.stockQty).toBe(1);

    const serial = await prisma.productSerial.findUnique({
      where: { id: serialOneId },
      select: {
        status: true,
        soldAt: true,
        warrantyStartAt: true,
        warrantyEndAt: true,
      },
    });
    expect(serial?.status).toBe("SOLD");
    expect(serial?.soldAt).not.toBeNull();
    expect(serial?.warrantyEndAt?.getTime()).toBeGreaterThan(
      serial?.warrantyStartAt?.getTime() ?? 0,
    );

    const movements = await prisma.stockMovement.findMany({
      where: { billId: mainBillId, type: "SALE" },
      orderBy: { quantityDelta: "asc" },
      select: { quantityDelta: true, balanceAfter: true, billItemId: true },
    });
    expect(movements).toHaveLength(2);
    expect(movements.map((movement) => movement.quantityDelta)).toEqual([-2, -1]);

    const itemCosts = await prisma.billItem.findMany({
      where: { billId: mainBillId },
      orderBy: { sortOrder: "asc" },
      select: { unitCost: true },
    });
    expect(itemCosts.map((item) => item.unitCost.toFixed(2))).toEqual([
      "100.00",
      "500.00",
    ]);

    await expectBillError(
      approveBill(adminActor(), mainBillId),
      "INVALID_STATUS",
    );
  });

  it("marks a bill paid and then voids it while restoring stock and serials", async () => {
    await markBillPaid(adminActor(), mainBillId, "CASH");
    const paid = await getBillById(adminActor(), mainBillId);
    expect(paid?.status).toBe("PAID");
    expect(paid?.paymentMethod).toBe("CASH");
    expect(paid?.paidAt).not.toBeNull();

    await voidBill(adminActor(), mainBillId, "Test void and restock");

    const voided = await getBillById(adminActor(), mainBillId);
    expect(voided?.status).toBe("VOIDED");
    expect(voided?.voidReason).toBe("Test void and restock");
    expect(voided?.stockRestoredAt).not.toBeNull();
    expect(voided?.statusHistory.at(-1)?.toStatus).toBe("VOIDED");

    const product = await prisma.product.findUnique({
      where: { id: nonSerialProduct.id },
      select: { stockQty: true },
    });
    const serialProductRow = await prisma.product.findUnique({
      where: { id: serialProduct.id },
      select: { stockQty: true },
    });
    expect(product?.stockQty).toBe(10);
    expect(serialProductRow?.stockQty).toBe(2);

    const serial = await prisma.productSerial.findUnique({
      where: { id: serialOneId },
      select: {
        status: true,
        soldAt: true,
        warrantyStartAt: true,
        warrantyEndAt: true,
      },
    });
    expect(serial).toEqual({
      status: "IN_STOCK",
      soldAt: null,
      warrantyStartAt: null,
      warrantyEndAt: null,
    });

    const released = await prisma.billItemSerial.findFirst({
      where: { productSerialId: serialOneId, billItem: { billId: mainBillId } },
      select: { releasedAt: true },
    });
    expect(released?.releasedAt).not.toBeNull();

    const movements = await prisma.stockMovement.findMany({
      where: { billId: mainBillId },
      select: {
        type: true,
        quantityDelta: true,
        sourceMovementId: true,
      },
    });
    const restores = movements.filter(
      (movement) => movement.type === "VOID_RESTOCK",
    );
    const sales = movements.filter((movement) => movement.type === "SALE");
    expect(restores).toHaveLength(2);
    expect(sales).toHaveLength(2);
    expect(restores.every((movement) => movement.sourceMovementId)).toBe(true);
    expect(restores.map((movement) => movement.quantityDelta).sort()).toEqual([
      1, 2,
    ]);
  });

  it("blocks submission when stock is insufficient and leaves stock untouched", async () => {
    const bill = await createTrackedBill(
      techActor(),
      saleBillInput({
        title: `Oversell ${suffix}`,
        items: [productItem(20)],
      }),
    );

    await expectBillError(
      submitBill(techActor(), bill.id),
      "STOCK_INSUFFICIENT",
    );

    const detail = await getBillById(adminActor(), bill.id);
    expect(detail?.status).toBe("DRAFT");

    const product = await prisma.product.findUnique({
      where: { id: nonSerialProduct.id },
      select: { stockQty: true },
    });
    expect(product?.stockQty).toBe(10);
  });

  it("requires serials for serialized products and validates discounts", async () => {
    await expectBillError(
      createBill(
        techActor(),
        saleBillInput({
          title: `Missing serial ${suffix}`,
          items: [
            productItem(1, {
              productId: serialProduct.id,
              unitPrice: "25900.00",
            }),
          ],
        }),
      ),
      "SERIAL_REQUIRED",
    );

    await expectBillError(
      createBill(
        techActor(),
        saleBillInput({
          title: `Invalid discount ${suffix}`,
          items: [
            productItem(1, {
              unitPrice: "100.00",
              discountType: "AMOUNT",
              discountValue: "101.00",
            }),
          ],
        }),
      ),
      "INVALID_DISCOUNT",
    );
  });

  it("rejects a bill, lets the owner edit it, and supports resubmission", async () => {
    const bill = await createTrackedBill(
      techActor(),
      saleBillInput({
        title: `Reject flow ${suffix}`,
        items: [productItem(1)],
      }),
    );
    await submitBill(techActor(), bill.id);
    await rejectBill(adminActor(), bill.id, "Need to review the price");

    const rejected = await getBillById(techActor(), bill.id);
    expect(rejected?.status).toBe("REJECTED");
    expect(rejected?.rejectionReason).toBe("Need to review the price");

    const updated = await updateBill(techActor(), {
      ...saleBillInput({
        title: `Reject flow edited ${suffix}`,
        items: [productItem(1)],
      }),
      billId: bill.id,
    });
    expect(updated.id).toBe(bill.id);

    const afterUpdate = await getBillById(techActor(), bill.id);
    expect(afterUpdate?.status).toBe("REJECTED");
    expect(afterUpdate?.title).toBe(`Reject flow edited ${suffix}`);

    await submitBill(techActor(), bill.id);
    const resubmitted = await getBillById(techActor(), bill.id);
    expect(resubmitted?.status).toBe("PENDING_APPROVAL");
    expect(resubmitted?.rejectionReason).toBeNull();
  });

  it("requires repair symptoms before a repair bill can be submitted", async () => {
    const bill = await createTrackedBill(techActor(), {
      ...saleBillInput({
        billTypeId: repairTypeId,
        title: `Repair flow ${suffix}`,
        items: [serviceItem("ค่าตรวจเช็คเครื่อง", "500.00")],
      }),
      repair: {
        deviceBrand: "TestBrand",
        deviceModel: "REPAIR-1",
        deviceSerial: `REPAIR-${suffix}`,
        reportedSymptoms: "",
        diagnosis: undefined,
        resolution: undefined,
        repairStatus: "RECEIVED",
      },
    });

    await expectBillError(
      submitBill(techActor(), bill.id),
      "REPAIR_DETAIL_REQUIRED",
    );

    await updateBill(techActor(), {
      ...saleBillInput({
        billTypeId: repairTypeId,
        title: `Repair flow ${suffix}`,
        items: [serviceItem("ค่าตรวจเช็คเครื่อง", "500.00")],
      }),
      billId: bill.id,
      repair: {
        deviceBrand: "TestBrand",
        deviceModel: "REPAIR-1",
        deviceSerial: `REPAIR-${suffix}`,
        reportedSymptoms: "เปิดเครื่องไม่ติด มีไฟสถานะกระพริบ",
        diagnosis: "Adapter ชำรุด",
        resolution: "เปลี่ยน adapter",
        repairStatus: "INSPECTING",
      },
    });

    await submitBill(techActor(), bill.id);
    const detail = await getBillById(techActor(), bill.id);
    expect(detail?.status).toBe("PENDING_APPROVAL");
    expect(detail?.repairDetail?.reportedSymptoms).toContain("เปิดเครื่องไม่ติด");
  });

  it("verifies warranty claims against a real paid purchase", async () => {
    purchaseBillId = await createPaidPurchase();

    const bill = await createTrackedBill(techActor(), {
      ...saleBillInput({
        billTypeId: claimTypeId,
        title: `Warranty claim ${suffix}`,
        items: [serviceItem("ตรวจสอบและเคลมสินค้า")],
      }),
      claim: {
        productId: nonSerialProduct.id,
        serialNumber: undefined,
        note: "ลูกค้าแจ้งว่าจอมีเส้น",
      },
    });
    claimBillId = bill.id;

    await submitBill(techActor(), bill.id);

    const submitted = await getBillById(techActor(), bill.id);
    expect(submitted?.warrantyClaim?.checkResult).toBe("FOUND_IN_WARRANTY");
    expect(submitted?.warrantyClaim?.originalBillId).toBe(purchaseBillId);
    expect(submitted?.warrantyClaim?.warrantyEndsAt).not.toBeNull();

    await approveBill(adminActor(), bill.id);
    const approved = await getBillById(adminActor(), bill.id);
    expect(approved?.status).toBe("APPROVED");
    expect(approved?.warrantyClaim?.checkResult).toBe("FOUND_IN_WARRANTY");
  });

  it("requires an admin override when no purchase history is found", async () => {
    const bill = await createTrackedBill(techActor(), {
      ...saleBillInput({
        billTypeId: claimTypeId,
        customerId: secondCustomerId,
        title: `Warranty override ${suffix}`,
        items: [serviceItem("ตรวจสอบเคลมกรณีไม่มีประวัติ")],
      }),
      claim: {
        productId: nonSerialProduct.id,
        serialNumber: undefined,
        note: "ไม่มีประวัติในระบบ",
      },
    });
    overrideClaimBillId = bill.id;

    await submitBill(techActor(), bill.id);
    const submitted = await getBillById(adminActor(), bill.id);
    expect(submitted?.warrantyClaim?.checkResult).toBe("NOT_FOUND");

    await expectBillError(
      approveBill(adminActor(), bill.id),
      "WARRANTY_OVERRIDE_REQUIRED",
    );

    await approveBill(adminActor(), bill.id, {
      overrideReason: "ลูกค้านำใบเสร็จกระดาษจากสาขาเดิมมาแสดง",
    });

    const approved = await getBillById(adminActor(), bill.id);
    expect(approved?.status).toBe("APPROVED");
    expect(approved?.warrantyClaim?.adminOverrideReason).toContain(
      "ใบเสร็จกระดาษ",
    );
  });

  it("exposes scoped pending summaries for admins and technicians", async () => {
    const adminSummary = await getBillSummary(adminActor());
    const techSummary = await getBillSummary(techActor());

    expect(adminSummary.pendingCount).toBeGreaterThanOrEqual(
      techSummary.pendingCount,
    );
    expect(techSummary.pendingCount).toBeGreaterThan(0);
    expect(techSummary.approvedCount).toBeGreaterThan(0);

    const { items: pendingList, totalCount: pendingTotal } = await listBills(adminActor(), {
      status: "PENDING_APPROVAL",
    });
    expect(pendingList.length).toBeGreaterThan(0);
    expect(pendingTotal).toBeGreaterThan(0);
    expect(pendingList.every((bill) => bill.status === "PENDING_APPROVAL")).toBe(
      true,
    );
    expect(pendingList.some((bill) => bill.id === claimBillId)).toBe(false);
    expect(pendingList.some((bill) => bill.id === overrideClaimBillId)).toBe(
      false,
    );
  });

  it("prevents creating duplicate warranty claims for the same product and customer", async () => {
    // claimBillId is already an active APPROVED claim for nonSerialProduct and customerId
    await expectBillError(
      createBill(techActor(), {
        ...saleBillInput({
          billTypeId: claimTypeId,
          customerId,
          title: `Duplicate warranty claim ${suffix}`,
          items: [serviceItem("ทดสอบเคลมซ้ำ")],
        }),
        claim: {
          productId: nonSerialProduct.id,
          serialNumber: undefined,
          note: "พยายามเปิดเคลมซ้ำ",
        },
      }),
      "DUPLICATE_WARRANTY_CLAIM",
    );
  });

  it("transitions serial status to CLAIMED on approval and prevents voiding the purchase bill", async () => {
    // 1. Create and approve a purchase bill with serial
    const saleBill = await createTrackedBill(techActor(), {
      ...saleBillInput({
        billTypeId: saleTypeId,
        customerId,
        title: `Purchase with serial for claim ${suffix}`,
        items: [
          {
            kind: "PRODUCT",
            productId: serialProduct.id,
            description: undefined,
            quantity: 1,
            unitPrice: "24900.00",
            discountType: null,
            discountValue: "0",
            serialIds: [serialOneId],
          },
        ],
      }),
    });
    await submitBill(techActor(), saleBill.id);
    await approveBill(adminActor(), saleBill.id);

    const soldSerial = await prisma.productSerial.findUnique({
      where: { id: serialOneId },
      select: { status: true, serialNumber: true },
    });
    expect(soldSerial?.status).toBe("SOLD");

    // 2. Open a warranty claim bill for this serial
    const serialClaimBill = await createTrackedBill(techActor(), {
      ...saleBillInput({
        billTypeId: claimTypeId,
        customerId,
        title: `Claim for serial ${suffix}`,
        items: [serviceItem("เคลมเครื่องตาม Serial")],
      }),
      claim: {
        productId: serialProduct.id,
        serialNumber: soldSerial?.serialNumber,
        note: "เคลมเมนบอร์ด",
      },
    });

    await submitBill(techActor(), serialClaimBill.id);
    await approveBill(adminActor(), serialClaimBill.id);

    // 3. Verify Serial status transitioned to CLAIMED
    const claimedSerial = await prisma.productSerial.findUnique({
      where: { id: serialOneId },
      select: { status: true },
    });
    expect(claimedSerial?.status).toBe("CLAIMED");

    // 4. Attempting to void the original sale bill must fail with BILL_HAS_WARRANTY_CLAIM
    await expectBillError(
      voidBill(adminActor(), saleBill.id, "พยายามยกเลิกบิลที่มีเคลมค้าง"),
      "BILL_HAS_WARRANTY_CLAIM",
    );

    // 5. Void the claim bill and verify serial status reverts to SOLD
    await voidBill(adminActor(), serialClaimBill.id, "ยกเลิกบิลเคลม");
    const revertedSerial = await prisma.productSerial.findUnique({
      where: { id: serialOneId },
      select: { status: true },
    });
    expect(revertedSerial?.status).toBe("SOLD");

    // 6. Now the sale bill can be safely voided and returns serial to IN_STOCK
    await voidBill(adminActor(), saleBill.id, "ยกเลิกบิลขายหลังยกเลิกเคลมแล้ว");
    const stockSerial = await prisma.productSerial.findUnique({
      where: { id: serialOneId },
      select: { status: true },
    });
    expect(stockSerial?.status).toBe("IN_STOCK");
  });
});
