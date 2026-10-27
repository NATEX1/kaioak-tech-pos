import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type {
  CommissionEntryKind,
  CommissionEntryStatus,
  Role,
} from "@/generated/prisma/enums";

import {
  calculateCommission,
  commissionRuleSpecificity,
  selectCommissionRule,
} from "@/lib/commission-calculations";
import {
  firstDayOfCurrentMonthInputValue,
  currentBuddhistYear,
  parseBangkokCommissionDate,
} from "@/lib/commission-labels";
import { prisma } from "@/lib/db";
import { Decimal, toMoneyString } from "@/lib/money";
import { toCsv } from "@/lib/csv";
import { writeAuditLog } from "@/server/audit";
import {
  CommissionError,
} from "@/server/services/commission-error";
import {
  lockInventoryKey,
  nextDocumentSequence,
} from "@/server/services/document-sequences";
import type {
  CommissionPayoutInput,
  CommissionRuleInput,
  CommissionRuleUpdateInput,
} from "@/server/validators/commissions";

export type CommissionActor = {
  id: string;
  role: Role;
};

export type CommissionEntryFilters = {
  technicianId?: string;
  status?: CommissionEntryStatus;
  kind?: CommissionEntryKind;
  billId?: string;
  from?: Date;
  to?: Date;
};

const ruleListSelect = {
  id: true,
  name: true,
  description: true,
  ruleType: true,
  value: true,
  technicianId: true,
  billTypeId: true,
  categoryId: true,
  priority: true,
  effectiveFrom: true,
  effectiveTo: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  technician: { select: { id: true, name: true, isActive: true } },
  billType: { select: { id: true, name: true, code: true, isActive: true } },
  category: { select: { id: true, name: true, code: true, isActive: true } },
  _count: { select: { entries: true } },
} satisfies Prisma.CommissionRuleSelect;

const entrySelect = {
  id: true,
  billId: true,
  billItemId: true,
  technicianId: true,
  ruleId: true,
  kind: true,
  basis: true,
  ruleName: true,
  ruleType: true,
  rateSnapshot: true,
  baseAmount: true,
  costAmount: true,
  commissionAmount: true,
  status: true,
  earnedAt: true,
  reversedAt: true,
  createdAt: true,
  bill: {
    select: {
      id: true,
      billNumber: true,
      title: true,
      status: true,
      createdAt: true,
      billType: { select: { code: true, name: true } },
    },
  },
  technician: { select: { id: true, name: true } },
  payoutItem: {
    select: {
      id: true,
      payoutId: true,
      payout: {
        select: {
          payoutNo: true,
          status: true,
          paidAt: true,
        },
      },
    },
  },
} satisfies Prisma.CommissionEntrySelect;

const payoutListSelect = {
  id: true,
  payoutNo: true,
  technicianId: true,
  periodStart: true,
  periodEnd: true,
  totalAmount: true,
  status: true,
  note: true,
  paidAt: true,
  createdAt: true,
  technician: { select: { id: true, name: true } },
  paidBy: { select: { id: true, name: true } },
  _count: { select: { items: true } },
} satisfies Prisma.CommissionPayoutSelect;

function assertAdmin(actor: CommissionActor): void {
  if (actor.role !== "ADMIN") {
    throw new CommissionError(
      "FORBIDDEN",
      "เฉพาะผู้ดูแลระบบเท่านั้นที่จัดการกติกาและรอบจ่ายค่าคอมมิชชั่นได้",
    );
  }
}

function optional(value?: string): string | null {
  return value?.trim() ? value.trim() : null;
}

