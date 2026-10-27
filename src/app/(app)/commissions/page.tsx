import type { Metadata } from "next";
import Link from "next/link";
import type {
  CommissionEntryKind,
  CommissionEntryStatus,
} from "@/generated/prisma/enums";
import {
  ArrowRight,
  Calculator,
  Coins,
  Download,
  FileSpreadsheet,
  Filter,
  HandCoins,
  RotateCcw,
  Settings2,
  WalletCards,
} from "lucide-react";

import {
  CommissionEntryKindBadge,
  CommissionEntryStatusBadge,
  CommissionPayoutStatusBadge,
} from "@/components/commissions/commission-status-badges";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  parseBangkokCommissionDate,
} from "@/lib/commission-labels";
import { formatThaiDate, formatThaiDateTime } from "@/lib/labels";
import { formatTHB } from "@/lib/money";
import { selectClassName } from "@/lib/form-styles";
import { cn } from "@/lib/utils";
import { requireUser } from "@/server/auth/session";
import {
  getCommissionSummary,
  listCommissionEntries,
  listCommissionPayouts,
  listCommissionTechnicians,
  type CommissionEntryFilters,
} from "@/server/services/commissions";

export const instant = false;

export const metadata: Metadata = {
  title: "ค่าคอมมิชชั่น",
};

const ENTRY_STATUSES: CommissionEntryStatus[] = [
  "PENDING",
  "PAID",
  "REVERSED",
];
const ENTRY_KINDS: CommissionEntryKind[] = ["EARNING", "REVERSAL"];

function parseEntryStatus(value?: string) {
  return ENTRY_STATUSES.includes(value as CommissionEntryStatus)
    ? (value as CommissionEntryStatus)
    : undefined;
}

function parseEntryKind(value?: string) {
  return ENTRY_KINDS.includes(value as CommissionEntryKind)
    ? (value as CommissionEntryKind)
    : undefined;
}

