import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { BillStatus, Role } from "@/generated/prisma/enums";

import { prisma } from "@/lib/db";
import { normalizePhone, phoneSearchDigits } from "@/lib/phone";
import { writeAuditLog } from "@/server/audit";
import {
  CustomerError,
  isCustomerUniqueConstraintError,
} from "@/server/services/customer-error";
import type { CustomerListStatus } from "@/server/validators/customers";

export type CustomerActor = {
  id: string;
  role: Role;
};

type CustomerWriteInput = {
  name: string;
  phone: string;
  email?: string;
  address?: string;
  taxId?: string;
  note?: string;
};

const FINAL_BILL_STATUSES: BillStatus[] = ["APPROVED", "PAID", "VOIDED"];
const PURCHASE_STATUSES: BillStatus[] = ["APPROVED", "PAID"];

function normalizeWriteInput(input: CustomerWriteInput) {
  const optional = (value?: string) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  };

  return {
    name: input.name.trim(),
    phone: normalizePhone(input.phone),
    email: input.email?.trim().toLowerCase() || null,
    address: optional(input.address),
    taxId: input.taxId?.replace(/\D/g, "") || null,
    note: optional(input.note),
  };
}

const customerListSelect = {
  id: true,
  name: true,
  phone: true,
  email: true,
  address: true,
  isActive: true,
  deletedAt: true,
  createdAt: true,
  _count: { select: { bills: true } },
} satisfies Prisma.CustomerSelect;

const customerDetailSelect = {
  id: true,
  name: true,
  phone: true,
  email: true,
  address: true,
  taxId: true,
  note: true,
  isActive: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { bills: true } },
} satisfies Prisma.CustomerSelect;

function assertCustomerAdmin(actor: CustomerActor): void {
  if (actor.role !== "ADMIN") {
    throw new CustomerError(
      "FORBIDDEN",
      "เฉพาะผู้ดูแลระบบเท่านั้นที่แก้ไขหรือเก็บถาวรลูกค้าได้",
    );
  }
}

function activeCustomerWhere(): Prisma.CustomerWhereInput {
  return { isActive: true, deletedAt: null };
}

function listCustomerWhere(
  actor: CustomerActor,
  options: { q?: string; status?: CustomerListStatus },
): Prisma.CustomerWhereInput {
  const status =
    actor.role === "ADMIN" ? (options.status ?? "active") : "active";
  const q = options.q?.trim().slice(0, 100) ?? "";
  const searchDigits = phoneSearchDigits(q);

  return {
    ...(status === "active"
      ? activeCustomerWhere()
      : status === "archived"
        ? { deletedAt: { not: null } }
        : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { email: { contains: q, mode: "insensitive" as const } },
            { taxId: { contains: q } },
            ...(searchDigits
              ? [{ phone: { contains: searchDigits } }]
              : []),
          ],
        }
      : {}),
  };
}

export async function listCustomers(
  actor: CustomerActor,
  options: { q?: string; status?: CustomerListStatus } = {},
) {
  return prisma.customer.findMany({
    where: listCustomerWhere(actor, options),
    orderBy: [{ deletedAt: "asc" }, { createdAt: "desc" }],
    take: 200,
    select: customerListSelect,
  });
}

export const CUSTOMERS_PAGE_SIZE = 50;

export async function listCustomersPaginated(
  actor: CustomerActor,
  options: {
    q?: string;
    status?: CustomerListStatus;
    page?: number;
    pageSize?: number;
  } = {},
) {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(
    100,
    Math.max(10, options.pageSize ?? CUSTOMERS_PAGE_SIZE),
  );
  const skip = (page - 1) * pageSize;
  const where = listCustomerWhere(actor, options);

  const [items, totalCount] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: [{ deletedAt: "asc" }, { createdAt: "desc" }],
      skip,
      take: pageSize,
      select: customerListSelect,
    }),
    prisma.customer.count({ where }),
  ]);

  return { items, totalCount, page, pageSize };
}

export async function getCustomerSummary(actor: CustomerActor) {
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const [activeCount, newLast30Days] = await Promise.all([
    prisma.customer.count({ where: activeCustomerWhere() }),
    prisma.customer.count({
      where: { ...activeCustomerWhere(), createdAt: { gte: since } },
    }),
  ]);

  if (actor.role !== "ADMIN") {
    return { activeCount, newLast30Days, archivedCount: null };
  }

  const archivedCount = await prisma.customer.count({
    where: { deletedAt: { not: null } },
  });

  return { activeCount, newLast30Days, archivedCount };
}

export async function getCustomerById(
  actor: CustomerActor,
  customerId: string,
) {
  return prisma.customer.findFirst({
    where: {
      id: customerId,
      ...(actor.role === "ADMIN" ? {} : activeCustomerWhere()),
    },
    select: customerDetailSelect,
  });
}

