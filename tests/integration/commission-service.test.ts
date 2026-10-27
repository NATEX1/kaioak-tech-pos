import { randomInt, randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Role } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { createCategory } from "@/server/services/categories";
import {
  approveBill,
  createBill,
  submitBill,
  voidBill,
} from "@/server/services/bills";
import {
  buildCommissionCsv,
  createCommissionPayout,
  createCommissionRule,
  getCommissionPayoutById,
  getCommissionSummary,
  listCommissionEntries,
  listCommissionRules,
  setCommissionRuleActive,
  updateCommissionRule,
} from "@/server/services/commissions";
import { createCustomer } from "@/server/services/customers";
import { createProduct } from "@/server/services/products";
import { adjustStock } from "@/server/services/stock";
import { createUser } from "@/server/services/users";
import type {
  BillCreateInput,
  BillItemInput,
} from "@/server/validators/bills";
import type { CommissionRuleInput } from "@/server/validators/commissions";

const suffix = randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
const categoryCode = `CM${suffix.slice(0, 6)}`;
const billTypeCode = `CM${suffix}`;
const billPrefix = `CMT${suffix.slice(0, 6)}`;
const customerPhone = `08${randomInt(10_000_000, 99_999_999)}`;
const password = "ComposTest!2345";

const userIds = new Set<string>();
const categoryIds = new Set<string>();
const productIds = new Set<string>();
const customerIds = new Set<string>();
const billIds = new Set<string>();
const ruleIds = new Set<string>();
const payoutIds = new Set<string>();

let admin: { id: string; role: Role };
let technician: { id: string; role: Role };
let otherTechnician: { id: string; role: Role };
let billTypeId: string;
let categoryId: string;
let productId: string;
let customerId: string;
let baseRuleId: string;

function adminActor() {
  return { id: admin.id, role: "ADMIN" as const };
}

function techActor() {
  return technician;
}

function otherTechActor() {
  return otherTechnician;
}

function item(unitPrice: string): BillItemInput {
  return {
    kind: "PRODUCT",
    productId,
    description: undefined,
    quantity: 1,
    unitPrice,
    discountType: null,
    discountValue: "0",
    serialIds: [],
  };
}

function billInput(unitPrice: string, title: string): BillCreateInput {
  return {
    billTypeId,
    customerId,
    technicianId: undefined,
    title,
    description: undefined,
    note: undefined,
    discountType: null,
    discountValue: "0",
    items: [item(unitPrice)],
    repair: undefined,
    claim: undefined,
  };
}

async function createTrackedBill(unitPrice: string, title: string) {
  const bill = await createBill(techActor(), billInput(unitPrice, title));
  billIds.add(bill.id);
  return bill;
}

async function createApprovedBill(unitPrice: string, title: string) {
  const bill = await createTrackedBill(unitPrice, title);
  await submitBill(techActor(), bill.id);
  await approveBill(adminActor(), bill.id);
  return bill;
}

async function earningForBill(billId: string) {
  return prisma.commissionEntry.findFirst({
    where: { billId, kind: "EARNING" },
    orderBy: { earnedAt: "asc" },
  });
}

async function makePayout(periodStart = "2020-01-01", periodEnd = "2030-12-31") {
  const payout = await createCommissionPayout(adminActor(), {
    technicianId: technician.id,
    periodStart: new Date(`${periodStart}T00:00:00.000+07:00`),
    periodEnd: new Date(`${periodEnd}T23:59:59.999+07:00`),
    note: `Test payout ${suffix}`,
  });
  payoutIds.add(payout.id);
  return payout;
}

function ruleInput(
  overrides: Partial<CommissionRuleInput> &
    Pick<CommissionRuleInput, "name" | "ruleType" | "value">,
): CommissionRuleInput {
  return {
    description: undefined,
    technicianId: undefined,
    billTypeId,
    categoryId: undefined,
    priority: 0,
    effectiveFrom: new Date("2025-01-01T00:00:00.000Z"),
    effectiveTo: undefined,
    isActive: true,
    ...overrides,
  };
}