function ruleAuditData(rule: {
  name: string;
  ruleType: string;
  value: Decimal;
  technicianId: string | null;
  billTypeId: string | null;
  categoryId: string | null;
  priority: number;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  isActive: boolean;
}) {
  return {
    name: rule.name,
    ruleType: rule.ruleType,
    value: rule.value.toFixed(4),
    technicianId: rule.technicianId,
    billTypeId: rule.billTypeId,
    categoryId: rule.categoryId,
    priority: rule.priority,
    effectiveFrom: rule.effectiveFrom.toISOString(),
    effectiveTo: rule.effectiveTo?.toISOString() ?? null,
    isActive: rule.isActive,
  };
}

async function validateRuleScopes(
  tx: Prisma.TransactionClient,
  input: CommissionRuleInput,
): Promise<void> {
  const checks: Promise<unknown>[] = [];

  if (input.technicianId) {
    checks.push(
      tx.user
        .findFirst({
          where: { id: input.technicianId, role: "TECHNICIAN" },
          select: { id: true },
        })
        .then((user) => {
          if (!user) {
            throw new CommissionError(
              "INVALID_SCOPE",
              "ไม่พบช่างเทคนิคที่เลือกสำหรับกติกานี้",
            );
          }
        }),
    );
  }

  if (input.billTypeId) {
    checks.push(
      tx.billType
        .findUnique({
          where: { id: input.billTypeId },
          select: { id: true },
        })
        .then((billType) => {
          if (!billType) {
            throw new CommissionError(
              "INVALID_SCOPE",
              "ไม่พบประเภทบิลที่เลือกสำหรับกติกานี้",
            );
          }
        }),
    );
  }

  if (input.categoryId) {
    checks.push(
      tx.category
        .findUnique({
          where: { id: input.categoryId },
          select: { id: true },
        })
        .then((category) => {
          if (!category) {
            throw new CommissionError(
              "INVALID_SCOPE",
              "ไม่พบหมวดหมู่ที่เลือกสำหรับกติกานี้",
            );
          }
        }),
    );
  }

  await Promise.all(checks);
}

export async function listCommissionRules(actor: CommissionActor) {
  assertAdmin(actor);

  return prisma.commissionRule.findMany({
    orderBy: [
      { isActive: "desc" },
      { priority: "desc" },
      { effectiveFrom: "desc" },
      { name: "asc" },
    ],
    select: ruleListSelect,
  });
}

export async function getCommissionRuleById(
  actor: CommissionActor,
  ruleId: string,
) {
  assertAdmin(actor);

  return prisma.commissionRule.findUnique({
    where: { id: ruleId },
    select: ruleListSelect,
  });
}

export async function listCommissionRuleOptions(actor: CommissionActor) {
  assertAdmin(actor);

  const [technicians, billTypes, categories] = await Promise.all([
    prisma.user.findMany({
      where: { role: "TECHNICIAN" },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      select: { id: true, name: true, isActive: true },
    }),
    prisma.billType.findMany({
      orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, code: true, isActive: true },
    }),
    prisma.category.findMany({
      orderBy: [{ deletedAt: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        code: true,
        isActive: true,
        deletedAt: true,
      },
    }),
  ]);

  return { technicians, billTypes, categories };
}

export async function listCommissionTechnicians(actor: CommissionActor) {
  assertAdmin(actor);

  return prisma.user.findMany({
    where: { role: "TECHNICIAN" },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: { id: true, name: true, isActive: true },
  });
}

export async function createCommissionRule(
  actor: CommissionActor,
  input: CommissionRuleInput,
) {
  assertAdmin(actor);

  return prisma.$transaction(async (tx) => {
    await validateRuleScopes(tx, input);

    const rule = await tx.commissionRule.create({
      data: {
        name: input.name.trim(),
        description: optional(input.description),
        ruleType: input.ruleType,
        value: new Decimal(input.value),
        technicianId: input.technicianId ?? null,
        billTypeId: input.billTypeId ?? null,
        categoryId: input.categoryId ?? null,
        priority: input.priority,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.effectiveTo ?? null,
        isActive: input.isActive,
        createdById: actor.id,
      },
      select: ruleListSelect,
    });

    await writeAuditLog(
      {
        actorId: actor.id,
        action: "COMMISSION_RULE_CREATED",
        entityType: "CommissionRule",
        entityId: rule.id,
        after: ruleAuditData(rule),
      },
      tx,
    );

    return rule;
  });
}

