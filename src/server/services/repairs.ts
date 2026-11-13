import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { RepairStatus, Role } from "@/generated/prisma/enums";

import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/server/audit";

export type RepairActor = {
  id: string;
  role: Role;
};

export class RepairError extends Error {
  constructor(
    public readonly code:
      | "NOT_FOUND"
      | "FORBIDDEN"
      | "INVALID_STATUS"
      | "INVALID_TRANSITION",
    message: string,
  ) {
    super(message);
    this.name = "RepairError";
  }
}

const repairBoardSelect = {
  id: true,
  billNumber: true,
  title: true,
  status: true,
  grandTotal: true,
  createdAt: true,
  updatedAt: true,
  technicianId: true,
  customer: {
    select: {
      id: true,
      name: true,
      phone: true,
      lineId: true,
      whatsapp: true,
    },
  },
  technician: { select: { id: true, name: true } },
  repairDetail: {
    select: {
      deviceBrand: true,
      deviceModel: true,
      deviceSerial: true,
      reportedSymptoms: true,
      diagnosis: true,
      resolution: true,
      accessories: true,
      estimatedCost: true,
      depositAmount: true,
      dueAt: true,
      warrantyDays: true,
      repairStatus: true,
      receivedAt: true,
      completedAt: true,
      deliveredAt: true,
      updatedAt: true,
    },
  },
} satisfies Prisma.BillSelect;

export type RepairJob = Prisma.BillGetPayload<{
  select: typeof repairBoardSelect;
}>;

export async function listRepairJobs(actor: RepairActor): Promise<RepairJob[]> {
  return prisma.bill.findMany({
    where: {
      ...(actor.role === "ADMIN" ? {} : { technicianId: actor.id }),
      status: { not: "VOIDED" },
      repairDetail: { isNot: null },
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    take: 300,
    select: repairBoardSelect,
  });
}

const allowedStatuses: RepairStatus[] = [
  "RECEIVED",
  "INSPECTING",
  "WAITING_APPROVAL",
  "WAITING_PARTS",
  "REPAIRING",
  "COMPLETED",
  "DELIVERED",
];

export async function updateRepairStatus(
  actor: RepairActor,
  billId: string,
  status: RepairStatus,
) {
  if (!allowedStatuses.includes(status)) {
    throw new RepairError("INVALID_STATUS", "สถานะงานซ่อมไม่ถูกต้อง");
  }

  return prisma.$transaction(async (tx) => {
    const bill = await tx.bill.findUnique({
      where: { id: billId },
      select: {
        id: true,
        billNumber: true,
        status: true,
        technicianId: true,
        repairDetail: {
          select: {
            id: true,
            repairStatus: true,
            receivedAt: true,
            completedAt: true,
            deliveredAt: true,
          },
        },
      },
    });

    if (!bill || !bill.repairDetail) {
      throw new RepairError("NOT_FOUND", "ไม่พบงานซ่อมนี้");
    }

    if (actor.role !== "ADMIN" && bill.technicianId !== actor.id) {
      throw new RepairError(
        "FORBIDDEN",
        "แก้ไขสถานะได้เฉพาะงานซ่อมของตนเอง",
      );
    }

    if (bill.status === "VOIDED") {
      throw new RepairError(
        "INVALID_STATUS",
        "บิลนี้ถูกยกเลิกแล้ว ไม่สามารถเปลี่ยนสถานะงานซ่อมได้",
      );
    }

    const now = new Date();
    await tx.billRepairDetail.update({
      where: { id: bill.repairDetail.id },
      data: {
        repairStatus: status,
        receivedAt: bill.repairDetail.receivedAt ?? now,
        completedAt:
          status === "COMPLETED" || status === "DELIVERED"
            ? (bill.repairDetail.completedAt ?? now)
            : null,
        deliveredAt:
          status === "DELIVERED"
            ? (bill.repairDetail.deliveredAt ?? now)
            : null,
      },
    });

    await writeAuditLog(
      {
        actorId: actor.id,
        action: "REPAIR_STATUS_CHANGED",
        entityType: "BillRepairDetail",
        entityId: bill.repairDetail.id,
        before: { status: bill.repairDetail.repairStatus },
        after: { status },
        metadata: { billId: bill.id, billNumber: bill.billNumber },
      },
      tx,
    );

    return {
      billId: bill.id,
      billNumber: bill.billNumber,
      status,
    };
  });
}
