import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Ban,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  Coins,
  CreditCard,
  FileClock,
  History,
  PackageCheck,
  Pencil,
  Printer,
  ReceiptText,
  Send,
  ShieldCheck,
  UserRound,
  Wrench,
} from "lucide-react";

import { BillStatusBadge } from "@/components/bills/bill-status-badge";
import { BillWorkflowForm } from "@/components/bills/bill-workflow-forms";
import { SuccessAlert } from "@/components/forms/form-feedback";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  billItemKindLabel,
  billStatusLabel,
  paymentMethodLabel,
  repairStatusLabel,
  warrantyCheckResultClass,
  warrantyCheckResultLabel,
} from "@/lib/bill-labels";
import {
  commissionBasisLabel,
  commissionEntryKindLabel,
  commissionEntryStatusClass,
  commissionEntryStatusLabel,
  commissionRateLabel,
} from "@/lib/commission-labels";
import { formatThaiDate, formatThaiDateTime } from "@/lib/labels";
import { Decimal, formatTHB } from "@/lib/money";
import { formatThaiPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";
import { requireUser } from "@/server/auth/session";
import {
  canEditBill,
  canViewBill,
  getBillById,
} from "@/server/services/bills";

export const instant = false;

export const metadata: Metadata = {
  title: "รายละเอียดบิล",
};

function claimedSerialFromSnapshot(snapshot: unknown): string {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return "";
  }

  const value = (snapshot as Record<string, unknown>).claimedSerialNumber;
  return typeof value === "string" ? value : "";
}