export async function updateCommissionRule(
  actor: CommissionActor,
  input: CommissionRuleUpdateInput,
) {
  assertAdmin(actor);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.commissionRule.findUnique({
      where: { id: input.ruleId },
      select: {
        id: true,
        name: true,
        ruleType: true,
        value: true,
        technicianId: true,
        billTypeId: true,
        categoryId: true,
        priority: true,
        effectiveFrom: true,
        effectiveTo: true,
        isActive: true,
      },
    });

    if (!existing) {
      throw new CommissionError("NOT_FOUND", "ไม่พบกติกาคอมมิชชั่นนี้");
    }

    await validateRuleScopes(tx, input);

    const rule = await tx.commissionRule.update({
      where: { id: input.ruleId },
      data: {
        name: input.name.trim(),
        description: optional(input.description),
        ruleType: input.ruleType,
        value: new Decimal(input.value),
        technicianId: input.technicianId ?? null,
        billTypeId: input.billTypeId ?? null,
        categoryId: input.categoryId ?? null,
        priority: input.priority,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.effectiveTo ?? null,
        isActive: input.isActive,
      },
      select: ruleListSelect,
    });

    await writeAuditLog(
      {
        actorId: actor.id,
        action: "COMMISSION_RULE_UPDATED",
        entityType: "CommissionRule",
        entityId: rule.id,
        before: ruleAuditData(existing),
        after: ruleAuditData(rule),
      },
      tx,
    );

    return rule;
  });
}

export async function setCommissionRuleActive(
  actor: CommissionActor,
  ruleId: string,
  active: boolean,
) {
  assertAdmin(actor);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.commissionRule.findUnique({
      where: { id: ruleId },
      select: { id: true, name: true, isActive: true },
    });

    if (!existing) {
      throw new CommissionError("NOT_FOUND", "ไม่พบกติกาคอมมิชชั่นนี้");
    }

    if (existing.isActive === active) {
      return existing;
    }

    const rule = await tx.commissionRule.update({
      where: { id: existing.id },
      data: { isActive: active },
      select: { id: true, name: true, isActive: true },
    });

    await writeAuditLog(
      {
        actorId: actor.id,
        action: active
          ? "COMMISSION_RULE_ACTIVATED"
          : "COMMISSION_RULE_DEACTIVATED",
        entityType: "CommissionRule",
        entityId: rule.id,
        before: { isActive: existing.isActive },
        after: { isActive: rule.isActive },
        metadata: { name: rule.name },
      },
      tx,
    );

    return rule;
  });
}

type ApprovedBillForCommission = {
  id: string;
  billNumber: string;
  technicianId: string;
  billTypeId: string;
  netAmountBeforeVat: Decimal;
  vatEnabled: boolean;
  vatAmount: Decimal;
  grandTotal: Decimal;
  discountAmount: Decimal;
  billType: { code: string; name: string };
  items: Array<{
    id: string;
    quantity: number;
    unitCost: Decimal;
    lineTotal: Decimal;
    description: string;
    product: { categoryId: string } | null;
  }>;
};

async function readBillForCommission(
  tx: Prisma.TransactionClient,
  billId: string,
): Promise<ApprovedBillForCommission | null> {
  return tx.bill.findUnique({
    where: { id: billId },
    select: {
      id: true,
      billNumber: true,
      technicianId: true,
      billTypeId: true,
      netAmountBeforeVat: true,
      vatEnabled: true,
      vatAmount: true,
      grandTotal: true,
      discountAmount: true,
      billType: { select: { code: true, name: true } },
      items: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          quantity: true,
          unitCost: true,
          lineTotal: true,
          description: true,
          product: { select: { categoryId: true } },
        },
      },
    },
  });
}

