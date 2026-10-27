import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  CalendarDays,
  CircleAlert,
  Coins,
  ReceiptText,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import {
  CommissionEntryKindBadge,
  CommissionEntryStatusBadge,
  CommissionPayoutStatusBadge,
} from "@/components/commissions/commission-status-badges";
import { SuccessAlert } from "@/components/forms/form-feedback";
import { Badge } from "@/components/ui/badge";
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
  commissionBasisLabel,
  commissionRateLabel,
} from "@/lib/commission-labels";
import { formatThaiDate, formatThaiDateTime } from "@/lib/labels";
import { formatTHB } from "@/lib/money";
import { requireUser } from "@/server/auth/session";
import { getCommissionPayoutById } from "@/server/services/commissions";

export const instant = false;

export const metadata: Metadata = {
  title: "รายละเอียดรอบจ่ายค่าคอมมิชชั่น",
};

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b pb-2 last:border-0 last:pb-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-right text-xs font-medium">{children}</span>
    </div>
  );
}

export default async function CommissionPayoutDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const actor = await requireUser();
  const { id } = await params;
  const query = await searchParams;
  const payout = await getCommissionPayoutById(
    { id: actor.id, role: actor.role },
    id,
  );

  if (!payout) {
    notFound();
  }

  const isAdmin = actor.role === "ADMIN";

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <Link
          href={isAdmin ? "/commissions/payouts" : "/commissions"}
          className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          {isAdmin ? "กลับรายการรอบจ่าย" : "กลับหน้าค่าคอมของฉัน"}
        </Link>
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-mono text-xl font-semibold tracking-tight sm:text-2xl">
                {payout.payoutNo}
              </h1>
              <CommissionPayoutStatusBadge status={payout.status} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              รอบจ่ายค่าคอมมิชชั่นของ {payout.technician.name}
            </p>
          </div>
          <Badge variant="outline" className="w-fit text-sm">
            {formatTHB(payout.totalAmount.toString())}
          </Badge>
        </div>
      </div>

      {query.created ? (
        <SuccessAlert title="สร้างรอบจ่ายและบันทึกจ่ายแล้ว">
          ระบบปิดรายการที่รวมในรอบนี้เป็นจ่ายแล้ว
          รายการติดลบจากบิลที่ถูกยกเลิกภายหลังจะถูกหักในรอบถัดไป
        </SuccessAlert>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardHeader className="border-b">
            <div className="flex items-center gap-2">
              <ReceiptText className="size-4 text-primary" aria-hidden />
              <div>
                <CardTitle>รายการในรอบจ่าย</CardTitle>
                <CardDescription>
                  {payout.items.length.toLocaleString("th-TH")} รายการ
                  · ยอดสุทธิ {formatTHB(payout.totalAmount.toString())}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="overflow-x-auto">
              <Table className="min-w-[760px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>บิล</TableHead>
                    <TableHead>ประเภท / กติกา</TableHead>
                    <TableHead className="text-right">ฐาน / ต้นทุน</TableHead>
                    <TableHead className="text-right">ยอดในรอบ</TableHead>
                    <TableHead>สถานะรายการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payout.items.map((item) => {
                    const entry = item.commissionEntry;

                    return (
                      <TableRow key={item.id}>
                        <TableCell className="align-top">
                          <Link
                            href={`/bills/${entry.bill.id}`}
                            className="font-mono text-xs font-semibold text-primary hover:underline"
                          >
                            {entry.bill.billNumber}
                          </Link>
                          <p className="mt-0.5 max-w-52 truncate text-xs">
                            {entry.bill.title}
                          </p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {formatThaiDateTime(entry.earnedAt)}
                          </p>
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="flex flex-wrap items-center gap-1">
                            <CommissionEntryKindBadge kind={entry.kind} />
                            <span className="text-xs font-medium">
                              {entry.ruleName}
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {commissionBasisLabel(entry.basis)}
                            {entry.rateSnapshot
                              ? ` · ${commissionRateLabel(
                                  entry.ruleType,
                                  entry.rateSnapshot.toString(),
                                )}`
                              : ""}
                          </p>
                        </TableCell>
                        <TableCell className="align-top text-right text-xs tabular-nums">
                          <p>{formatTHB(entry.baseAmount.toString())}</p>
                          <p className="mt-0.5 text-muted-foreground">
                            ต้นทุน {formatTHB(entry.costAmount.toString())}
                          </p>
                        </TableCell>
                        <TableCell
                          className={
                            item.amount.isNegative()
                              ? "align-top text-right font-semibold text-rose-700 dark:text-rose-300 tabular-nums"
                              : "align-top text-right font-semibold text-emerald-700 dark:text-emerald-300 tabular-nums"
                          }
                        >
                          {formatTHB(item.amount.toString())}
                        </TableCell>
                        <TableCell className="align-top">
                          <CommissionEntryStatusBadge status={entry.status} />
                          {entry.status === "REVERSED" ? (
                            <p className="mt-1 flex items-start gap-1 text-[10px] text-rose-600 dark:text-rose-300">
                              <CircleAlert className="mt-0.5 size-3" aria-hidden />
                              กลับรายการภายหลัง
                            </p>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card className="h-fit">
            <CardHeader className="border-b">
              <div className="flex items-center gap-2">
                <CalendarDays className="size-4 text-primary" aria-hidden />
                <div>
                  <CardTitle>ข้อมูลรอบจ่าย</CardTitle>
                  <CardDescription>บันทึกโดย Admin</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2.5">
              <DetailRow label="ช่างเทคนิค">
                <span className="inline-flex items-center gap-1">
                  <UserRound className="size-3" aria-hidden />
                  {payout.technician.name}
                </span>
              </DetailRow>
              <DetailRow label="ช่วงรอบ">
                {formatThaiDate(payout.periodStart)} –{" "}
                {formatThaiDate(payout.periodEnd)}
              </DetailRow>
              <DetailRow label="จำนวนรายการ">
                {payout.items.length.toLocaleString("th-TH")}
              </DetailRow>
              <DetailRow label="ยอดจ่าย">
                <span className="text-sm">{formatTHB(payout.totalAmount.toString())}</span>
              </DetailRow>
              <DetailRow label="จ่ายเมื่อ">
                {formatThaiDateTime(payout.paidAt)}
              </DetailRow>
              <DetailRow label="ผู้บันทึกจ่าย">
                {payout.paidBy?.name ?? "—"}
              </DetailRow>
              <DetailRow label="สร้างเมื่อ">
                {formatThaiDateTime(payout.createdAt)}
              </DetailRow>
            </CardContent>
          </Card>

          {payout.note ? (
            <Card size="sm">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Coins className="size-4 text-primary" aria-hidden />
                  <CardTitle>หมายเหตุ</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="whitespace-pre-wrap text-xs leading-5 text-muted-foreground">
                {payout.note}
              </CardContent>
            </Card>
          ) : null}

          <div className="flex gap-2 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30 p-3 text-[11px] leading-5 text-emerald-900 dark:text-emerald-200">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>
              รอบจ่ายที่บันทึกแล้วไม่ถูกลบ หากบิลถูกยกเลิกภายหลัง
              ระบบจะสร้างรายการติดลบแยกและหักในรอบถัดไป
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