export default async function BillDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    created?: string;
    updated?: string;
    submitted?: string;
    approved?: string;
    rejected?: string;
    paid?: string;
    voided?: string;
  }>;
}) {
  const actor = await requireUser();
  const { id } = await params;
  const [bill, query] = await Promise.all([
    getBillById({ id: actor.id, role: actor.role }, id),
    searchParams,
  ]);

  if (!bill) {
    notFound();
  }

  const actorRef = { id: actor.id, role: actor.role };
  const isAdmin = actor.role === "ADMIN";
  const editable = canEditBill(actorRef, bill);
  const hasWarrantyOverride = Boolean(
    bill.warrantyClaim?.adminOverrideReason,
  );
  const hasClaimWarning =
    bill.billType.requiresWarrantyCheck &&
    bill.warrantyClaim?.checkResult !== "FOUND_IN_WARRANTY";
  const claimedSerial =
    bill.warrantyClaim?.productSerial?.serialNumber ??
    claimedSerialFromSnapshot(bill.warrantyClaim?.checkSnapshot);
  const commissionNet = bill.commissionEntries.reduce(
    (sum, entry) => sum.plus(entry.commissionAmount),
    new Decimal(0),
  );

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/bills"
          className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          กลับรายการบิล
        </Link>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <BillStatusBadge status={bill.status} />
              <Badge variant="outline">
                {bill.billType.name} · {bill.billType.code}
              </Badge>
              {bill.stockDeductedAt && !bill.stockRestoredAt ? (
                <Badge
                  variant="outline"
                  className="border-blue-200 dark:border-blue-900/60 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300"
                >
                  <PackageCheck aria-hidden />
                  ตัดสต๊อกแล้ว
                </Badge>
              ) : null}
              {bill.stockRestoredAt ? (
                <Badge variant="outline">คืนสต๊อกแล้ว</Badge>
              ) : null}
            </div>
            <h2 className="mt-2 font-mono text-xl font-semibold tracking-tight sm:text-2xl">
              {bill.billNumber}
            </h2>
            <p className="mt-1 text-sm font-medium">{bill.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              <Link
                href={`/customers/${bill.customer.id}`}
                className="font-medium text-foreground hover:text-primary"
              >
                {bill.customer.name}
              </Link>{" "}
              · {formatThaiPhone(bill.customer.phone)} · ช่าง{" "}
              {bill.technician.name} · เปิดบิล{" "}
              {formatThaiDateTime(bill.createdAt)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/print/bills/${bill.id}/a4`}
              className={cn(buttonVariants(), "h-9")}
            >
              <Printer aria-hidden />
              พิมพ์เอกสาร
            </Link>
            {editable ? (
              <Link
                href={`/bills/${bill.id}/edit`}
                className={cn(buttonVariants({ variant: "outline" }), "h-9")}
              >
                <Pencil aria-hidden />
                แก้ไขบิล
              </Link>
            ) : null}
            <Link
              href={`/customers/${bill.customer.id}`}
              className={cn(buttonVariants({ variant: "outline" }), "h-9")}
            >
              <UserRound aria-hidden />
              โปรไฟล์ลูกค้า
            </Link>
          </div>
        </div>
      </div>

      {query.created ? (
        <SuccessAlert title="สร้างบิลร่างแล้ว">
          ตรวจสอบรายการและกด “ส่งขออนุมัติ” เมื่อพร้อม
        </SuccessAlert>
      ) : null}
      {query.updated ? (
        <SuccessAlert title="บันทึกการแก้ไขแล้ว">
          ข้อมูลบิลและยอดรวมถูกคำนวณใหม่แล้ว
        </SuccessAlert>
      ) : null}
      {query.submitted ? (
        <SuccessAlert title="ส่งขออนุมัติแล้ว">
          บิลอยู่ในคิวรอผู้ดูแลระบบตรวจสอบและอนุมัติ
        </SuccessAlert>
      ) : null}
      {query.approved ? (
        <SuccessAlert title="อนุมัติบิลแล้ว">
          ระบบตัดสต๊อก ผูก Serial และบันทึกค่าคอมมิชชั่นตามกติกาที่มีผลอยู่
        </SuccessAlert>
      ) : null}
      {query.rejected ? (
        <SuccessAlert title="ตีกลับบิลแล้ว">
          ช่างสามารถแก้ไขและส่งบิลนี้ขออนุมัติใหม่ได้
        </SuccessAlert>
      ) : null}
      {query.paid ? (
        <SuccessAlert title="บันทึกชำระเงินแล้ว">
          บิลปิดยอดเรียบร้อย
        </SuccessAlert>
      ) : null}
      {query.voided ? (
        <SuccessAlert title="ยกเลิกบิลแล้ว">
          ระบบคืนสต๊อกและ Serial แล้ว พร้อมสร้างรายการกลับค่าคอมมิชชั่น
        </SuccessAlert>
      ) : null}

      {bill.status === "REJECTED" && bill.rejectionReason ? (
        <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 px-4 py-3 text-sm text-rose-900 dark:text-rose-200">
          <p className="font-medium">เหตุผลที่ตีกลับ</p>
          <p className="mt-1 whitespace-pre-wrap leading-6">
            {bill.rejectionReason}
          </p>
        </div>
      ) : null}
      {bill.status === "VOIDED" && bill.voidReason ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
          <p className="font-medium">เหตุผลการยกเลิก</p>
          <p className="mt-1 whitespace-pre-wrap leading-6">{bill.voidReason}</p>
        </div>
      ) : null}
      {hasClaimWarning && bill.status === "PENDING_APPROVAL" ? (
        <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
          <p className="flex items-center gap-2 font-medium">
            <CircleAlert className="size-4 shrink-0" aria-hidden />
            การตรวจประกันไม่ผ่านเกณฑ์
          </p>
          <p className="mt-1 leading-6">
            {warrantyCheckResultLabel(bill.warrantyClaim?.checkResult ?? null)}
            {claimedSerial ? ` · Serial ${claimedSerial}` : ""} —{" "}
            {hasWarrantyOverride
              ? "มีเหตุผลอนุมัติเป็นกรณีพิเศษแล้ว"
              : "ต้องระบุเหตุผลอนุมัติเป็นกรณีพิเศษก่อนอนุมัติ"}
          </p>
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <Card>
            <CardHeader className="border-b">
              <div className="flex items-center gap-2">
                <ClipboardList className="size-4 text-primary" aria-hidden />
                <div>
                  <CardTitle>รายการในบิล</CardTitle>
                  <CardDescription>
                    {bill.items.length.toLocaleString("th-TH")} รายการ ·
                    ราคาเป็นบาทและคำนวณด้วยทศนิยม
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-0">
              {bill.items.length === 0 ? (
                <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                  <ReceiptText
                    className="mx-auto mb-2 size-6 text-muted-foreground/60"
                    aria-hidden
                  />
                  ยังไม่มีรายการในบิล
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table className="min-w-175">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>รายการ</TableHead>
                        <TableHead className="text-right">จำนวน</TableHead>
                        <TableHead className="text-right">ราคา/หน่วย</TableHead>
                        <TableHead className="text-right">ส่วนลด</TableHead>
                        <TableHead className="text-right">รวม</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bill.items.map((item, index) => (
                        <TableRow key={item.id}>
                          <TableCell className="align-top text-xs text-muted-foreground">
                            {index + 1}
                          </TableCell>
                          <TableCell className="align-top">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Badge variant="secondary">
                                {billItemKindLabel(item.kind)}
                              </Badge>
                              <p className="font-medium">{item.description}</p>
                            </div>
                            {item.skuSnapshot ? (
                              <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                                {item.skuSnapshot}
                                {item.barcodeSnapshot
                                  ? ` · ${item.barcodeSnapshot}`
                                  : ""}
                              </p>
                            ) : null}
                            {item.serials.length > 0 ? (
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {item.serials.map((serial) => (
                                  <Badge
                                    key={serial.id}
                                    variant="outline"
                                    className={cn(
                                      "font-mono text-[10px]",
                                      serial.releasedAt
                                        ? "text-muted-foreground line-through"
                                        : "",
                                    )}
                                  >
                                    {serial.productSerial.serialNumber}
                                  </Badge>
                                ))}
                              </div>
                            ) : null}
                            {item.warrantyMonths ? (
                              <p className="mt-1 text-[11px] text-muted-foreground">
                                ประกัน {item.warrantyMonths} เดือน
                              </p>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-right align-top tabular-nums">
                            {item.quantity.toLocaleString("th-TH")}
                          </TableCell>
                          <TableCell className="text-right align-top tabular-nums">
                            {formatTHB(item.unitPrice.toString())}
                          </TableCell>
                          <TableCell className="text-right align-top text-xs tabular-nums">
                            {item.discountType
                              ? `${formatTHB(item.discountAmount.toString())}`
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right align-top font-medium tabular-nums">
                            {formatTHB(item.lineTotal.toString())}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {bill.repairDetail ? (
            <Card>
              <CardHeader className="border-b">
                <div className="flex items-center gap-2">
                  <Wrench className="size-4 text-primary" aria-hidden />
                  <div>
                    <CardTitle>ข้อมูลงานซ่อม</CardTitle>
                    <CardDescription>
                      สถานะปัจจุบัน ·{" "}
                      {repairStatusLabel(bill.repairDetail.repairStatus)}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground">
                    เครื่อง
                  </p>
                  <p className="mt-1 text-sm">
                    {[bill.repairDetail.deviceBrand, bill.repairDetail.deviceModel]
                      .filter(Boolean)
                      .join(" ") || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground">
                    Serial เครื่อง
                  </p>
                  <p className="mt-1 font-mono text-sm">
                    {bill.repairDetail.deviceSerial ?? "—"}
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-[11px] font-medium text-muted-foreground">
                    อาการเสีย
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-6">
                    {bill.repairDetail.reportedSymptoms || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground">
                    ผลตรวจ / วินิจฉัย
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-6">
                    {bill.repairDetail.diagnosis ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground">
                    วิธีแก้ไข / ผลซ่อม
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-6">
                    {bill.repairDetail.resolution ?? "—"}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {bill.warrantyClaim ? (
            <Card>
              <CardHeader className="border-b">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-primary" aria-hidden />
                  <div className="flex-1">
                    <CardTitle>การตรวจประกัน</CardTitle>
                    <CardDescription>
                      Snapshot จากประวัติซื้อ ณ เวลาตรวจสอบ
                    </CardDescription>
                  </div>
                  <Badge
                    variant="outline"
                    className={warrantyCheckResultClass(
                      bill.warrantyClaim.checkResult,
                    )}
                  >
                    {warrantyCheckResultLabel(
                      bill.warrantyClaim.checkResult,
                    )}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-[11px] font-medium text-muted-foreground">
                      สินค้าที่เคลม
                    </p>
                    <p className="mt-1 font-medium">
                      {bill.warrantyClaim.product.name}
                    </p>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      {bill.warrantyClaim.product.sku}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-muted-foreground">
                      Serial ที่เคลม
                    </p>
                    {claimedSerial ? (
                      <Link
                        href={`/warranty?serial=${encodeURIComponent(claimedSerial)}`}
                        className="mt-1 inline-block font-mono text-primary hover:underline font-semibold"
                        title="คลิกเพื่อตรวจสอบประกัน Serial นี้"
                      >
                        {claimedSerial}
                      </Link>
                    ) : (
                      <p className="mt-1 font-mono text-muted-foreground">—</p>
                    )}
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-muted-foreground">
                      บิลซื้อเดิม
                    </p>
                    {bill.warrantyClaim.originalBill ? (
                      <Link
                        href={`/bills/${bill.warrantyClaim.originalBill.id}`}
                        className="mt-1 inline-block font-mono text-sm font-medium text-primary hover:underline"
                      >
                        {bill.warrantyClaim.originalBill.billNumber}
                      </Link>
                    ) : (
                      <p className="mt-1 text-sm">ไม่พบ</p>
                    )}
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-muted-foreground">
                      วันที่ซื้อ
                    </p>
                    <p className="mt-1">
                      {bill.warrantyClaim.originalSaleAt
                        ? formatThaiDate(bill.warrantyClaim.originalSaleAt)
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-muted-foreground">
                      เริ่มประกัน
                    </p>
                    <p className="mt-1">
                      {bill.warrantyClaim.warrantyStartAt
                        ? formatThaiDate(bill.warrantyClaim.warrantyStartAt)
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-muted-foreground">
                      สิ้นสุดประกัน
                    </p>
                    <p className="mt-1">
                      {bill.warrantyClaim.warrantyEndsAt
                        ? formatThaiDate(bill.warrantyClaim.warrantyEndsAt)
                        : "—"}
                    </p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-[11px] font-medium text-muted-foreground">
                      ตรวจล่าสุด
                    </p>
                    <p className="mt-1">
                      {bill.warrantyClaim.checkedAt
                        ? formatThaiDateTime(bill.warrantyClaim.checkedAt)
                        : "ยังไม่ได้ตรวจ"}
                    </p>
                  </div>
                  {bill.warrantyClaim.adminNote ? (
                    <div className="sm:col-span-2">
                      <p className="text-[11px] font-medium text-muted-foreground">
                        รายละเอียดการเคลม
                      </p>
                      <p className="mt-1 whitespace-pre-wrap leading-6">
                        {bill.warrantyClaim.adminNote}
                      </p>
                    </div>
                  ) : null}
                  {bill.warrantyClaim.adminOverrideReason ? (
                    <div className="rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 p-3 text-amber-950 dark:text-amber-100 sm:col-span-2">
                      <p className="text-[11px] font-semibold">
                        เหตุผลอนุมัติเป็นกรณีพิเศษ
                      </p>
                      <p className="mt-1 whitespace-pre-wrap leading-6">
                        {bill.warrantyClaim.adminOverrideReason}
                      </p>
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {bill.description || bill.note ? (
            <Card>
              <CardHeader className="border-b">
                <CardTitle>รายละเอียดและหมายเหตุ</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {bill.description ? (
                  <div>
                    <p className="text-[11px] font-medium text-muted-foreground">
                      รายละเอียด
                    </p>
                    <p className="mt-1 whitespace-pre-wrap leading-6">
                      {bill.description}
                    </p>
                  </div>
                ) : null}
                {bill.note ? (
                  <div>
                    <p className="text-[11px] font-medium text-muted-foreground">
                      หมายเหตุ
                    </p>
                    <p className="mt-1 whitespace-pre-wrap leading-6">
                      {bill.note}
                    </p>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader className="border-b">
              <div className="flex items-center gap-2">
                <History className="size-4 text-primary" aria-hidden />
                <div>
                  <CardTitle>ประวัติสถานะ</CardTitle>
                  <CardDescription>
                    ทุกการเปลี่ยนสถานะถูกบันทึกพร้อมผู้ดำเนินการ
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ol className="space-y-0">
                {bill.statusHistory.map((entry, index) => (
                  <li
                    key={entry.id}
                    className="relative flex gap-3 pb-5 last:pb-0"
                  >
                    {index < bill.statusHistory.length - 1 ? (
                      <span className="absolute left-[7px] top-4 h-full w-px bg-border" />
                    ) : null}
                    <span className="relative mt-1 size-3.5 shrink-0 rounded-full border-2 border-primary bg-background" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">
                          {entry.fromStatus
                            ? `${billStatusLabel(entry.fromStatus)} → `
                            : ""}
                          {billStatusLabel(entry.toStatus)}
                        </p>
                        <span className="text-[11px] text-muted-foreground">
                          {formatThaiDateTime(entry.changedAt)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {entry.changedBy.name}
                        {entry.reason ? ` · ${entry.reason}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="border-b">
              <CardTitle>สรุปยอดเงิน</CardTitle>
              <CardDescription>
                {bill.vatEnabled
                  ? `VAT ${bill.vatRate.toString()}% ${bill.vatIncluded ? "รวมในราคา" : "แยกนอก"}`
                  : "VAT ปิดใช้งาน"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">ยอดรายการ</span>
                <span className="tabular-nums">
                  {formatTHB(bill.subtotal.toString())}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">ส่วนลดรายการ</span>
                <span className="tabular-nums">
                  {formatTHB(bill.lineDiscountTotal.toString())}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">ส่วนลดท้ายบิล</span>
                <span className="tabular-nums">
                  {formatTHB(bill.discountAmount.toString())}
                </span>
              </div>
              {bill.vatEnabled ? (
                <>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">ยอดก่อน VAT</span>
                    <span className="tabular-nums">
                      {formatTHB(bill.netAmountBeforeVat.toString())}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">VAT</span>
                    <span className="tabular-nums">
                      {formatTHB(bill.vatAmount.toString())}
                    </span>
                  </div>
                </>
              ) : null}
              <div className="flex items-end justify-between gap-3 border-t pt-3">
                <span className="font-semibold">ยอดรวมทั้งสิ้น</span>
                <span className="text-xl font-semibold tabular-nums">
                  {formatTHB(bill.grandTotal.toString())}
                </span>
              </div>
              {bill.paymentMethod ? (
                <div className="flex justify-between gap-3 border-t pt-3">
                  <span className="text-muted-foreground">วิธีชำระ</span>
                  <span className="font-medium">
                    {paymentMethodLabel(bill.paymentMethod)}
                  </span>
                </div>
              ) : null}
              <dl className="space-y-1.5 border-t pt-3 text-[11px] text-muted-foreground">
                <div className="flex justify-between gap-3">
                  <dt>ส่งขออนุมัติ</dt>
                  <dd>{formatThaiDateTime(bill.submittedAt)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt>อนุมัติ</dt>
                  <dd>{formatThaiDateTime(bill.approvedAt)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt>ชำระเงิน</dt>
                  <dd>{formatThaiDateTime(bill.paidAt)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt>ยกเลิก</dt>
                  <dd>{formatThaiDateTime(bill.voidedAt)}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {bill.commissionEntries.length > 0 ? (
            <Card>
              <CardHeader className="border-b">
                <div className="flex items-center gap-2">
                  <Coins className="size-4 text-primary" aria-hidden />
                  <div className="flex-1">
                    <CardTitle>ค่าคอมมิชชั่นของบิล</CardTitle>
                    <CardDescription>
                      Snapshot กติกาและยอด ณ เวลาอนุมัติ
                    </CardDescription>
                  </div>
                  <Badge
                    variant="outline"
                    className="tabular-nums"
                  >
                    {formatTHB(commissionNet)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {bill.commissionEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-lg border bg-muted/20 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge
                            variant={entry.kind === "REVERSAL" ? "destructive" : "secondary"}
                          >
                            {commissionEntryKindLabel(entry.kind)}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={commissionEntryStatusClass(entry.status)}
                          >
                            {commissionEntryStatusLabel(entry.status)}
                          </Badge>
                        </div>
                        <p className="mt-1.5 text-xs font-medium">
                          {entry.ruleName}
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {commissionBasisLabel(entry.basis)} ·{" "}
                          {entry.rateSnapshot
                            ? commissionRateLabel(
                                entry.ruleType,
                                entry.rateSnapshot.toString(),
                              )
                            : "—"}
                        </p>
                      </div>
                      <p
                        className={cn(
                          "shrink-0 text-sm font-semibold tabular-nums",
                          entry.commissionAmount.isNegative()
                            ? "text-rose-700 dark:text-rose-300"
                            : "text-emerald-700 dark:text-emerald-300",
                        )}
                      >
                        {formatTHB(entry.commissionAmount.toString())}
                      </p>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted-foreground">
                      <span>
                        ฐาน {formatTHB(entry.baseAmount.toString())} · ต้นทุน{" "}
                        {formatTHB(entry.costAmount.toString())}
                      </span>
                      <span>{formatThaiDateTime(entry.earnedAt)}</span>
                    </div>
                    {entry.payoutItem ? (
                      <Link
                        href={`/commissions/payouts/${entry.payoutItem.payoutId}`}
                        className="mt-1.5 inline-block font-mono text-[10px] font-medium text-primary hover:underline"
                      >
                        รอบจ่าย {entry.payoutItem.payout.payoutNo}
                      </Link>
                    ) : null}
                  </div>
                ))}
                <Link
                  href={`/commissions?billId=${bill.id}`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                >
                  ดูรายการคอมมิชชั่นทั้งหมดของบิลนี้
                  <ArrowLeft className="size-3.5 rotate-180" aria-hidden />
                </Link>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader className="border-b">
              <div className="flex items-center gap-2">
                <Send className="size-4 text-primary" aria-hidden />
                <div>
                  <CardTitle>ดำเนินการ</CardTitle>
                  <CardDescription>
                    {isAdmin
                      ? "คุณมีสิทธิ์อนุมัติ ตีกลับ รับชำระ และยกเลิกบิล"
                      : "ช่างเทคนิคส่งบิลของตนเองเพื่อขออนุมัติ"}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {bill.status === "DRAFT" || bill.status === "REJECTED" ? (
                <>
                  <div className="rounded-lg bg-muted/40 p-3 text-xs leading-5 text-muted-foreground">
                    ตรวจสอบรายการและยอดเงิน แล้วส่งให้ผู้ดูแลระบบอนุมัติ
                    ระบบจะตรวจสต๊อกอีกครั้งก่อนส่ง
                  </div>
                  <BillWorkflowForm kind="submit" billId={bill.id} />
                  {editable ? (
                    <Link
                      href={`/bills/${bill.id}/edit`}
                      className={cn(
                        buttonVariants({ variant: "outline" }),
                        "h-9 w-full",
                      )}
                    >
                      <Pencil aria-hidden />
                      แก้ไขรายการ
                    </Link>
                  ) : null}
                </>
              ) : null}

              {bill.status === "PENDING_APPROVAL" ? (
                isAdmin ? (
                  <>
                    {hasClaimWarning ? (
                      <div className="rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs leading-5 text-amber-900 dark:text-amber-200">
                        บิลเคลมนี้ยังไม่ผ่านเกณฑ์ประกัน
                        ต้องระบุเหตุผลอนุมัติเป็นกรณีพิเศษอย่างน้อย 3 ตัวอักษร
                      </div>
                    ) : null}
                    {bill.technicianId === actor.id ? (
                      <div className="rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs leading-5 text-amber-900 dark:text-amber-200">
                        บิลนี้คุณเป็นทั้งผู้สร้างและผู้อนุมัติ —
                        ระบบบันทึกชื่อผู้อนุมัติและเวลาไว้ใน audit log
                        เพื่อให้ตรวจย้อนหลังได้
                      </div>
                    ) : null}
                    <BillWorkflowForm kind="approve" billId={bill.id} />
                    <div className="border-t pt-3">
                      <BillWorkflowForm
                        kind="reject"
                        billId={bill.id}
                        tone="destructive"
                      />
                    </div>
                  </>
                ) : (
                  <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 p-3 text-xs leading-5 text-amber-900 dark:text-amber-200">
                    <p className="flex items-center gap-1.5 font-medium">
                      <FileClock className="size-3.5" aria-hidden />
                      รอผู้ดูแลระบบอนุมัติ
                    </p>
                    <p className="mt-1">
                      ยังไม่มีการตัดสต๊อกจนกว่าบิลจะได้รับการอนุมัติ
                    </p>
                  </div>
                )
              ) : null}

              {bill.status === "APPROVED" ? (
                isAdmin ? (
                  <>
                    <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 p-3 text-xs leading-5 text-blue-900 dark:text-blue-200">
                      <p className="flex items-center gap-1.5 font-medium">
                        <CheckCircle2 className="size-3.5" aria-hidden />
                        อนุมัติและตัดสต๊อกแล้ว
                      </p>
                      <p className="mt-1">
                        รับชำระเงินหรือยกเลิกบิลพร้อมคืนสต๊อกได้จากที่นี่
                      </p>
                    </div>
                    <BillWorkflowForm kind="pay" billId={bill.id} />
                    <div className="border-t pt-3">
                      <BillWorkflowForm kind="void" billId={bill.id} />
                    </div>
                  </>
                ) : (
                  <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 p-3 text-xs leading-5 text-blue-900 dark:text-blue-200">
                    <p className="flex items-center gap-1.5 font-medium">
                      <CheckCircle2 className="size-3.5" aria-hidden />
                      อนุมัติแล้ว
                    </p>
                    <p className="mt-1">
                      รอผู้ดูแลระบบบันทึกการชำระเงิน
                    </p>
                  </div>
                )
              ) : null}

              {bill.status === "PAID" ? (
                isAdmin ? (
                  <>
                    <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-3 text-xs leading-5 text-emerald-900 dark:text-emerald-200">
                      <p className="flex items-center gap-1.5 font-medium">
                        <CreditCard className="size-3.5" aria-hidden />
                        ชำระเงินแล้ว
                      </p>
                      <p className="mt-1">
                        หากยกเลิกบิล ระบบจะคืนสต๊อกและ Serial
                        แต่ประวัติการชำระจะยังถูกเก็บไว้
                      </p>
                    </div>
                    <BillWorkflowForm kind="void" billId={bill.id} />
                  </>
                ) : (
                  <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-3 text-xs leading-5 text-emerald-900 dark:text-emerald-200">
                    <p className="flex items-center gap-1.5 font-medium">
                      <CreditCard className="size-3.5" aria-hidden />
                      ชำระเงินแล้ว
                    </p>
                  </div>
                )
              ) : null}

              {bill.status === "VOIDED" ? (
                <div className="rounded-lg bg-muted p-3 text-xs leading-5 text-muted-foreground">
                  <p className="flex items-center gap-1.5 font-medium text-foreground">
                    <Ban className="size-3.5" aria-hidden />
                    บิลนี้ถูกยกเลิกแล้ว
                  </p>
                  <p className="mt-1">
                    ไม่สามารถแก้ไขหรือเปลี่ยนสถานะต่อได้
                    แต่ประวัติทั้งหมดยังคงอยู่
                  </p>
                </div>
              ) : null}

              {!canViewBill(actorRef, bill) ? (
                <div className="rounded-lg bg-destructive/5 p-3 text-xs text-destructive">
                  <CircleAlert className="mr-1 inline size-3.5" aria-hidden />
                  คุณไม่มีสิทธิ์เข้าถึงบิลนี้
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card size="sm" className="bg-muted/30">
            <CardContent className="space-y-2 text-[11px] leading-5 text-muted-foreground">
              <p className="flex gap-2">
                <ShieldCheck
                  className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-300"
                  aria-hidden
                />
                การอนุมัติจะล็อกสินค้าและตรวจสต๊อก/Serial ซ้ำใน transaction
                เดียว
              </p>
              <p className="flex gap-2">
                <CalendarDays
                  className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                  aria-hidden
                />
                เวลาในระบบแสดงเป็น Asia/Bangkok
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