/**
 * Calculates and snapshots the commission for a bill that is being approved.
 * Runs inside the approval transaction. Existing entries make the operation
 * idempotent.
 */
export async function createCommissionEntryForApprovedBill(
  tx: Prisma.TransactionClient,
  input: {
    billId: string;
    actorId: string;
    approvedAt: Date;
  },
) {
  const existing = await tx.commissionEntry.findFirst({
    where: { billId: input.billId, kind: "EARNING" },
    select: { id: true },
  });

  if (existing) {
    return null;
  }

  const bill = await readBillForCommission(tx, input.billId);

  if (!bill) {
    return null;
  }

  const categoryIds = [
    ...new Set(
      bill.items
        .map((item) => item.product?.categoryId)
        .filter((value): value is string => Boolean(value)),
    ),
  ];

  const candidates = await tx.commissionRule.findMany({
    where: {
      isActive: true,
      effectiveFrom: { lte: input.approvedAt },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: input.approvedAt } }],
    },
    select: {
      id: true,
      name: true,
      description: true,
      ruleType: true,
      value: true,
      technicianId: true,
      billTypeId: true,
      categoryId: true,
      priority: true,
      effectiveFrom: true,
      effectiveTo: true,
      createdAt: true,
    },
  });

  const selected = selectCommissionRule(candidates, {
    technicianId: bill.technicianId,
    billTypeId: bill.billTypeId,
    categoryIds,
    evaluatedAt: input.approvedAt,
  });

  if (!selected) {
    return null;
  }

  const costAmount = bill.items.reduce(
    (total, item) => total.plus(item.unitCost.mul(item.quantity)),
    new Decimal(0),
  );
  const calculation = calculateCommission({
    ruleType: selected.ruleType,
    value: selected.value,
    netRevenue: bill.netAmountBeforeVat,
    costAmount,
  });

  const specificity = commissionRuleSpecificity(selected);
  const snapshot = {
    ruleId: selected.id,
    name: selected.name,
    description: selected.description,
    ruleType: selected.ruleType,
    value: selected.value.toFixed(4),
    priority: selected.priority,
    technicianId: selected.technicianId,
    billTypeId: selected.billTypeId,
    categoryId: selected.categoryId,
    effectiveFrom: selected.effectiveFrom.toISOString(),
    effectiveTo: selected.effectiveTo?.toISOString() ?? null,
    specificity,
    approvedAt: input.approvedAt.toISOString(),
    bill: {
      billNumber: bill.billNumber,
      billTypeCode: bill.billType.code,
      billTypeName: bill.billType.name,
      technicianId: bill.technicianId,
      netAmountBeforeVat: toMoneyString(bill.netAmountBeforeVat),
      vatEnabled: bill.vatEnabled,
      vatAmount: toMoneyString(bill.vatAmount),
      grandTotal: toMoneyString(bill.grandTotal),
      discountAmount: toMoneyString(bill.discountAmount),
      costAmount: toMoneyString(costAmount),
      categoryIds,
      items: bill.items.map((item) => ({
        id: item.id,
        description: item.description,
        quantity: item.quantity,
        unitCost: toMoneyString(item.unitCost),
        lineTotal: toMoneyString(item.lineTotal),
        categoryId: item.product?.categoryId ?? null,
      })),
    },
    calculation: {
      basis: calculation.basis,
      rate: calculation.rateSnapshot.toFixed(4),
      baseAmount: toMoneyString(calculation.baseAmount),
      costAmount: toMoneyString(calculation.costAmount),
      commissionAmount: toMoneyString(calculation.commissionAmount),
    },
  } satisfies Prisma.InputJsonObject;

  const entry = await tx.commissionEntry.create({
    data: {
      billId: bill.id,
      technicianId: bill.technicianId,
      ruleId: selected.id,
      kind: "EARNING",
      basis: calculation.basis,
      ruleName: selected.name,
      ruleType: selected.ruleType,
      ruleSnapshot: snapshot,
      rateSnapshot: calculation.rateSnapshot,
      baseAmount: calculation.baseAmount,
      costAmount: calculation.costAmount,
      commissionAmount: calculation.commissionAmount,
      status: "PENDING",
      earnedAt: input.approvedAt,
      createdById: input.actorId,
    },
    select: { id: true, commissionAmount: true },
  });

  await writeAuditLog(
    {
      actorId: input.actorId,
      action: "COMMISSION_EARNED",
      entityType: "CommissionEntry",
      entityId: entry.id,
      after: {
        billId: bill.id,
        billNumber: bill.billNumber,
        technicianId: bill.technicianId,
        ruleId: selected.id,
        ruleName: selected.name,
        basis: calculation.basis,
        commissionAmount: toMoneyString(entry.commissionAmount),
      },
    },
    tx,
  );

  return entry;
}