beforeAll(async () => {
  const seedAdmin = await prisma.user.findFirst({
    where: { role: "ADMIN", isActive: true },
    orderBy: { email: "asc" },
    select: { id: true },
  });

  if (!seedAdmin) {
    throw new Error("A seed administrator is required for commission tests");
  }

  admin = { id: seedAdmin.id, role: "ADMIN" };
  const firstTech = await createUser(adminActor(), {
    name: `Commission Tech ${suffix}`,
    email: `commission-tech-${suffix.toLowerCase()}@example.local`,
    role: "TECHNICIAN",
    password,
  });
  const secondTech = await createUser(adminActor(), {
    name: `Commission Other ${suffix}`,
    email: `commission-other-${suffix.toLowerCase()}@example.local`,
    role: "TECHNICIAN",
    password,
  });
  technician = { id: firstTech.id, role: "TECHNICIAN" };
  otherTechnician = { id: secondTech.id, role: "TECHNICIAN" };
  userIds.add(firstTech.id);
  userIds.add(secondTech.id);

  const billType = await prisma.billType.create({
    data: {
      code: billTypeCode,
      name: `Commission Test Bill ${suffix}`,
      prefix: billPrefix,
      requiresRepairDetail: false,
      requiresWarrantyCheck: false,
      isActive: true,
      sortOrder: 999,
      description: "Created by Vitest commission tests",
      createdById: admin.id,
    },
    select: { id: true },
  });
  billTypeId = billType.id;

  const category = await createCategory(adminActor(), {
    code: categoryCode,
    name: `Commission Test Category ${suffix}`,
  });
  categoryId = category.id;
  categoryIds.add(category.id);

  const product = await createProduct(adminActor(), {
    name: `Commission Test Product ${suffix}`,
    categoryId,
    costPrice: "300.00",
    salePrice: "1000.00",
    reorderLevel: 1,
    warrantyMonths: 12,
    trackSerial: false,
    primaryBarcode: `CMB${suffix}`,
    primaryBarcodeType: "CODE128",
  });
  productId = product.id;
  productIds.add(product.id);

  await adjustStock(adminActor(), {
    productId,
    direction: "IN",
    quantity: 100,
    unitCost: "300.00",
    reason: `Commission test stock ${suffix}`,
    serialNumbers: [],
  });

  const customer = await createCustomer(adminActor(), {
    name: `Commission Test Customer ${suffix}`,
    phone: customerPhone,
  });
  customerId = customer.id;
  customerIds.add(customer.id);

  const baseRule = await createCommissionRule(
    adminActor(),
    ruleInput({
      name: `Base revenue rule ${suffix}`,
      description: "Base test commission",
      ruleType: "PERCENT_REVENUE",
      value: "5.0000",
      priority: 0,
    }),
  );
  baseRuleId = baseRule.id;
  ruleIds.add(baseRule.id);
});