export async function createCustomer(
  actor: CustomerActor,
  input: CustomerWriteInput,
) {
  const data = normalizeWriteInput(input);

  try {
    return await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.create({
        data: {
          ...data,
          createdById: actor.id,
        },
      });

      await writeAuditLog(
        {
          actorId: actor.id,
          action: "CUSTOMER_CREATED",
          entityType: "Customer",
          entityId: customer.id,
          after: {
            name: customer.name,
            phone: customer.phone,
            email: customer.email,
            address: customer.address,
            taxId: customer.taxId,
            note: customer.note,
            isActive: customer.isActive,
          },
        },
        tx,
      );

      return customer;
    });
  } catch (error) {
    if (isCustomerUniqueConstraintError(error)) {
      throw new CustomerError(
        "PHONE_EXISTS",
        "เบอร์โทรนี้ถูกใช้งานแล้ว กรุณาตรวจสอบหรือกู้คืนลูกค้าที่เคยเก็บถาวร",
      );
    }
    throw error;
  }
}

export async function updateCustomer(
  actor: CustomerActor,
  customerId: string,
  input: CustomerWriteInput,
) {
  assertCustomerAdmin(actor);
  const data = normalizeWriteInput(input);

  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.customer.findUnique({
        where: { id: customerId },
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          address: true,
          taxId: true,
          note: true,
          isActive: true,
        },
      });

      if (!existing) {
        throw new CustomerError("NOT_FOUND", "ไม่พบลูกค้านี้");
      }

      const updated = await tx.customer.update({
        where: { id: existing.id },
        data,
      });

      await writeAuditLog(
        {
          actorId: actor.id,
          action: "CUSTOMER_UPDATED",
          entityType: "Customer",
          entityId: existing.id,
          before: {
            name: existing.name,
            phone: existing.phone,
            email: existing.email,
            address: existing.address,
            taxId: existing.taxId,
            note: existing.note,
            isActive: existing.isActive,
          },
          after: {
            name: updated.name,
            phone: updated.phone,
            email: updated.email,
            address: updated.address,
            taxId: updated.taxId,
            note: updated.note,
            isActive: updated.isActive,
          },
        },
        tx,
      );

      return updated;
    });
  } catch (error) {
    if (isCustomerUniqueConstraintError(error)) {
      throw new CustomerError(
        "PHONE_EXISTS",
        "เบอร์โทรนี้ถูกใช้งานแล้ว กรุณาตรวจสอบหรือกู้คืนลูกค้าที่เคยเก็บถาวร",
      );
    }
    throw error;
  }
}

export async function setCustomerActive(
  actor: CustomerActor,
  customerId: string,
  active: boolean,
) {
  assertCustomerAdmin(actor);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        name: true,
        isActive: true,
        deletedAt: true,
      },
    });

    if (!existing) {
      throw new CustomerError("NOT_FOUND", "ไม่พบลูกค้านี้");
    }

    const alreadyInRequestedState = active
      ? existing.isActive && !existing.deletedAt
      : !existing.isActive && Boolean(existing.deletedAt);

    if (alreadyInRequestedState) {
      return existing;
    }

    const updated = await tx.customer.update({
      where: { id: existing.id },
      data: {
        isActive: active,
        deletedAt: active ? null : new Date(),
      },
    });

    await writeAuditLog(
      {
        actorId: actor.id,
        action: active ? "CUSTOMER_RESTORED" : "CUSTOMER_ARCHIVED",
        entityType: "Customer",
        entityId: existing.id,
        before: {
          isActive: existing.isActive,
          deletedAt: existing.deletedAt,
        },
        after: {
          isActive: updated.isActive,
          deletedAt: updated.deletedAt,
        },
      },
      tx,
    );

    return updated;
  });
}

export async function getCustomerBills(
  actor: CustomerActor,
  customerId: string,
) {
  const customer = await getCustomerById(actor, customerId);

  if (!customer) {
    throw new CustomerError("NOT_FOUND", "ไม่พบลูกค้านี้");
  }

  return prisma.bill.findMany({
    where: {
      customerId,
      status: { in: FINAL_BILL_STATUSES },
      ...(actor.role === "ADMIN" ? {} : { technicianId: actor.id }),
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      billNumber: true,
      title: true,
      status: true,
      grandTotal: true,
      createdAt: true,
      approvedAt: true,
      paidAt: true,
      voidedAt: true,
      billType: { select: { code: true, name: true } },
      technician: { select: { name: true } },
    },
  });
}

export async function getCustomerPurchaseSummary(
  actor: CustomerActor,
  customerId: string,
) {
  const customer = await getCustomerById(actor, customerId);

  if (!customer) {
    throw new CustomerError("NOT_FOUND", "ไม่พบลูกค้านี้");
  }

  const [aggregate, lastPurchase] = await Promise.all([
    prisma.bill.aggregate({
      where: {
        customerId,
        status: { in: PURCHASE_STATUSES },
        ...(actor.role === "ADMIN" ? {} : { technicianId: actor.id }),
      },
      _sum: { grandTotal: true },
      _count: { _all: true },
    }),
    prisma.bill.findFirst({
      where: {
        customerId,
        status: { in: PURCHASE_STATUSES },
        ...(actor.role === "ADMIN" ? {} : { technicianId: actor.id }),
      },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, approvedAt: true, paidAt: true },
    }),
  ]);

  return {
    billCount: aggregate._count._all,
    totalAmount: aggregate._sum.grandTotal?.toString() ?? "0.00",
    lastPurchaseAt: lastPurchase
      ? (lastPurchase.paidAt ??
        lastPurchase.approvedAt ??
        lastPurchase.createdAt)
      : null,
  };
}