/**
 * Marks every earning for a voided bill as reversed and appends a negative
 * reversal entry. A paid earning stays linked to its historical payout; the
 * negative entry is settled in a later payout.
 */
export async function reverseCommissionForBill(
  tx: Prisma.TransactionClient,
  input: {
    billId: string;
    actorId: string;
    reason: string;
    voidedAt: Date;
  },
): Promise<number> {
  const bill = await tx.bill.findUnique({
    where: { id: input.billId },
    select: { id: true, billNumber: true, technicianId: true },
  });

  if (!bill) {
    return 0;
  }

  await lockInventoryKey(tx, `commission:${bill.technicianId}`);

  const entries = await tx.commissionEntry.findMany({
    where: {
      billId: bill.id,
      kind: "EARNING",
      status: { not: "REVERSED" },
      reversedBy: null,
    },
    select: {
      id: true,
      billItemId: true,
      technicianId: true,
      ruleId: true,
      basis: true,
      ruleName: true,
      ruleType: true,
      ruleSnapshot: true,
      rateSnapshot: true,
      baseAmount: true,
      costAmount: true,
      commissionAmount: true,
      status: true,
      payoutItem: { select: { id: true, payoutId: true } },
    },
  });

  if (entries.length === 0) {
    return 0;
  }

  const auditEntries: Array<{
    originalEntryId: string;
    reversalEntryId: string;
    amount: string;
    originalStatus: string;
    payoutId: string | null;
  }> = [];

  for (const entry of entries) {
    await tx.commissionEntry.update({
      where: { id: entry.id },
      data: { status: "REVERSED", reversedAt: input.voidedAt },
    });

    const reversal = await tx.commissionEntry.create({
      data: {
        billId: bill.id,
        billItemId: entry.billItemId,
        technicianId: entry.technicianId,
        ruleId: entry.ruleId,
        kind: "REVERSAL",
        basis: entry.basis,
        ruleName: entry.ruleName,
        ruleType: entry.ruleType,
        ruleSnapshot: {
          original: entry.ruleSnapshot as Prisma.InputJsonValue,
          reversal: {
            voidReason: input.reason,
            voidedAt: input.voidedAt.toISOString(),
            originalEntryId: entry.id,
            originalStatus: entry.status,
            originalPayoutId: entry.payoutItem?.payoutId ?? null,
            originalPayoutItemId: entry.payoutItem?.id ?? null,
          },
        },
        rateSnapshot: entry.rateSnapshot,
        baseAmount: entry.baseAmount,
        costAmount: entry.costAmount,
        commissionAmount: entry.commissionAmount.negated(),
        status: "PENDING",
        earnedAt: input.voidedAt,
        reversalOfId: entry.id,
        createdById: input.actorId,
      },
      select: { id: true, commissionAmount: true },
    });

    auditEntries.push({
      originalEntryId: entry.id,
      reversalEntryId: reversal.id,
      amount: toMoneyString(reversal.commissionAmount),
      originalStatus: entry.status,
      payoutId: entry.payoutItem?.payoutId ?? null,
    });
  }

  await writeAuditLog(
    {
      actorId: input.actorId,
      action: "COMMISSION_REVERSED",
      entityType: "Bill",
      entityId: bill.id,
      after: { status: "COMMISSION_REVERSED" },
      metadata: {
        billNumber: bill.billNumber,
        reason: input.reason,
        entries: auditEntries,
      },
    },
    tx,
  );

  return entries.length;
}