afterAll(async () => {
  const billIdList = [...billIds];
  const productIdList = [...productIds];
  const commissionEntryIds = (
    await prisma.commissionEntry.findMany({
      where: {
        OR: [
          { billId: { in: billIdList } },
          { technicianId: { in: [...userIds] } },
        ],
      },
      select: { id: true },
    })
  ).map((entry) => entry.id);

  await prisma.commissionPayoutItem.deleteMany({
    where: { payoutId: { in: [...payoutIds] } },
  });
  await prisma.commissionPayout.deleteMany({
    where: { id: { in: [...payoutIds] } },
  });
  await prisma.commissionEntry.deleteMany({
    where: {
      OR: [
        { billId: { in: billIdList } },
        { technicianId: { in: [...userIds] } },
      ],
    },
  });
  await prisma.commissionRule.deleteMany({
    where: { id: { in: [...ruleIds] } },
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
  await prisma.productBarcode.deleteMany({
    where: { productId: { in: productIdList } },
  });
  await prisma.product.deleteMany({
    where: { id: { in: productIdList } },
  });
  await prisma.customer.deleteMany({
    where: { id: { in: [...customerIds] } },
  });
  await prisma.category.deleteMany({
    where: { id: { in: [...categoryIds] } },
  });
  await prisma.documentSequence.deleteMany({
    where: { key: { startsWith: `${billPrefix}-` } },
  });
  await prisma.billType.deleteMany({ where: { id: billTypeId } });

  const entityIds = [
    ...billIdList,
    ...productIdList,
    ...customerIds,
    ...categoryIds,
    ...ruleIds,
    ...payoutIds,
    ...commissionEntryIds,
    ...userIds,
    billTypeId,
  ].filter(Boolean);

  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        { entityId: { in: entityIds } },
        { actorId: { in: [...userIds] } },
      ],
    },
  });
  await prisma.user.deleteMany({ where: { id: { in: [...userIds] } } });
});

