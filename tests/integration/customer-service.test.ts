import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Role } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import {
  createCustomer,
  getCustomerBills,
  getCustomerById,
  getCustomerPurchaseSummary,
  getCustomerSummary,
  listCustomers,
  setCustomerActive,
  updateCustomer,
} from "@/server/services/customers";
import { formatThaiPhone } from "@/lib/phone";

const suffix = randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
const dateDigits = Date.now().toString().slice(-8);
const primaryPhone = `09${dateDigits}`;
const updatedPhone = `08${dateDigits}`;
const customerIds = new Set<string>();
const billIds = new Set<string>();
let billTypeId: string;

let admin: { id: string; role: Role };
let technician: { id: string; role: Role };
let customerId: string;

function apiActor(): { id: string; role: Role } {
  return { id: admin.id, role: "ADMIN" };
}

function techActor(): { id: string; role: Role } {
  return technician;
}

async function expectCustomerError(
  promise: Promise<unknown>,
  code: string,
): Promise<void> {
  await expect(promise).rejects.toMatchObject({ name: "CustomerError", code });
}

beforeAll(async () => {
  const [seedAdmin, seedTechnician, billType] = await Promise.all([
    prisma.user.findFirst({
      where: { role: "ADMIN", isActive: true },
      select: { id: true },
    }),
    prisma.user.findFirst({
      where: { role: "TECHNICIAN", isActive: true },
      select: { id: true },
    }),
    prisma.billType.findFirst({
      where: { isActive: true },
      select: { id: true },
    }),
  ]);

  if (!seedAdmin || !seedTechnician || !billType) {
    throw new Error("Seed data is required for customer tests");
  }

  admin = { id: seedAdmin.id, role: "ADMIN" };
  technician = { id: seedTechnician.id, role: "TECHNICIAN" };
  billTypeId = billType.id;
});

afterAll(async () => {
  await prisma.bill.deleteMany({ where: { id: { in: [...billIds] } } });
  await prisma.customer.deleteMany({
    where: { id: { in: [...customerIds] } },
  });
  await prisma.auditLog.deleteMany({
    where: { entityType: "Customer", entityId: { in: [...customerIds] } },
  });
});