function commissionWhereForActor(
  actor: CommissionActor,
  filters: CommissionEntryFilters = {},
): Prisma.CommissionEntryWhereInput {
  const technicianId =
    actor.role === "ADMIN" ? filters.technicianId : actor.id;
  const earnedAt =
    filters.from || filters.to
      ? {
          ...(filters.from ? { gte: filters.from } : {}),
          ...(filters.to ? { lte: filters.to } : {}),
        }
      : undefined;

  return {
    ...(technicianId ? { technicianId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.kind ? { kind: filters.kind } : {}),
    ...(filters.billId ? { billId: filters.billId } : {}),
    ...(earnedAt ? { earnedAt } : {}),
  };
}

async function findCommissionEntries(
  actor: CommissionActor,
  filters: CommissionEntryFilters,
  take?: number,
) {
  return prisma.commissionEntry.findMany({
    where: commissionWhereForActor(actor, filters),
    orderBy: [{ earnedAt: "desc" }, { createdAt: "desc" }],
    ...(take ? { take } : {}),
    select: entrySelect,
  });
}

export async function listCommissionEntries(
  actor: CommissionActor,
  filters: CommissionEntryFilters = {},
) {
  return findCommissionEntries(actor, filters, 500);
}

export async function getCommissionSummary(actor: CommissionActor) {
  const scope =
    actor.role === "ADMIN" ? {} : { technicianId: actor.id };
  const monthStart = parseBangkokCommissionDate(
    firstDayOfCurrentMonthInputValue(),
  )!;

  const [
    pendingAggregate,
    reversedAggregate,
    payoutAggregate,
    monthPayoutAggregate,
    activeRuleCount,
  ] = await Promise.all([
    prisma.commissionEntry.aggregate({
      where: { ...scope, status: "PENDING" },
      _sum: { commissionAmount: true },
      _count: { _all: true },
    }),
    prisma.commissionEntry.aggregate({
      where: { ...scope, status: "REVERSED" },
      _sum: { commissionAmount: true },
      _count: { _all: true },
    }),
    prisma.commissionPayout.aggregate({
      where: scope,
      _sum: { totalAmount: true },
      _count: { _all: true },
    }),
    prisma.commissionPayout.aggregate({
      where: {
        ...scope,
        paidAt: { gte: monthStart },
      },
      _sum: { totalAmount: true },
    }),
    prisma.commissionRule.count({ where: { isActive: true } }),
  ]);

  return {
    pendingNet: pendingAggregate._sum.commissionAmount?.toFixed(2) ?? "0.00",
    pendingCount: pendingAggregate._count._all,
    reversedAmount:
      reversedAggregate._sum.commissionAmount?.toFixed(2) ?? "0.00",
    reversedCount: reversedAggregate._count._all,
    paidTotal: payoutAggregate._sum.totalAmount?.toFixed(2) ?? "0.00",
    payoutCount: payoutAggregate._count._all,
    paidThisMonth:
      monthPayoutAggregate._sum.totalAmount?.toFixed(2) ?? "0.00",
    activeRuleCount,
  };
}

export async function listCommissionPayouts(actor: CommissionActor) {
  const where =
    actor.role === "ADMIN" ? {} : { technicianId: actor.id };

  return prisma.commissionPayout.findMany({
    where,
    orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
    take: 100,
    select: payoutListSelect,
  });
}

export async function getCommissionPayoutById(
  actor: CommissionActor,
  payoutId: string,
) {
  return prisma.commissionPayout.findFirst({
    where: {
      id: payoutId,
      ...(actor.role === "ADMIN" ? {} : { technicianId: actor.id }),
    },
    select: {
      id: true,
      payoutNo: true,
      technicianId: true,
      periodStart: true,
      periodEnd: true,
      totalAmount: true,
      status: true,
      note: true,
      paidAt: true,
      createdAt: true,
      technician: { select: { id: true, name: true, email: true } },
      paidBy: { select: { id: true, name: true } },
      items: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          amount: true,
          commissionEntry: {
            select: {
              id: true,
              kind: true,
              basis: true,
              ruleName: true,
              ruleType: true,
              rateSnapshot: true,
              baseAmount: true,
              costAmount: true,
              commissionAmount: true,
              status: true,
              earnedAt: true,
              reversedAt: true,
              bill: {
                select: {
                  id: true,
                  billNumber: true,
                  title: true,
                  status: true,
                },
              },
            },
          },
        },
      },
    },
  });
}