describe("commission service", () => {
  it("does not create an entry when no commission rule is active", async () => {
    // A shared database may already contain store-wide rules from manual or
    // demo usage. Pause every other active rule for this case and restore it
    // afterwards so the test does not depend on an empty CommissionRule table.
    const otherActiveRules = await prisma.commissionRule.findMany({
      where: { isActive: true, id: { not: baseRuleId } },
      select: { id: true },
    });
    const otherRuleIds = otherActiveRules.map((rule) => rule.id);

    await prisma.commissionRule.updateMany({
      where: { id: { in: otherRuleIds } },
      data: { isActive: false },
    });

    try {
      await setCommissionRuleActive(adminActor(), baseRuleId, false);
      const bill = await createApprovedBill("500.00", `No rule ${suffix}`);

      expect(await earningForBill(bill.id)).toBeNull();
    } finally {
      await setCommissionRuleActive(adminActor(), baseRuleId, true);
      await prisma.commissionRule.updateMany({
        where: { id: { in: otherRuleIds } },
        data: { isActive: true },
      });
    }
  });

  it("snapshots revenue, cost and the selected rule on approval", async () => {
    const bill = await createApprovedBill("1000.00", `Base commission ${suffix}`);
    const entry = await earningForBill(bill.id);
    const billRow = await prisma.bill.findUniqueOrThrow({
      where: { id: bill.id },
      select: { netAmountBeforeVat: true },
    });

    expect(entry).not.toBeNull();
    expect(entry?.status).toBe("PENDING");
    expect(entry?.kind).toBe("EARNING");
    expect(entry?.basis).toBe("REVENUE");
    expect(entry?.ruleId).toBe(baseRuleId);
    expect(entry?.baseAmount.toFixed(2)).toBe(
      billRow.netAmountBeforeVat.toFixed(2),
    );
    expect(entry?.costAmount.toFixed(2)).toBe("300.00");
    expect(entry?.commissionAmount.toFixed(2)).toBe(
      billRow.netAmountBeforeVat.mul(5).div(100).toFixed(2),
    );

    const snapshot = entry?.ruleSnapshot as
      | {
          ruleId?: string;
          calculation?: { commissionAmount?: string };
          bill?: { costAmount?: string };
        }
      | null;
    expect(snapshot?.ruleId).toBe(baseRuleId);
    expect(snapshot?.calculation?.commissionAmount).toBe(
      entry?.commissionAmount.toFixed(2),
    );
    expect(snapshot?.bill?.costAmount).toBe("300.00");

    const audit = await prisma.auditLog.findFirst({
      where: {
        action: "COMMISSION_EARNED",
        entityId: entry?.id,
      },
    });
    expect(audit?.actorId).toBe(admin.id);
  });

  it("keeps old snapshots after a rule is edited and applies the new rate to new approvals", async () => {
    const oldBill = await createApprovedBill("1000.00", `Old snapshot ${suffix}`);
    const oldEntry = await earningForBill(oldBill.id);

    await updateCommissionRule(adminActor(), {
      ...ruleInput({
        name: `Base revenue rule ${suffix}`,
        ruleType: "PERCENT_REVENUE",
        value: "7.0000",
      }),
      ruleId: baseRuleId,
    });

    const newBill = await createApprovedBill("2000.00", `New rate ${suffix}`);
    const newEntry = await earningForBill(newBill.id);
    const oldEntryAfter = await prisma.commissionEntry.findUniqueOrThrow({
      where: { id: oldEntry!.id },
      select: { commissionAmount: true, ruleSnapshot: true },
    });
    const newBillRow = await prisma.bill.findUniqueOrThrow({
      where: { id: newBill.id },
      select: { netAmountBeforeVat: true },
    });

    expect(oldEntryAfter.commissionAmount.toFixed(2)).toBe(
      oldEntry!.commissionAmount.toFixed(2),
    );
    expect(newEntry?.commissionAmount.toFixed(2)).toBe(
      newBillRow.netAmountBeforeVat.mul(7).div(100).toFixed(2),
    );
  });

  it("creates one payout, marks entries paid and rejects a second empty payout", async () => {
    const summaryBefore = await getCommissionSummary(techActor());
    const pending = Number(summaryBefore.pendingNet);
    expect(pending).toBeGreaterThan(0);

    const payout = await makePayout();

    expect(payout.totalAmount).toBe(summaryBefore.pendingNet);
    expect(payout.entryCount).toBe(summaryBefore.pendingCount);

    const detail = await getCommissionPayoutById(adminActor(), payout.id);
    expect(detail?.status).toBe("PAID");
    expect(detail?.paidBy?.id).toBe(admin.id);
    expect(detail?.items).toHaveLength(summaryBefore.pendingCount);
    expect(detail?.items.every((item) => !item.amount.isNegative())).toBe(true);

    const entries = await prisma.commissionEntry.findMany({
      where: { technicianId: technician.id },
      select: { status: true },
    });
    expect(entries.every((entry) => entry.status === "PAID")).toBe(true);

    const after = await getCommissionSummary(techActor());
    expect(after.pendingNet).toBe("0.00");

    await expect(makePayout()).rejects.toMatchObject({
      name: "CommissionError",
      code: "NO_PENDING_ENTRIES",
    });
  });

  it("enforces commission authorization and technician scoping", async () => {
    await expect(listCommissionRules(techActor())).rejects.toMatchObject({
      name: "CommissionError",
      code: "FORBIDDEN",
    });
    await expect(
      createCommissionRule(
        techActor(),
        ruleInput({
          name: "Forbidden rule",
          ruleType: "PERCENT_REVENUE",
          value: "1.0000",
        }),
      ),
    ).rejects.toMatchObject({ name: "CommissionError", code: "FORBIDDEN" });
    await expect(
      createCommissionPayout(techActor(), {
        technicianId: technician.id,
        periodStart: new Date("2020-01-01T00:00:00.000Z"),
        periodEnd: new Date("2030-12-31T23:59:59.999Z"),
        note: undefined,
      }),
    ).rejects.toMatchObject({ name: "CommissionError", code: "FORBIDDEN" });

    expect(await listCommissionEntries(otherTechActor())).toHaveLength(0);
    expect((await getCommissionSummary(otherTechActor())).pendingNet).toBe(
      "0.00",
    );

    const payout = [...payoutIds][0];
    expect(payout).toBeTruthy();
    expect(await getCommissionPayoutById(otherTechActor(), payout)).toBeNull();
  });

  it("selects the most specific rule before priority", async () => {
    const specific = await createCommissionRule(
      adminActor(),
      ruleInput({
        name: `Technician rule ${suffix}`,
        ruleType: "PERCENT_REVENUE",
        value: "2.0000",
        technicianId: technician.id,
        priority: 50,
      }),
    );
    ruleIds.add(specific.id);

    const bill = await createApprovedBill("1000.00", `Specific rule ${suffix}`);
    const entry = await earningForBill(bill.id);
    const billRow = await prisma.bill.findUniqueOrThrow({
      where: { id: bill.id },
      select: { netAmountBeforeVat: true },
    });

    expect(entry?.ruleId).toBe(specific.id);
    expect(entry?.commissionAmount.toFixed(2)).toBe(
      billRow.netAmountBeforeVat.mul(2).div(100).toFixed(2),
    );

    await makePayout();
  });

  it("reverses a paid commission with a negative entry and offsets the next payout", async () => {
    const first = await createApprovedBill("1000.00", `Paid before void ${suffix}`);
    const firstEntry = await earningForBill(first.id);
    const firstPayout = await makePayout();

    const paidDetail = await getCommissionPayoutById(
      adminActor(),
      firstPayout.id,
    );
    expect(paidDetail?.items.some((item) => item.commissionEntry.id === firstEntry?.id)).toBe(
      true,
    );

    await voidBill(adminActor(), first.id, `Test commission reversal ${suffix}`);

    const reversed = await prisma.commissionEntry.findUniqueOrThrow({
      where: { id: firstEntry!.id },
      select: { status: true, reversedAt: true },
    });
    const reversal = await prisma.commissionEntry.findFirstOrThrow({
      where: { reversalOfId: firstEntry!.id },
      select: {
        id: true,
        kind: true,
        status: true,
        commissionAmount: true,
        ruleId: true,
        payoutItem: { select: { id: true } },
      },
    });

    expect(reversed.status).toBe("REVERSED");
    expect(reversed.reversedAt).not.toBeNull();
    expect(reversal.kind).toBe("REVERSAL");
    expect(reversal.status).toBe("PENDING");
    expect(reversal.ruleId).toBe(firstEntry?.ruleId);
    expect(reversal.commissionAmount.isNegative()).toBe(true);
    expect(reversal.payoutItem).toBeNull();

    const originalPayout = await getCommissionPayoutById(
      adminActor(),
      firstPayout.id,
    );
    expect(originalPayout?.totalAmount.toFixed(2)).toBe(
      firstPayout.totalAmount,
    );
    expect(originalPayout?.items).toHaveLength(1);

    await expect(makePayout()).rejects.toMatchObject({
      name: "CommissionError",
      code: "PAYOUT_NEGATIVE",
    });

    const next = await createApprovedBill("5000.00", `Offset next payout ${suffix}`);
    const nextEntry = await earningForBill(next.id);
    const nextPayout = await makePayout();
    const nextDetail = await getCommissionPayoutById(
      adminActor(),
      nextPayout.id,
    );
    const expected = nextEntry!.commissionAmount
      .plus(reversal.commissionAmount)
      .toFixed(2);

    expect(nextPayout.totalAmount).toBe(expected);
    expect(nextDetail?.items).toHaveLength(2);
    expect(
      nextDetail?.items.some((item) => item.amount.isNegative()),
    ).toBe(true);
    expect(
      await prisma.commissionEntry.findFirst({
        where: { id: reversal.id },
        select: { status: true },
      }),
    ).toMatchObject({ status: "PAID" });
  });

  it("exports scoped commission CSV for admins and rejects technicians", async () => {
    const bill = await createApprovedBill("1000.00", `CSV export ${suffix}`);
    const { csv, rowCount } = await buildCommissionCsv(adminActor(), {
      billId: bill.id,
    });

    expect(rowCount).toBe(1);
    expect(csv).toContain("เลขที่บิล");
    expect(csv).toContain(bill.billNumber);
    expect(csv).toContain('"2.0000"');
    expect(csv).toContain('"20.00"');

    await expect(
      buildCommissionCsv(techActor(), { billId: bill.id }),
    ).rejects.toMatchObject({ name: "CommissionError", code: "FORBIDDEN" });
  });
});
