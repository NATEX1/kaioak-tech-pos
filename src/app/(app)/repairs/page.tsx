import type { Metadata } from "next";

import {
  RepairBoard,
  type RepairJobData,
} from "@/components/repairs/repair-board";
import type { MessageTemplateMap } from "@/lib/messaging";
import { requireUser } from "@/server/auth/session";
import { listRepairJobs } from "@/server/services/repairs";
import { getShopSettings } from "@/server/services/settings";

export const instant = false;

export const metadata: Metadata = {
  title: "กระดานงานซ่อม",
};

export default async function RepairsPage() {
  const actor = await requireUser();
  const [jobs, settings] = await Promise.all([
    listRepairJobs({ id: actor.id, role: actor.role }),
    getShopSettings(),
  ]);

  const data: RepairJobData[] = jobs
    .filter((job) => job.repairDetail !== null)
    .map((job) => {
      const repair = job.repairDetail!;
      return {
        id: job.id,
        billNumber: job.billNumber,
        title: job.title,
        billStatus: job.status,
        grandTotal: job.grandTotal.toFixed(2),
        createdAt: job.createdAt.toISOString(),
        updatedAt: job.updatedAt.toISOString(),
        customer: job.customer,
        technician: job.technician,
        repair: {
          deviceBrand: repair.deviceBrand,
          deviceModel: repair.deviceModel,
          deviceSerial: repair.deviceSerial,
          reportedSymptoms: repair.reportedSymptoms,
          diagnosis: repair.diagnosis,
          resolution: repair.resolution,
          accessories: repair.accessories,
          estimatedCost: repair.estimatedCost?.toFixed(2) ?? null,
          depositAmount: repair.depositAmount.toFixed(2),
          dueAt: repair.dueAt?.toISOString() ?? null,
          warrantyDays: repair.warrantyDays,
          repairStatus: repair.repairStatus,
          receivedAt: repair.receivedAt?.toISOString() ?? null,
          completedAt: repair.completedAt?.toISOString() ?? null,
          deliveredAt: repair.deliveredAt?.toISOString() ?? null,
        },
      };
    });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">กระดานงานซ่อม</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          ติดตามสถานะงานซ่อมทั้งหมด เลื่อนสถานะ และแจ้งลูกค้าผ่าน LINE/WhatsApp
        </p>
      </div>
      <RepairBoard
        jobs={data}
        messageTemplates={settings.messageTemplates as MessageTemplateMap | null}
        shopName={settings.shopName}
      />
    </div>
  );
}