export async function listOutstandingCommissionBalances(
  actor: CommissionActor,
) {
  assertAdmin(actor);

  const [technicians, grouped] = await Promise.all([
    prisma.user.findMany({
      where: { role: "TECHNICIAN", isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
    prisma.commissionEntry.groupBy({
      by: ["technicianId"],
      where: { status: "PENDING" },
      _sum: { commissionAmount: true },
    }),
  ]);
  const balances = new Map(
    grouped.map((row) => [
      row.technicianId,
      row._sum.commissionAmount?.toFixed(2) ?? "0.00",
    ]),
  );

  return technicians.map((technician) => ({
    ...technician,
    outstanding: balances.get(technician.id) ?? "0.00",
  }));
}

export async function createCommissionPayout(
  actor: CommissionActor,
  input: CommissionPayoutInput,
) {
  assertAdmin(actor);

  return prisma.$transaction(async (tx) => {
    const technician = await tx.user.findFirst({
      where: {
        id: input.technicianId,
        role: "TECHNICIAN",
        isActive: true,
      },
      select: { id: true, name: true },
    });

    if (!technician) {
      throw new CommissionError(
        "TECHNICIAN_INVALID",
        "ไม่พบช่างเทคนิคที่เปิดใช้งานสำหรับรอบจ่ายนี้",
      );
    }

    await lockInventoryKey(tx, `commission:${technician.id}`);

    const entries = await tx.commissionEntry.findMany({
      where: {
        technicianId: technician.id,
        status: "PENDING",
        earnedAt: { lte: input.periodEnd },
      },
      orderBy: [{ earnedAt: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        billId: true,
        commissionAmount: true,
        earnedAt: true,
      },
    });

    if (entries.length === 0) {
      throw new CommissionError(
        "NO_PENDING_ENTRIES",
        "ไม่พบรายการค่าคอมมิชชั่นที่รอจ่ายถึงวันสิ้นสุดรอบนี้",
      );
    }

    const total = entries.reduce(
      (sum, entry) => sum.plus(entry.commissionAmount),
      new Decimal(0),
    );

    if (total.isNegative()) {
      throw new CommissionError(
        "PAYOUT_NEGATIVE",
        "ยอดสุทธิติดลบ จึงยังสร้างรอบจ่ายไม่ได้ กรุณารอรายการค่าคอมมิชชั่นใหม่มาหักกลบ",
        [
          `ยอดรอจ่ายรวม ${toMoneyString(total)}`,
          `จำนวนรายการ ${entries.length.toLocaleString("th-TH")}`,
        ],
      );
    }

    const now = new Date();
    const periodStart =
      entries[0]!.earnedAt.getTime() < input.periodStart.getTime()
        ? entries[0]!.earnedAt
        : input.periodStart;
    const year = currentBuddhistYear(now);
    const running = await nextDocumentSequence(tx, `PAY-${year}`, {
      padding: 6,
      createdById: actor.id,
    });
    const payoutNo = `PAY-${year}-${running}`;

    const payout = await tx.commissionPayout.create({
      data: {
        payoutNo,
        technicianId: technician.id,
        periodStart,
        periodEnd: input.periodEnd,
        totalAmount: total,
        status: "PAID",
        note: optional(input.note),
        paidAt: now,
        paidById: actor.id,
        createdById: actor.id,
      },
      select: { id: true, payoutNo: true, totalAmount: true },
    });

    await tx.commissionPayoutItem.createMany({
      data: entries.map((entry) => ({
        payoutId: payout.id,
        commissionEntryId: entry.id,
        amount: entry.commissionAmount,
        createdById: actor.id,
      })),
    });

    const paid = await tx.commissionEntry.updateMany({
      where: {
        id: { in: entries.map((entry) => entry.id) },
        status: "PENDING",
      },
      data: { status: "PAID" },
    });

    if (paid.count !== entries.length) {
      throw new CommissionError(
        "NO_PENDING_ENTRIES",
        "รายการค่าคอมมิชชั่นเปลี่ยนสถานะระหว่างสร้างรอบจ่าย กรุณาลองใหม่",
      );
    }

    await writeAuditLog(
      {
        actorId: actor.id,
        action: "COMMISSION_PAYOUT_CREATED",
        entityType: "CommissionPayout",
        entityId: payout.id,
        after: {
          payoutNo: payout.payoutNo,
          technicianId: technician.id,
          technicianName: technician.name,
          periodStart: periodStart.toISOString(),
          periodEnd: input.periodEnd.toISOString(),
          totalAmount: paymentString(payout.totalAmount),
          entryCount: entries.length,
          status: "PAID",
        },
      },
      tx,
    );

    return {
      id: payout.id,
      payoutNo: payout.payoutNo,
      totalAmount: paymentString(payout.totalAmount),
      entryCount: entries.length,
    };
  });
}

function paymentString(value: Decimal): string {
  return value.toFixed(2);
}

export async function buildCommissionCsv(
  actor: CommissionActor,
  filters: CommissionEntryFilters = {},
) {
  assertAdmin(actor);

  const entries = await findCommissionEntries(actor, filters, 10_000);
  const headers = [
    "เลขที่บิล",
    "วันที่บิล",
    "สถานะบิล",
    "ช่างเทคนิค",
    "ประเภทบิล",
    "ชื่อบิล",
    "ประเภทคอมมิชชั่น",
    "ประเภทกติกา",
    "กติกา",
    "ฐานคำนวณ",
    "ต้นทุน",
    "อัตรา",
    "จำนวนเงิน",
    "สถานะรายการ",
    "ได้เมื่อ",
    "กลับรายการเมื่อ",
    "เลขที่รอบจ่าย",
    "สถานะรอบจ่าย",
  ];
  const rows = entries.map((entry) => [
    entry.bill.billNumber,
    entry.bill.createdAt.toISOString(),
    entry.bill.status,
    entry.technician.name,
    entry.bill.billType.code,
    entry.bill.title,
    entry.kind,
    entry.basis,
    entry.ruleName,
    entry.baseAmount.toFixed(2),
    entry.costAmount.toFixed(2),
    entry.rateSnapshot?.toFixed(4) ?? "",
    entry.commissionAmount.toFixed(2),
    entry.status,
    entry.earnedAt.toISOString(),
    entry.reversedAt?.toISOString() ?? "",
    entry.payoutItem?.payout.payoutNo ?? "",
    entry.payoutItem?.payout.status ?? "",
  ]);

  return {
    csv: toCsv(headers, rows),
    rowCount: entries.length,
  };
}