export default async function CommissionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    technicianId?: string;
    status?: string;
    kind?: string;
    billId?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const actor = await requireUser();
  const actorRef = { id: actor.id, role: actor.role };
  const query = await searchParams;
  const isAdmin = actor.role === "ADMIN";
  const technicianId = isAdmin
    ? query.technicianId?.trim() || undefined
    : undefined;
  const status = parseEntryStatus(query.status);
  const kind = parseEntryKind(query.kind);
  const billId = query.billId?.trim().slice(0, 64) || undefined;
  const from = query.from
    ? (parseBangkokCommissionDate(query.from) ?? undefined)
    : undefined;
  const to = query.to
    ? (parseBangkokCommissionDate(query.to, true) ?? undefined)
    : undefined;
  const filters: CommissionEntryFilters = {
    technicianId,
    status,
    kind,
    billId,
    from,
    to,
  };
  const hasFilters = Boolean(
    technicianId || status || kind || billId || from || to,
  );
  const exportParams = new URLSearchParams();

  for (const [key, value] of Object.entries({
    technicianId,
    status,
    kind,
    billId,
    from: query.from,
    to: query.to,
  })) {
    if (value) {
      exportParams.set(key, value);
    }
  }

  const exportHref = `/api/commissions/export${
    exportParams.size > 0 ? `?${exportParams.toString()}` : ""
  }`;
  const [summary, entries, payouts, technicians] = await Promise.all([
    getCommissionSummary(actorRef),
    listCommissionEntries(actorRef, filters),
    listCommissionPayouts(actorRef),
    isAdmin
      ? listCommissionTechnicians(actorRef)
      : Promise.resolve([]),
  ]);
  const recentPayouts = payouts.slice(0, 6);
  const stats = [
    {
      label: "ยอดรอจ่ายสุทธิ",
      value: formatTHB(summary.pendingNet),
      detail: `${summary.pendingCount.toLocaleString("th-TH")} รายการ`,
      icon: Coins,
      tone: Number(summary.pendingNet) < 0 ? "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300" : "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300",
    },
    {
      label: "จ่ายแล้วเดือนนี้",
      value: formatTHB(summary.paidThisMonth),
      detail: "นับตามวันที่บันทึกจ่าย",
      icon: WalletCards,
      tone: "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300",
    },
    {
      label: "จ่ายสะสม",
      value: formatTHB(summary.paidTotal),
      detail: `${summary.payoutCount.toLocaleString("th-TH")} รอบจ่าย`,
      icon: HandCoins,
      tone: "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300",
    },
    {
      label: "ยอดถูกกลับรายการ",
      value: formatTHB(summary.reversedAmount),
      detail: `${summary.reversedCount.toLocaleString("th-TH")} รายการ`,
      icon: RotateCcw,
      tone: "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300",
    },
    ...(isAdmin
      ? [
          {
            label: "กติกาที่เปิดใช้",
            value: summary.activeRuleCount.toLocaleString("th-TH"),
            detail: "ใช้เลือกตอนอนุมัติบิล",
            icon: Calculator,
            tone: "bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300",
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              {isAdmin ? "ค่าคอมมิชชั่น" : "ค่าคอมของฉัน"}
            </h1>
            <Badge variant="outline">
              {entries.length.toLocaleString("th-TH")} รายการล่าสุด
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {isAdmin
              ? "ติดตามยอด earning และ reversal จากบิลที่อนุมัติ/ยกเลิก พร้อมปิดรอบจ่ายรายช่าง"
              : "ติดตามค่าคอมมิชชั่นที่ได้รับและประวัติรอบจ่ายของตนเอง"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin ? (
            <>
              <Link
                href="/commissions/rules"
                className={cn(buttonVariants({ variant: "outline" }), "h-9")}
              >
                <Settings2 aria-hidden />
                กติกา
              </Link>
              <Link
                href="/commissions/payouts"
                className={cn(buttonVariants({ variant: "outline" }), "h-9")}
              >
                <HandCoins aria-hidden />
                รอบจ่าย
              </Link>
              <Link
                href={exportHref}
                className={cn(buttonVariants(), "h-9")}
              >
                <Download aria-hidden />
                ส่งออก CSV
              </Link>
            </>
          ) : null}
        </div>
      </div>

      {isAdmin && summary.activeRuleCount === 0 ? (
        <div className="flex flex-col gap-2 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-900 dark:text-amber-200 sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-2">
            <Calculator className="size-4 shrink-0" aria-hidden />
            ยังไม่มีกติกาคอมมิชชั่นที่เปิดใช้งาน บิลที่อนุมัติจะยังไม่เกิดค่าคอม
          </span>
          <Link
            href="/commissions/rules/new"
            className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800 dark:text-amber-200 hover:underline"
          >
            สร้างกติกาแรก
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      ) : null}

      <section
        className={cn(
          "grid grid-cols-2 gap-3",
          isAdmin ? "lg:grid-cols-5" : "lg:grid-cols-4",
        )}
      >
        {stats.map((stat) => {
          const Icon = stat.icon;

          return (
            <Card key={stat.label} size="sm">
              <CardContent className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">
                    {stat.label}
                  </p>
                  <p className="mt-1.5 truncate text-xl font-semibold tracking-tight tabular-nums">
                    {stat.value}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {stat.detail}
                  </p>
                </div>
                <span
                  className={cn(
                    "hidden size-9 shrink-0 items-center justify-center rounded-lg sm:flex",
                    stat.tone,
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                </span>
              </CardContent>
            </Card>
          );
        })}
      </section>

      {billId ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-muted/30 px-4 py-2.5 text-xs">
          <span className="text-muted-foreground">
            กำลังแสดงเฉพาะรายการของบิลที่เลือก
          </span>
          <Link href="/commissions" className="font-medium text-primary hover:underline">
            ล้างตัวกรองบิล
          </Link>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex items-start gap-2">
            <Filter className="mt-0.5 size-4 text-primary" aria-hidden />
            <div className="flex-1">
              <CardTitle>กรองรายการ</CardTitle>
              <CardDescription>
                {isAdmin
                  ? "กรองตามช่าง สถานะ ประเภท และช่วงวันที่สร้างรายการ"
                  : "กรองรายการค่าคอมของตนเองตามสถานะและช่วงวันที่"}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            {isAdmin ? (
              <div className="space-y-1.5">
                <Label htmlFor="technicianId" className="text-xs">
                  ช่างเทคนิค
                </Label>
                <select
                  id="technicianId"
                  name="technicianId"
                  defaultValue={technicianId ?? ""}
                  className={selectClassName}
                >
                  <option value="">ทุกช่าง</option>
                  {technicians.map((technician) => (
                    <option key={technician.id} value={technician.id}>
                      {technician.name}
                      {technician.isActive ? "" : " (ปิดใช้งาน)"}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor="status" className="text-xs">
                สถานะรายการ
              </Label>
              <select
                id="status"
                name="status"
                defaultValue={status ?? ""}
                className={selectClassName}
              >
                <option value="">ทุกสถานะ</option>
                <option value="PENDING">รอจ่าย</option>
                <option value="PAID">จ่ายแล้ว</option>
                <option value="REVERSED">ถูกกลับรายการ</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="kind" className="text-xs">
                ประเภทรายการ
              </Label>
              <select
                id="kind"
                name="kind"
                defaultValue={kind ?? ""}
                className={selectClassName}
              >
                <option value="">ทั้งหมด</option>
                <option value="EARNING">ค่าคอมมิชชั่น</option>
                <option value="REVERSAL">กลับรายการ</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="from" className="text-xs">
                จากวันที่
              </Label>
              <Input
                id="from"
                name="from"
                type="date"
                defaultValue={query.from ?? ""}
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="to" className="text-xs">
                ถึงวันที่
              </Label>
              <Input
                id="to"
                name="to"
                type="date"
                defaultValue={query.to ?? ""}
                className="h-10"
              />
            </div>
            {billId ? <input type="hidden" name="billId" value={billId} /> : null}
            <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-1">
              <button type="submit" className={cn(buttonVariants(), "h-10 flex-1")}>
                <Filter aria-hidden />
                กรอง
              </button>
              <Link
                href="/commissions"
                className={cn(buttonVariants({ variant: "outline" }), "h-10")}
              >
                ล้าง
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div>
              <CardTitle>รายการค่าคอมมิชชั่น</CardTitle>
              <CardDescription>
                {hasFilters
                  ? "ผลลัพธ์ตามตัวกรองที่เลือก"
                  : "รายการล่าสุดสูงสุด 500 รายการ"}
              </CardDescription>
            </div>
            {isAdmin ? (
              <Link
                href={exportHref}
                className={cn(buttonVariants({ variant: "outline" }), "h-8")}
              >
                <FileSpreadsheet aria-hidden />
                CSV
              </Link>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {entries.length === 0 ? (
            <div className="py-12 text-center">
              <Coins className="mx-auto size-9 text-muted-foreground/50" aria-hidden />
              <p className="mt-3 text-sm font-medium">ไม่พบรายการค่าคอมมิชชั่น</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {isAdmin
                  ? "ตรวจสอบกติกาที่เปิดใช้ หรืออนุมัติบิลเพื่อสร้างรายการใหม่"
                  : "เมื่อ Admin อนุมัติบิลของคุณ รายการค่าคอมจะแสดงที่นี่"}
              </p>
              {isAdmin ? (
                <Link
                  href="/commissions/rules/new"
                  className={cn(buttonVariants({ variant: "outline" }), "mt-4 h-8")}
                >
                  <Settings2 aria-hidden />
                  ตั้งค่ากติกา
                </Link>
              ) : null}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[900px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>วันที่</TableHead>
                    <TableHead>บิล</TableHead>
                    <TableHead>กติกา / ฐาน</TableHead>
                    <TableHead className="text-right">ฐาน / ต้นทุน</TableHead>
                    <TableHead className="text-right">จำนวน</TableHead>
                    <TableHead>สถานะ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="align-top text-xs text-muted-foreground">
                        {formatThaiDateTime(entry.earnedAt)}
                        {entry.reversedAt ? (
                          <span className="mt-1 block text-rose-600 dark:text-rose-300">
                            กลับเมื่อ {formatThaiDateTime(entry.reversedAt)}
                          </span>
                        ) : null}
                      </TableCell>
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
                        {isAdmin ? (
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {entry.technician.name}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex flex-wrap items-center gap-1">
                          <CommissionEntryKindBadge kind={entry.kind} />
                          <span className="text-xs font-medium">{entry.ruleName}</span>
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
                        className={cn(
                          "align-top text-right font-semibold tabular-nums",
                          entry.commissionAmount.isNegative()
                            ? "text-rose-700 dark:text-rose-300"
                            : "text-emerald-700 dark:text-emerald-300",
                        )}
                      >
                        {formatTHB(entry.commissionAmount.toString())}
                      </TableCell>
                      <TableCell className="align-top">
                        <CommissionEntryStatusBadge status={entry.status} />
                        {entry.payoutItem ? (
                          <Link
                            href={`/commissions/payouts/${entry.payoutItem.payoutId}`}
                            className="mt-1 block font-mono text-[10px] text-primary hover:underline"
                          >
                            {entry.payoutItem.payout.payoutNo}
                          </Link>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle>รอบจ่ายล่าสุด</CardTitle>
              <CardDescription>
                {isAdmin
                  ? "ประวัติการปิดรอบจ่ายค่าคอมมิชชั่นรายช่าง"
                  : "รอบที่จ่ายให้คุณแล้ว"}
              </CardDescription>
            </div>
            {isAdmin ? (
              <Link
                href="/commissions/payouts"
                className={cn(buttonVariants({ variant: "outline" }), "h-8")}
              >
                ดูทั้งหมด
                <ArrowRight aria-hidden />
              </Link>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {recentPayouts.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              ยังไม่มีรอบจ่ายค่าคอมมิชชั่น
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[720px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>เลขที่รอบจ่าย</TableHead>
                    {isAdmin ? <TableHead>ช่าง</TableHead> : null}
                    <TableHead>ช่วงรอบ</TableHead>
                    <TableHead className="text-right">ยอดจ่าย</TableHead>
                    <TableHead>สถานะ</TableHead>
                    <TableHead>วันที่จ่าย</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentPayouts.map((payout) => (
                    <TableRow key={payout.id}>
                      <TableCell>
                        <Link
                          href={`/commissions/payouts/${payout.id}`}
                          className="font-mono text-xs font-semibold text-primary hover:underline"
                        >
                          {payout.payoutNo}
                        </Link>
                      </TableCell>
                      {isAdmin ? (
                        <TableCell className="text-xs">
                          {payout.technician.name}
                        </TableCell>
                      ) : null}
                      <TableCell className="text-xs text-muted-foreground">
                        {formatThaiDate(payout.periodStart)} –{" "}
                        {formatThaiDate(payout.periodEnd)}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {formatTHB(payout.totalAmount.toString())}
                      </TableCell>
                      <TableCell>
                        <CommissionPayoutStatusBadge status={payout.status} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatThaiDateTime(payout.paidAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
