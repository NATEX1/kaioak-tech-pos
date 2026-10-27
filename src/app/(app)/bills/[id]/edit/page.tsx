import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CircleAlert, Pencil } from "lucide-react";

import {
  BillForm,
  type BillFormInitial,
} from "@/components/bills/bill-form";
import { BillStatusBadge } from "@/components/bills/bill-status-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatThaiDateTime } from "@/lib/labels";
import { requireUser } from "@/server/auth/session";
import { getBillById, canEditBill } from "@/server/services/bills";
import { getBillFormOptions } from "@/server/services/billing-options";

export const instant = false;

export const metadata: Metadata = {
  title: "แก้ไขบิล",
};

function claimedSerialFromSnapshot(snapshot: unknown): string {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return "";
  }

  const value = (snapshot as Record<string, unknown>).claimedSerialNumber;
  return typeof value === "string" ? value : "";
}

export default async function EditBillPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requireUser();
  const { id } = await params;
  const actorRef = { id: actor.id, role: actor.role };
  const [bill, options] = await Promise.all([
    getBillById(actorRef, id),
    getBillFormOptions(actorRef),
  ]);

  if (!bill) {
    notFound();
  }

  if (!canEditBill(actorRef, bill)) {
    redirect(`/bills/${bill.id}`);
  }

  const initial: BillFormInitial = {
    id: bill.id,
    billNumber: bill.billNumber,
    billTypeId: bill.billType.id,
    customerId: bill.customer.id,
    technicianId: bill.technician.id,
    title: bill.title,
    description: bill.description ?? "",
    note: bill.note ?? "",
    discountType: bill.discountType,
    discountValue: bill.discountValue.toFixed(2),
    items: bill.items.map((item) => ({
      kind: item.kind,
      productId: item.productId,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice.toFixed(2),
      discountType: item.discountType,
      discountValue: item.discountValue.toFixed(2),
      serialIds: item.serials
        .filter((serial) => !serial.releasedAt)
        .map((serial) => serial.productSerial.id),
    })),
    repair: bill.repairDetail
      ? {
          deviceBrand: bill.repairDetail.deviceBrand ?? "",
          deviceModel: bill.repairDetail.deviceModel ?? "",
          deviceSerial: bill.repairDetail.deviceSerial ?? "",
          reportedSymptoms: bill.repairDetail.reportedSymptoms,
          diagnosis: bill.repairDetail.diagnosis ?? "",
          resolution: bill.repairDetail.resolution ?? "",
          repairStatus: bill.repairDetail.repairStatus,
        }
      : undefined,
    claim: bill.warrantyClaim
      ? {
          productId: bill.warrantyClaim.productId,
          serialNumber:
            bill.warrantyClaim.productSerial?.serialNumber ??
            claimedSerialFromSnapshot(bill.warrantyClaim.checkSnapshot),
          note: bill.warrantyClaim.adminNote ?? "",
        }
      : undefined,
  };

  return (
    <div className="space-y-5">
      <div>
        <Link
          href={`/bills/${bill.id}`}
          className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          กลับรายละเอียดบิล
        </Link>
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold tracking-tight">
                แก้ไขบิล {bill.billNumber}
              </h2>
              <BillStatusBadge status={bill.status} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {bill.billType.name} · {bill.customer.name} · แก้ไขล่าสุด{" "}
              {formatThaiDateTime(bill.updatedAt)}
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Pencil className="size-4 text-primary" aria-hidden />
            แก้ไขได้เฉพาะบิลร่างหรือบิลที่ถูกตีกลับ
          </div>
        </div>
      </div>

      {bill.status === "REJECTED" ? (
        <Card size="sm" className="border-rose-200 dark:border-rose-900/60 bg-rose-50/60 dark:bg-rose-950/30">
          <CardHeader>
            <div className="flex items-start gap-2">
              <CircleAlert
                className="mt-0.5 size-4 shrink-0 text-rose-700 dark:text-rose-300"
                aria-hidden
              />
              <div>
                <CardTitle className="text-base text-rose-950 dark:text-rose-100">
                  บิลนี้ถูกตีกลับ
                </CardTitle>
                <CardDescription className="text-rose-900 dark:text-rose-200">
                  {bill.rejectionReason ?? "ไม่ระบุเหตุผล"}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="text-xs leading-5 text-rose-900 dark:text-rose-200">
            แก้ไขรายการแล้วบันทึก จากนั้นเปิดหน้ารายละเอียดบิลเพื่อส่งขออนุมัติใหม่
          </CardContent>
        </Card>
      ) : null}

      <BillForm
        mode="edit"
        billId={bill.id}
        billTypes={options.billTypes}
        customers={options.customers}
        technicians={options.technicians}
        products={options.products}
        settings={options.settings}
        isAdmin={actor.role === "ADMIN"}
        currentUserId={actor.id}
        currentUserName={actor.name}
        initial={initial}
      />
    </div>
  );
}
