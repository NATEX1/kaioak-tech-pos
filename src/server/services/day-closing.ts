import "server-only";

import type { Role } from "@/generated/prisma/enums";

import { bangkokDayKey } from "@/lib/bangkok-periods";
import { prisma } from "@/lib/db";
import { Decimal } from "@/lib/money";
import { writeAuditLog } from "@/server/audit";

export type ClosingActor = {
  id: string;
  role: Role;
};

export class DayClosingError extends Error {
  constructor(
    public readonly code: "FORBIDDEN" | "INVALID_DATE" | "INVALID_AMOUNT",
    message: string,
  ) {
    super(message);
    this.name = "DayClosingError";
  }
}

export function parseBangkokDateKey(dateKey: string): {
  start: Date;
  end: Date;
} {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    throw new DayClosingError("INVALID_DATE", "รูปแบบวันที่ไม่ถูกต้อง");
  }

  const start = new Date(`${dateKey}T00:00:00+07:00`);
  if (Number.isNaN(start.getTime())) {
    throw new DayClosingError("INVALID_DATE", "รูปแบบวันที่ไม่ถูกต้อง");
  }

  const normalized = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(start);

  if (normalized !== dateKey) {
    throw new DayClosingError("INVALID_DATE", "วันที่ไม่ถูกต้อง");
  }

  return {
    start,
    end: new Date(start.getTime() + 24 * 60 * 60 * 1000),
  };
}

export type DayClosingPreview = Awaited<ReturnType<typeof getDayClosingPreview>>;

export async function getDayClosingPreview(
  dateKey: string = bangkokDayKey(),
) {
  const { start, end } = parseBangkokDateKey(dateKey);

  const [paidBills, voidCount, depositAggregate, saved, recent] =
    await Promise.all([
      prisma.bill.findMany({
        where: {
          status: "PAID",
          paidAt: { gte: start, lt: end },
        },
        orderBy: { paidAt: "asc" },
        select: {
          id: true,
          billNumber: true,
          title: true,
          grandTotal: true,
          paymentMethod: true,
          paidAt: true,
          receivedAmount: true,
          changeAmount: true,
          customer: { select: { name: true } },
          technician: { select: { name: true } },
        },
      }),
      prisma.bill.count({
        where: { status: "VOIDED", voidedAt: { gte: start, lt: end } },
      }),
      prisma.billRepairDetail.aggregate({
        where: {
          bill: {
            status: { not: "VOIDED" },
            createdAt: { gte: start, lt: end },
          },
        },
        _sum: { depositAmount: true },
      }),
      prisma.dayClosing.findUnique({ where: { dateKey } }),
      prisma.dayClosing.findMany({
        orderBy: { dateKey: "desc" },
        take: 7,
        select: {
          id: true,
          dateKey: true,
          totalSales: true,
          billCount: true,
          countedCash: true,
          difference: true,
          closedAt: true,
        },
      }),
    ]);

  let totalSales = new Decimal(0);
  let cashSales = new Decimal(0);
  let transferSales = new Decimal(0);
  let cardSales = new Decimal(0);
  let qrSales = new Decimal(0);

  for (const bill of paidBills) {
    const amount = new Decimal(bill.grandTotal.toString());
    totalSales = totalSales.plus(amount);

    switch (bill.paymentMethod) {
      case "CASH":
        cashSales = cashSales.plus(amount);
        break;
      case "TRANSFER":
        transferSales = transferSales.plus(amount);
        break;
      case "CARD":
        cardSales = cardSales.plus(amount);
        break;
      case "QR":
        qrSales = qrSales.plus(amount);
        break;
      default:
        break;
    }
  }

  const repairDeposits =
    depositAggregate._sum.depositAmount ?? new Decimal(0);

  return {
    dateKey,
    start,
    end,
    paidBills,
    billCount: paidBills.length,
    voidCount,
    totalSales,
    cashSales,
    transferSales,
    cardSales,
    qrSales,
    repairDeposits,
    expectedCash: cashSales.plus(repairDeposits),
    saved,
    recent,
  };
}

export async function saveDayClosing(
  actor: ClosingActor,
  input: {
    dateKey: string;
    countedCash: string;
    note?: string;
  },
) {
  if (actor.role !== "ADMIN") {
    throw new DayClosingError(
      "FORBIDDEN",
      "เฉพาะผู้ดูแลระบบเท่านั้นที่ปิดยอดได้",
    );
  }

  const countedCash = new Decimal(input.countedCash || "0");
  if (countedCash.isNegative()) {
    throw new DayClosingError("INVALID_AMOUNT", "ยอดเงินนับต้องไม่ติดลบ");
  }

  const preview = await getDayClosingPreview(input.dateKey);
  const difference = countedCash.minus(preview.expectedCash);

  return prisma.$transaction(async (tx) => {
    const closing = await tx.dayClosing.upsert({
      where: { dateKey: input.dateKey },
      create: {
        dateKey: input.dateKey,
        totalSales: preview.totalSales,
        billCount: preview.billCount,
        voidCount: preview.voidCount,
        cashSales: preview.cashSales,
        transferSales: preview.transferSales,
        cardSales: preview.cardSales,
        qrSales: preview.qrSales,
        repairDeposits: preview.repairDeposits,
        expectedCash: preview.expectedCash,
        countedCash,
        difference,
        note: input.note?.trim() || null,
        closedById: actor.id,
        createdById: actor.id,
      },
      update: {
        totalSales: preview.totalSales,
        billCount: preview.billCount,
        voidCount: preview.voidCount,
        cashSales: preview.cashSales,
        transferSales: preview.transferSales,
        cardSales: preview.cardSales,
        qrSales: preview.qrSales,
        repairDeposits: preview.repairDeposits,
        expectedCash: preview.expectedCash,
        countedCash,
        difference,
        note: input.note?.trim() || null,
        closedById: actor.id,
        closedAt: new Date(),
      },
      select: { id: true, dateKey: true, difference: true },
    });

    await writeAuditLog(
      {
        actorId: actor.id,
        action: "DAY_CLOSING_SAVED",
        entityType: "DayClosing",
        entityId: closing.id,
        after: {
          dateKey: closing.dateKey,
          totalSales: preview.totalSales.toFixed(2),
          expectedCash: preview.expectedCash.toFixed(2),
          countedCash: countedCash.toFixed(2),
          difference: difference.toFixed(2),
        },
      },
      tx,
    );

    return closing;
  });
}