describe("customer service", () => {
  it("allows technicians to create customers and stores a normalized phone", async () => {
    const customer = await createCustomer(techActor(), {
      name: `Test Customer ${suffix}`,
      phone: formatThaiPhone(primaryPhone),
      email: "CUSTOMER@Example.Local",
      address: "99/1 Test Road",
      taxId: "0105559999999",
      note: "Created by Vitest",
    });
    customerId = customer.id;
    customerIds.add(customer.id);

    expect(customer.phone).toBe(primaryPhone);
    expect(customer.email).toBe("customer@example.local");
    expect(customer.createdById).toBe(technician.id);

    const audit = await prisma.auditLog.findFirst({
      where: {
        action: "CUSTOMER_CREATED",
        entityType: "Customer",
        entityId: customer.id,
      },
    });
    expect(audit?.actorId).toBe(technician.id);
  });

  it("rejects duplicate phones even when the input uses another format", async () => {
    await expectCustomerError(
      createCustomer(techActor(), {
        name: "Duplicate Phone",
        phone: `+66 ${primaryPhone.slice(1, 3)} ${primaryPhone.slice(3, 6)} ${primaryPhone.slice(6)}`,
      }),
      "PHONE_EXISTS",
    );
  });

  it("supports customer search and technician read access", async () => {
    const byName = await listCustomers(techActor(), {
      q: `Test Customer ${suffix}`,
    });
    expect(byName.some((customer) => customer.id === customerId)).toBe(true);

    const byPhone = await listCustomers(apiActor(), {
      q: formatThaiPhone(primaryPhone),
    });
    expect(byPhone.some((customer) => customer.id === customerId)).toBe(true);

    const detail = await getCustomerById(techActor(), customerId);
    expect(detail?.name).toBe(`Test Customer ${suffix}`);
    expect(detail?.email).toBe("customer@example.local");
  });

  it("prevents technicians from editing or archiving customers", async () => {
    await expectCustomerError(
      updateCustomer(techActor(), customerId, {
        name: "Forbidden Update",
        phone: primaryPhone,
      }),
      "FORBIDDEN",
    );
    await expectCustomerError(
      setCustomerActive(techActor(), customerId, false),
      "FORBIDDEN",
    );
  });

  it("lets admins update customer details and writes an audit trail", async () => {
    const updated = await updateCustomer(apiActor(), customerId, {
      name: `Updated Customer ${suffix}`,
      phone: formatThaiPhone(updatedPhone),
      email: "updated@example.local",
      address: "100/2 Updated Road",
      taxId: "0105559999999",
      note: "Updated",
    });

    expect(updated.phone).toBe(updatedPhone);
    expect(updated.name).toBe(`Updated Customer ${suffix}`);

    const audit = await prisma.auditLog.findFirst({
      where: {
        action: "CUSTOMER_UPDATED",
        entityType: "Customer",
        entityId: customerId,
      },
      orderBy: { createdAt: "desc" },
    });
    expect(audit?.actorId).toBe(admin.id);
    expect(audit?.before).toMatchObject({ phone: primaryPhone });
    expect(audit?.after).toMatchObject({ phone: updatedPhone });
  });

  it("archives and restores customers without hiding them from admins", async () => {
    const before = await getCustomerSummary(apiActor());

    await setCustomerActive(apiActor(), customerId, false);

    const after = await getCustomerSummary(apiActor());
    expect(after.archivedCount).toBe((before.archivedCount ?? 0) + 1);

    expect(await getCustomerById(techActor(), customerId)).toBeNull();
    expect(await getCustomerById(apiActor(), customerId)).not.toBeNull();

    const technicianActive = await listCustomers(techActor(), {
      status: "archived",
    });
    expect(technicianActive.some((customer) => customer.id === customerId)).toBe(
      false,
    );

    const adminArchived = await listCustomers(apiActor(), {
      status: "archived",
    });
    expect(adminArchived.some((customer) => customer.id === customerId)).toBe(
      true,
    );

    await expectCustomerError(
      createCustomer(techActor(), {
        name: "Duplicate Archived Phone",
        phone: updatedPhone,
      }),
      "PHONE_EXISTS",
    );

    await setCustomerActive(apiActor(), customerId, true);
    const restored = await getCustomerById(techActor(), customerId);
    expect(restored?.id).toBe(customerId);

    const audits = await prisma.auditLog.findMany({
      where: {
        entityType: "Customer",
        entityId: customerId,
        action: { in: ["CUSTOMER_ARCHIVED", "CUSTOMER_RESTORED"] },
      },
      orderBy: { createdAt: "asc" },
    });
    expect(audits.map((audit) => audit.action)).toEqual([
      "CUSTOMER_ARCHIVED",
      "CUSTOMER_RESTORED",
    ]);
  });

  it("returns finalized bill history and purchase totals but excludes voided bills", async () => {
    const now = new Date();
    const paidBill = await prisma.bill.create({
      data: {
        billNumber: `TEST-CUST-${suffix}-P`,
        billTypeId,
        customerId,
        technicianId: admin.id,
        status: "PAID",
        title: "Phase 4 history fixture",
        subtotal: "1000.00",
        grandTotal: "1070.00",
        paymentMethod: "CASH",
        approvedAt: now,
        approvedById: admin.id,
        paidAt: now,
        paidById: admin.id,
      },
      select: { id: true },
    });
    billIds.add(paidBill.id);

    const voidedBill = await prisma.bill.create({
      data: {
        billNumber: `TEST-CUST-${suffix}-V`,
        billTypeId,
        customerId,
        technicianId: admin.id,
        status: "VOIDED",
        title: "Voided history fixture",
        subtotal: "500.00",
        grandTotal: "535.00",
        approvedAt: now,
        approvedById: admin.id,
        voidedAt: now,
        voidedById: admin.id,
        voidReason: "Vitest cleanup",
      },
      select: { id: true },
    });
    billIds.add(voidedBill.id);

    const bills = await getCustomerBills(apiActor(), customerId);
    expect(bills.map((bill) => bill.status).sort()).toEqual([
      "PAID",
      "VOIDED",
    ]);

    const summary = await getCustomerPurchaseSummary(apiActor(), customerId);
    expect(summary.billCount).toBe(1);
    expect(summary.totalAmount).toBe("1070");
    expect(summary.lastPurchaseAt).not.toBeNull();
  });
});
