import type { Metadata } from "next";
import Link from "next/link";
import type { BillStatus } from "@/generated/prisma/enums";
import {
  Clock3,
  FileClock,
  FilePlus2,
  Filter,
  ReceiptText,
  Search,
  ShieldCheck,
  WalletCards,
} from "lucide-react";

import { BillStatusBadge } from "@/components/bills/bill-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pagination } from "@/components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatThaiDate } from "@/lib/labels";
import { formatTHB } from "@/lib/money";
import { cn } from "@/lib/utils";
import { requireUser } from "@/server/auth/session";
import {
  getBillSummary,
  listBills,
  BILLS_PAGE_SIZE,
} from "@/server/services/bills";
import {
  listActiveBillTypes,
  listActiveTechnicians,
} from "@/server/services/billing-options";

export const instant = false;

export const metadata: Metadata = {
  title: "บิลและอนุมัติ",
};

const BILL_STATUSES: BillStatus[] = [
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "PAID",
  "VOIDED",
];

function parseStatus(value?: string): BillStatus | undefined {
  return BILL_STATUSES.includes(value as BillStatus)
    ? (value as BillStatus)
    : undefined;
}

export default async function BillsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    billTypeId?: string;
    technicianId?: string;
    page?: string;
  }>;
}) {
  const actor = await requireUser();
  const actorRef = { id: actor.id, role: actor.role };
  const query = await searchParams;
  const q = query.q?.trim().slice(0, 100) ?? "";
  const status = parseStatus(query.status);
  const billTypeId = query.billTypeId?.trim() || undefined;
  const technicianId =
    actor.role === "ADMIN" ? query.technicianId?.trim() || undefined : undefined;
  const hasFilters = Boolean(q || status || billTypeId || technicianId);
  const page = Math.max(1, parseInt(query.page ?? "1", 10) || 1);

  const [billResult, summary, billTypes, technicians] = await Promise.all([
    listBills(actorRef, { q, status, billTypeId, technicianId, page, pageSize: BILLS_PAGE_SIZE }),
    getBillSummary(actorRef),
    listActiveBillTypes(),
    actor.role === "ADMIN"
      ? listActiveTechnicians()
      : Promise.resolve([]),
  ]);

  const bills = billResult.items;
  const isAdmin = actor.role === "ADMIN";
  const preserveParams: Record<string, string | undefined> = {
    ...(q ? { q } : {}),
    ...(status ? { status } : {}),
    ...(billTypeId ? { billTypeId } : {}),
    ...(technicianId ? { technicianId } : {}),
  };
  const stats = [
    {
      label: "ร่าง",
      value: summary.draftCount,
      icon: FileClock,
      tone: "text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/60",
      statusKey: "DRAFT",
    },
    {
      label: "รออนุมัติ",
      value: summary.pendingCount,
      icon: Clock3,
      tone: "text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30",
      statusKey: "PENDING_APPROVAL",
    },
    {
      label: "อนุมัติแล้ว",
      value: summary.approvedCount,
      icon: ShieldCheck,
      tone: "text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/30",
      statusKey: "APPROVED",
    },
    {
      label: "ชำระแล้ว",
      value: summary.paidCount,
      icon: WalletCards,
      tone: "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30",
      statusKey: "PAID",
    },
    {
      label: "ยกเลิก",
      value: summary.voidedCount,
      icon: ReceiptText,
      tone: "text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/30",
      statusKey: "VOIDED",
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              {isAdmin ? "บิลและอนุมัติ" : "บิลของฉัน"}
            </h1>
            <Badge variant="outline">
              {billResult.totalCount.toLocaleString("th-TH")} รายการ
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {isAdmin
              ? "ตรวจบิล ขาย ซ่อม บริการ และเคลม พร้อมอนุมัติ/ตัดสต๊อกในที่เดียว"
              : "สร้างบิลของตนเอง ส่งขออนุมัติ และติดตามสถานะ"}
          </p>
        </div>
        <Link
          href="/bills/new"
          className={cn(buttonVariants(), "h-9")}
        >
          <FilePlus2 aria-hidden />
          เปิดบิลใหม่
        </Link>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {stats.map((stat) => {
          const Icon = stat.icon;
          const isActive = status === stat.statusKey;
          const filterHref = isActive ? "/bills" : `/bills?status=${stat.statusKey}`;
          return (
            <Link key={stat.label} href={filterHref} className="group block">
              <Card
                size="sm"
                className={cn(
                  "transition-all duration-150 hover:shadow-xs",
                  isActive
                    ? "ring-2 ring-primary bg-primary/5"
                    : "group-hover:ring-primary/40",
                )}
              >
                <CardContent className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      {stat.label}
                    </p>
                    <p className="mt-1.5 text-2xl font-semibold tracking-tight tabular-nums">
                      {stat.value.toLocaleString("th-TH")}
                    </p>
                  </div>
                  <div
                    className={cn(
                      "hidden size-9 shrink-0 items-center justify-center rounded-lg sm:flex",
                      stat.tone,
                    )}
                  >
                    <Icon className="size-4" aria-hidden />
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </section>

      {isAdmin && summary.pendingCount > 0 ? (
        <div className="flex flex-col justify-between gap-2 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-900 dark:text-amber-200 sm:flex-row sm:items-center">
          <span className="flex items-center gap-2">
            <Clock3 className="size-4 shrink-0" aria-hidden />
            มีบิลรออนุมัติ {summary.pendingCount.toLocaleString("th-TH")} ใบ
            มูลค่ารวม {formatTHB(summary.pendingAmount)}
          </span>
          <Link
            href="/bills?status=PENDING_APPROVAL"
            className="text-xs font-semibold underline-offset-4 hover:underline"
          >
            ดูคิวรออนุมัติ
          </Link>
        </div>
      ) : null}

      <Card>
        <CardHeader className="border-b">
          <div className="flex items-center gap-2">
            <Filter className="size-4 text-primary" aria-hidden />
            <div>
              <CardTitle>ค้นหาและกรอง</CardTitle>
              <CardDescription>
                ค้นหาเลขที่บิล ชื่อลูกค้า เบอร์โทร หรือชื่องาน
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form
            action="/bills"
            method="get"
            className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.5fr)_180px_180px_180px_auto]"
          >
            <div className="space-y-1.5">
              <Label htmlFor="q">คำค้น</Label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  id="q"
                  name="q"
                  defaultValue={q}
                  className="h-10 bg-background pl-9"
                  placeholder="เลขที่บิล / ชื่อลูกค้า / เบอร์โทร"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="status">สถานะ</Label>
              <select
                id="status"
                name="status"
                defaultValue={status ?? ""}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="">ทุกสถานะ</option>
                {BILL_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {value === "PENDING_APPROVAL"
                      ? "รออนุมัติ"
                      : value === "DRAFT"
                        ? "ร่าง"
                        : value === "APPROVED"
                          ? "อนุมัติแล้ว"
                          : value === "REJECTED"
                            ? "ไม่อนุมัติ"
                            : value === "PAID"
                              ? "ชำระแล้ว"
                              : "ยกเลิก"}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="billTypeId">ประเภทบิล</Label>
              <select
                id="billTypeId"
                name="billTypeId"
                defaultValue={billTypeId ?? ""}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="">ทุกประเภท</option>
                {billTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
            </div>
            {isAdmin ? (
              <div className="space-y-1.5">
                <Label htmlFor="technicianId">ช่างผู้รับผิดชอบ</Label>
                <select
                  id="technicianId"
                  name="technicianId"
                  defaultValue={technicianId ?? ""}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <option value="">ทุกคน</option>
                  {technicians.map((technician) => (
                    <option key={technician.id} value={technician.id}>
                      {technician.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <input type="hidden" name="mine" value="1" />
            )}
            <div className="flex items-end gap-2">
              <Button type="submit" className="h-10">
                <Search aria-hidden />
                ค้นหา
              </Button>
              {hasFilters ? (
                <Link
                  href="/bills"
                  className={cn(buttonVariants({ variant: "ghost" }), "h-10")}
                >
                  ล้างตัวกรอง
                </Link>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>รายการบิล</CardTitle>
              <CardDescription>
                แสดงล่าสุดไม่เกิน 200 รายการ เรียงจากใหม่ไปเก่า
              </CardDescription>
            </div>
            {status ? (
              <Badge variant="secondary">
                ตัวกรอง: {status === "PENDING_APPROVAL" ? "รออนุมัติ" : status}
              </Badge>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="px-0">
          {bills.length === 0 ? (
            <div className="px-4 py-16 text-center">
              <ReceiptText
                className="mx-auto mb-2 size-7 text-muted-foreground/60"
                aria-hidden
              />
              <p className="text-sm font-medium">
                {hasFilters ? "ไม่พบบิลตามเงื่อนไข" : "ยังไม่มีบิลในระบบ"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {hasFilters
                  ? "ลองเปลี่ยนคำค้นหรือล้างตัวกรอง"
                  : "เริ่มเปิดบิลแรกเพื่อทดสอบ workflow อนุมัติ"}
              </p>
              {!hasFilters ? (
                <Link
                  href="/bills/new"
                  className={cn(buttonVariants(), "mt-4 h-9")}
                >
                  <FilePlus2 aria-hidden />
                  เปิดบิลใหม่
                </Link>
              ) : null}
            </div>
          ) : (
            <>
              <ul className="divide-y lg:hidden">
                {bills.map((bill) => (
                  <li key={bill.id} className="px-4 py-5">
                    <div className="flex items-start justify-between gap-3">
                      <Link
                        href={`/bills/${bill.id}`}
                        className="font-mono text-xs font-semibold text-primary hover:underline"
                      >
                        {bill.billNumber}
                      </Link>
                      <BillStatusBadge status={bill.status} />
                    </div>
                    <p className="mt-2 text-sm font-medium">
                      {bill.customer.name}
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <span className="truncate text-xs text-muted-foreground">
                        {formatThaiDate(
                          bill.paidAt ??
                            bill.approvedAt ??
                            bill.submittedAt ??
                            bill.createdAt,
                        )}
                      </span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums">
                        {formatTHB(bill.grandTotal.toString())}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="hidden overflow-x-auto lg:block">
                <Table className="min-w-200">
                  <TableHeader>
                    <TableRow>
                      <TableHead>เลขที่บิล</TableHead>
                      <TableHead>ลูกค้า / งาน</TableHead>
                      <TableHead>ประเภท</TableHead>
                      {isAdmin ? <TableHead>ช่าง</TableHead> : null}
                      <TableHead>วันที่</TableHead>
                      <TableHead className="text-right">ยอดรวม</TableHead>
                      <TableHead>สถานะ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bills.map((bill) => (
                      <TableRow key={bill.id}>
                        <TableCell className="align-top">
                          <Link
                            href={`/bills/${bill.id}`}
                            className="font-mono text-xs font-semibold text-primary hover:underline"
                          >
                            {bill.billNumber}
                          </Link>
                        </TableCell>
                        <TableCell className="align-top">
                          <p className="font-medium">{bill.customer.name}</p>
                          <p className="mt-0.5 max-w-70 truncate text-[11px] text-muted-foreground">
                            {bill.title}
                          </p>
                        </TableCell>
                        <TableCell className="align-top text-xs">
                          {bill.billType.name}
                        </TableCell>
                        {isAdmin ? (
                          <TableCell className="align-top text-xs">
                            {bill.technician.name}
                          </TableCell>
                        ) : null}
                        <TableCell className="align-top text-xs">
                          {formatThaiDate(
                            bill.paidAt ??
                              bill.approvedAt ??
                              bill.submittedAt ??
                              bill.createdAt,
                          )}
                        </TableCell>
                        <TableCell className="text-right align-top font-medium tabular-nums">
                          {formatTHB(bill.grandTotal.toString())}
                        </TableCell>
                        <TableCell className="align-top">
                          <BillStatusBadge status={bill.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Pagination
                page={billResult.page}
                pageSize={billResult.pageSize}
                totalCount={billResult.totalCount}
                basePath="/bills"
                preserveParams={preserveParams}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
