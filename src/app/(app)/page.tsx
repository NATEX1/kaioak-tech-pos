import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  BarChart3,
  CircleAlert,
  Clock3,
  Coins,
  Contact,
  FilePlus2,
  PackageSearch,
  ReceiptText,
  ShieldCheck,
  Store,
  TrendingUp,
  UsersRound,
  WalletCards,
  Wrench,
} from "lucide-react";

import { BillStatusBadge } from "@/components/bills/bill-status-badge";
import { RoleBadge } from "@/components/users/user-badges";
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
  addDays,
  bangkokDayKey,
  recentBangkokDays,
  startOfBangkokDay,
  startOfBangkokMonth,
} from "@/lib/bangkok-periods";
import { formatThaiDate, formatThaiDateTime, roleLabel } from "@/lib/labels";
import { Decimal, formatTHB } from "@/lib/money";
import { cn } from "@/lib/utils";
import { prisma } from "@/lib/db";
import { requireUser } from "@/server/auth/session";
import { getBillSummary } from "@/server/services/bills";

export const instant = false;

export const metadata: Metadata = {
  title: "ภาพรวม",
};

export default async function DashboardPage() {
  const user = await requireUser();
  const now = new Date();
  const todayStart = startOfBangkokDay(now);
  const monthStart = startOfBangkokMonth(now);
  const sevenDayStart = addDays(todayStart, -6);
  const paidSince =
    monthStart.getTime() < sevenDayStart.getTime() ? monthStart : sevenDayStart;
  const todayKey = bangkokDayKey(now);
  const actorRef = { id: user.id, role: user.role };
  const isAdmin = user.role === "ADMIN";
  const billScope = isAdmin ? {} : { technicianId: user.id };
  const commissionScope = isAdmin
    ? {}
    : { technicianId: user.id };

  const [
    paidBills,
    paidBillsWithCost,
    approvedUnpaid,
    commissionAggregate,
    lowStockCountRows,
    lowStockRows,
    billSummary,
    recentBills,
    activeCustomerCount,
    activeRepairCount,
  ] = await Promise.all([
    prisma.bill.findMany({
      where: {
        ...billScope,
        status: "PAID",
        paidAt: { gte: paidSince },
      },
      orderBy: { paidAt: "desc" },
      select: {
        id: true,
        grandTotal: true,
        paidAt: true,
      },
    }),
    // Admin only: เพื่อคำนวณ gross profit เดือนนี้
    isAdmin
      ? prisma.bill.findMany({
          where: {
            status: "PAID",
            paidAt: { gte: monthStart },
          },
          select: {
            grandTotal: true,
            vatAmount: true,
            items: {
              select: { unitCost: true, quantity: true },
            },
          },
        })
      : Promise.resolve([] as Array<{
          grandTotal: { toString(): string };
          vatAmount: { toString(): string };
          items: Array<{ unitCost: { toString(): string }; quantity: number }>;
        }>),
    prisma.bill.aggregate({
      where: { ...billScope, status: "APPROVED" },
      _sum: { grandTotal: true },
      _count: { _all: true },
    }),
    prisma.commissionEntry.aggregate({
      where: { ...commissionScope, status: "PENDING" },
      _sum: { commissionAmount: true },
      _count: { _all: true },
    }),
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM "Product"
      WHERE "isActive" = true
        AND "deletedAt" IS NULL
        AND "stockQty" <= "reorderLevel"
    `,
    prisma.$queryRaw<
      Array<{
        id: string;
        sku: string;
        name: string;
        stockQty: number;
        reorderLevel: number;
      }>
    >`
      SELECT id, sku, name, "stockQty", "reorderLevel"
      FROM "Product"
      WHERE "isActive" = true
        AND "deletedAt" IS NULL
        AND "stockQty" <= "reorderLevel"
      ORDER BY ("stockQty" - "reorderLevel") ASC, name ASC
      LIMIT 5
    `,
    getBillSummary(actorRef),
    prisma.bill.findMany({
      where: billScope,
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        billNumber: true,
        title: true,
        status: true,
        grandTotal: true,
        createdAt: true,
        billType: { select: { name: true } },
        customer: { select: { name: true } },
        technician: { select: { name: true } },
      },
    }),
    prisma.customer.count({ where: { isActive: true, deletedAt: null } }),
    // งานซ่อมที่ยังไม่ส่งมอบ (สำหรับทั้ง Admin และ Technician)
    prisma.billRepairDetail.count({
      where: {
        repairStatus: { notIn: ["DELIVERED"] },
        bill: {
          ...billScope,
          status: { in: ["DRAFT", "PENDING_APPROVAL", "APPROVED", "PAID"] },
        },
      },
    }),
  ]);

  const last7Days = recentBangkokDays(7, now);
  const dayTotals = new Map(
    last7Days.map((day) => [day.key, new Decimal(0)]),
  );
  let monthRevenue = new Decimal(0);
  let monthBillCount = 0;
  let todayRevenue = new Decimal(0);
  let todayBillCount = 0;

  for (const bill of paidBills) {
    if (!bill.paidAt) {
      continue;
    }

    const amount = new Decimal(bill.grandTotal.toString());
    const dayKey = bangkokDayKey(bill.paidAt);

    if (bill.paidAt.getTime() >= monthStart.getTime()) {
      monthRevenue = monthRevenue.plus(amount);
      monthBillCount += 1;
    }

    if (dayKey === todayKey) {
      todayRevenue = todayRevenue.plus(amount);
      todayBillCount += 1;
    }

    if (dayTotals.has(dayKey)) {
      dayTotals.set(dayKey, dayTotals.get(dayKey)!.plus(amount));
    }
  }

  const sevenDayRevenue = last7Days.reduce(
    (sum, day) => sum.plus(dayTotals.get(day.key) ?? 0),
    new Decimal(0),
  );
  const maxDayAmount = last7Days.reduce(
    (max, day) =>
      (dayTotals.get(day.key) ?? new Decimal(0)).greaterThan(max)
        ? dayTotals.get(day.key) ?? new Decimal(0)
        : max,
    new Decimal(0),
  );
  const lowStockCount = Number(lowStockCountRows[0]?.count ?? 0);
  const approvedUnpaidAmount = approvedUnpaid._sum.grandTotal ?? new Decimal(0);
  const approvedUnpaidCount = approvedUnpaid._count._all;
  const pendingCommission =
    commissionAggregate._sum.commissionAmount ?? new Decimal(0);
  const pendingCommissionCount = commissionAggregate._count._all;

  // คำนวณกำไรขั้นต้นเดือนนี้ (Admin only)
  let monthGrossProfit = new Decimal(0);
  if (isAdmin) {
    for (const bill of paidBillsWithCost) {
      const revenue = new Decimal(bill.grandTotal.toString()).minus(
        new Decimal(bill.vatAmount.toString()),
      );
      const cost = bill.items.reduce(
        (sum, item) =>
          sum.plus(
            new Decimal(item.unitCost.toString()).times(item.quantity),
          ),
        new Decimal(0),
      );
      monthGrossProfit = monthGrossProfit.plus(revenue.minus(cost));
    }
  }

  const adminStats = isAdmin
    ? [
        {
          label: "กำไรขั้นต้นเดือนนี้",
          value: formatTHB(monthGrossProfit),
          detail: `จากยอดขาย ${formatTHB(monthRevenue)}`,
          icon: BarChart3,
          tone: monthGrossProfit.isNegative()
            ? "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300"
            : "bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-300",
          href: "/reports",
        },
      ]
    : [];

  const stats = [
    {
      label: isAdmin ? "ยอดขายวันนี้" : "ยอดขายของฉันวันนี้",
      value: formatTHB(todayRevenue),
      detail: `${todayBillCount.toLocaleString("th-TH")} ใบที่ชำระแล้ว`,
      icon: Banknote,
      tone: "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300",
      href: "/bills?status=PAID",
    },
    {
      label: isAdmin ? "ยอดขายเดือนนี้" : "ยอดขายของฉันเดือนนี้",
      value: formatTHB(monthRevenue),
      detail: `${monthBillCount.toLocaleString("th-TH")} ใบที่ชำระแล้ว`,
      icon: TrendingUp,
      tone: "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300",
      href: isAdmin ? "/reports" : "/bills?status=PAID",
    },
    ...adminStats,
    {
      label: "บิลรออนุมัติ",
      value: billSummary.pendingCount.toLocaleString("th-TH"),
      detail: `มูลค่า ${formatTHB(billSummary.pendingAmount)}`,
      icon: Clock3,
      tone: "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300",
      href: "/bills?status=PENDING_APPROVAL",
    },
    {
      label: "รอชำระเงิน",
      value: approvedUnpaidCount.toLocaleString("th-TH"),
      detail: `มูลค่า ${formatTHB(approvedUnpaidAmount)}`,
      icon: WalletCards,
      tone: "bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300",
      href: "/bills?status=APPROVED",
    },
    {
      label: "คอมมิชชั่นรอจ่าย",
      value: formatTHB(pendingCommission),
      detail: `${pendingCommissionCount.toLocaleString("th-TH")} รายการ`,
      icon: Coins,
      tone: pendingCommission.isNegative()
        ? "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300"
        : "bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300",
      href: "/commissions",
    },
    {
      label: "สินค้าใกล้หมด",
      value: lowStockCount.toLocaleString("th-TH"),
      detail: "ต่ำกว่าหรือเท่ากับจุดสั่งซื้อ",
      icon: CircleAlert,
      tone: "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300",
      href: "/inventory/low-stock",
    },
    {
      label: "งานซ่อมค้างอยู่",
      value: activeRepairCount.toLocaleString("th-TH"),
      detail: "ยังไม่ส่งมอบลูกค้า",
      icon: Wrench,
      tone: activeRepairCount > 0
        ? "bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300"
        : "bg-muted text-muted-foreground",
      href: "/bills?billTypeCode=REPAIR",
    },
  ];

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="bg-background">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              ข้อมูลสด · {formatThaiDate(now)}
            </Badge>
            <RoleBadge role={user.role} />
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
            ภาพรวมร้าน
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            สวัสดี {user.name} · {roleLabel(user.role)} · ลูกค้าในระบบ{" "}
            {activeCustomerCount.toLocaleString("th-TH")} ราย
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href="/bills/new" className={cn(buttonVariants(), "h-9")}>
            <FilePlus2 aria-hidden />
            เปิดบิลใหม่
          </Link>
          <Link
            href="/bills"
            className={cn(buttonVariants({ variant: "outline" }), "h-9")}
          >
            <ReceiptText aria-hidden />
            บิลและใบเสร็จ
          </Link>
          <Link
            href="/commissions"
            className={cn(buttonVariants({ variant: "outline" }), "h-9")}
          >
            <Coins aria-hidden />
            ค่าคอมมิชชั่น
          </Link>
          {isAdmin ? (
            <Link
              href="/settings/shop"
              className={cn(buttonVariants({ variant: "outline" }), "h-9")}
            >
              <Store aria-hidden />
              ข้อมูลร้าน
            </Link>
          ) : null}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          const inner = (
            <CardContent className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">
                  {stat.label}
                </p>
                <p className="mt-2 text-lg font-semibold tracking-tight tabular-nums xl:text-xl">
                  {stat.value}
                </p>
                <p className="mt-1 text-xs leading-4 text-muted-foreground">
                  {stat.detail}
                </p>
              </div>
              <div
                className={cn(
                  "hidden size-9 shrink-0 items-center justify-center rounded-xl sm:flex",
                  stat.tone,
                )}
              >
                <Icon className="size-4" aria-hidden />
              </div>
            </CardContent>
          );
          return stat.href ? (
            <Link key={stat.label} href={stat.href} className="group block">
              <Card className="transition-all duration-150 group-hover:ring-primary/40 group-hover:shadow-xs">
                {inner}
              </Card>
            </Link>
          ) : (
            <Card key={stat.label}>{inner}</Card>
          );
        })}
      </section>

      <div className="space-y-2">
        {billSummary.pendingCount > 0 ? (
          <div className="flex flex-col gap-2 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-900 dark:text-amber-200 sm:flex-row sm:items-center sm:justify-between">
            <span className="flex items-center gap-2">
              <Clock3 className="size-4 shrink-0" aria-hidden />
              มีบิลรออนุมัติ {billSummary.pendingCount.toLocaleString("th-TH")}{" "}
              ใบ · {formatTHB(billSummary.pendingAmount)}
            </span>
            <Link
              href="/bills?status=PENDING_APPROVAL"
              className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800 dark:text-amber-200 hover:underline"
            >
              {isAdmin ? "ไปตรวจคิวอนุมัติ" : "ดูสถานะบิลของฉัน"}
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </div>
        ) : null}

        {approvedUnpaidCount > 0 ? (
          <div className="flex flex-col gap-2 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50 dark:bg-blue-950/30 px-4 py-3 text-sm text-blue-900 dark:text-blue-200 sm:flex-row sm:items-center sm:justify-between">
            <span className="flex items-center gap-2">
              <WalletCards className="size-4 shrink-0" aria-hidden />
              มีบิลอนุมัติแล้วแต่ยังไม่ชำระ{" "}
              {approvedUnpaidCount.toLocaleString("th-TH")} ใบ ·{" "}
              {formatTHB(approvedUnpaidAmount)}
            </span>
            <Link
              href="/bills?status=APPROVED"
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-800 dark:text-blue-200 hover:underline"
            >
              ไปบันทึกการชำระเงิน
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </div>
        ) : null}

        {lowStockCount > 0 ? (
          <div className="flex flex-col gap-2 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-900 dark:text-amber-200 sm:flex-row sm:items-center sm:justify-between">
            <span className="flex items-center gap-2">
              <CircleAlert className="size-4 shrink-0" aria-hidden />
              มีสินค้า {lowStockCount.toLocaleString("th-TH")} รายการ
              ที่สต๊อกต่ำถึงจุดสั่งซื้อ
            </span>
            <Link
              href="/inventory/low-stock"
              className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800 dark:text-amber-200 hover:underline"
            >
              ดูรายการที่ต้องสั่งเพิ่ม
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </div>
        ) : null}
      </div>

      <section className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <TrendingUp className="size-4 text-primary" aria-hidden />
                  ยอดขายที่ชำระแล้ว 7 วันล่าสุด
                </CardTitle>
                <CardDescription>
                  รวม {formatTHB(sevenDayRevenue)} · สูงสุดต่อวัน{" "}
                  {formatTHB(maxDayAmount)}
                </CardDescription>
              </div>
              <Link
                href="/bills?status=PAID"
                className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary hover:underline"
              >
                ดูบิล
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex h-44 items-end gap-2 sm:gap-3">
              {last7Days.map((day) => {
                const amount = dayTotals.get(day.key) ?? new Decimal(0);
                const ratio = maxDayAmount.gt(0)
                  ? amount.dividedBy(maxDayAmount).times(100).toNumber()
                  : 0;
                const height = amount.gt(0) ? Math.max(5, ratio) : 0;
                const isToday = day.key === todayKey;

                return (
                  <div
                    key={day.key}
                    className="flex min-w-0 flex-1 flex-col items-center gap-1.5"
                    title={`${day.label}: ${formatTHB(amount)}`}
                  >
                    <div className="flex h-32 w-full items-end rounded-t-md bg-muted/35">
                      <div
                        className={cn(
                          "w-full rounded-t-md transition-all",
                          isToday ? "bg-primary" : "bg-primary/25",
                        )}
                        style={{ height: `${height}%` }}
                      />
                    </div>
                    <p
                      className={cn(
                        "text-[10px] leading-4",
                        isToday
                          ? "font-semibold text-primary"
                          : "text-muted-foreground",
                      )}
                    >
                      {day.weekday}
                    </p>
                    <p className="text-[9px] leading-3 text-muted-foreground">
                      {day.label}
                    </p>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">
              ตัวเลขบนกราฟคือยอดรวมบิลสถานะชำระแล้วตามเวลากรุงเทพฯ ·
              วางเมาส์เพื่อดูยอดของแต่ละวัน
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <PackageSearch className="size-4 text-primary" aria-hidden />
              สินค้าที่ควรสั่งเพิ่ม
            </CardTitle>
            <CardDescription>
              {lowStockCount > 0
                ? `แสดง ${Math.min(lowStockRows.length, 5)} จาก ${lowStockCount} รายการ`
                : "ยังไม่มีสินค้าต่ำกว่าจุดสั่งซื้อ"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {lowStockRows.length === 0 ? (
              <div className="rounded-xl border border-dashed bg-emerald-50/60 dark:bg-emerald-950/30 p-4 text-sm text-emerald-800 dark:text-emerald-200">
                สต๊อกทุกรายการยังอยู่เหนือจุดสั่งซื้อ
              </div>
            ) : (
              <div className="space-y-2">
                {lowStockRows.map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {product.name}
                      </p>
                      <p className="font-mono text-[10px] text-muted-foreground">
                        {product.sku}
                      </p>
                    </div>
                    <div className="shrink-0 text-right text-xs">
                      <p className="font-semibold text-rose-700 dark:text-rose-300 tabular-nums">
                        เหลือ {product.stockQty.toLocaleString("th-TH")}
                      </p>
                      <p className="text-muted-foreground tabular-nums">
                        จุดสั่ง {product.reorderLevel.toLocaleString("th-TH")}
                      </p>
                    </div>
                  </div>
                ))}
                <Link
                  href="/inventory/low-stock"
                  className="inline-flex items-center gap-1 pt-1 text-xs font-semibold text-primary hover:underline"
                >
                  ดูรายการทั้งหมด
                  <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">บิลล่าสุด</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {isAdmin
                  ? "รายการล่าสุดทั้งร้าน"
                  : "รายการล่าสุดที่คุณเป็นช่างผู้รับผิดชอบ"}
              </p>
            </div>
            <Link
              href="/bills"
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              ดูทั้งหมด
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </div>
          <Card>
            <CardContent className="px-0">
              {recentBills.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                  <ReceiptText
                    className="mx-auto mb-2 size-6 text-muted-foreground/60"
                    aria-hidden
                  />
                  ยังไม่มีบิล — เปิดบิลแรกเพื่อเริ่ม workflow
                  <div className="mt-3">
                    <Link
                      href="/bills/new"
                      className={cn(buttonVariants(), "h-9")}
                    >
                      <FilePlus2 aria-hidden />
                      เปิดบิลใหม่
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="divide-y">
                  {recentBills.map((bill) => (
                    <Link
                      key={bill.id}
                      href={`/bills/${bill.id}`}
                      className="grid gap-2 px-4 py-3 transition-colors hover:bg-muted/40 sm:grid-cols-[minmax(0,1fr)_140px_100px] sm:items-center"
                    >
                      <div className="min-w-0">
                        <p className="font-mono text-xs font-semibold text-primary">
                          {bill.billNumber}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {bill.billType.name} · {bill.title}
                        </p>
                        <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                          {bill.customer.name} · {bill.technician.name} ·{" "}
                          {formatThaiDateTime(bill.createdAt)}
                        </p>
                      </div>
                      <div className="flex items-center justify-between gap-2 sm:block">
                        <p className="text-right font-medium tabular-nums sm:text-left">
                          {formatTHB(bill.grandTotal.toString())}
                        </p>
                        <BillStatusBadge status={bill.status} />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">ทางลัด</CardTitle>
              <CardDescription>งานที่ใช้บ่อยในร้าน</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              {[
                {
                  href: "/bills/new",
                  label: "เปิดบิลใหม่",
                  icon: FilePlus2,
                },
                {
                  href: "/bills",
                  label: "บิล ใบเสร็จ และพิมพ์เอกสาร",
                  icon: ReceiptText,
                },
                {
                  href: "/commissions",
                  label: "ค่าคอมมิชชั่นและรอบจ่าย",
                  icon: Coins,
                },
                {
                  href: "/inventory/low-stock",
                  label: "สินค้าใกล้หมด",
                  icon: PackageSearch,
                },
                {
                  href: "/customers",
                  label: "ค้นหาลูกค้า",
                  icon: Contact,
                },
                ...(isAdmin
                  ? [
                      {
                        href: "/settings/shop",
                        label: "ข้อมูลร้านและการพิมพ์",
                        icon: Store,
                      },
                      {
                        href: "/settings/users",
                        label: "จัดการผู้ใช้",
                        icon: UsersRound,
                      },
                    ]
                  : []),
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2.5 text-sm transition-colors hover:bg-muted/40"
                  >
                    <span className="flex items-center gap-2">
                      <Icon className="size-4 text-primary" aria-hidden />
                      {item.label}
                    </span>
                    <ArrowRight
                      className="size-3.5 text-muted-foreground"
                      aria-hidden
                    />
                  </Link>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">บัญชีของคุณ</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 text-sm">
              <div className="flex items-center justify-between gap-3 border-b pb-2.5">
                <span className="text-muted-foreground">บทบาท</span>
                <RoleBadge role={user.role} />
              </div>
              <div className="flex items-center justify-between gap-3 border-b pb-2.5">
                <span className="text-muted-foreground">อีเมล</span>
                <span className="max-w-52 truncate font-medium">
                  {user.email}
                </span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <span className="text-muted-foreground">เข้าสู่ระบบล่าสุด</span>
                <span className="text-right text-xs font-medium">
                  {formatThaiDateTime(user.lastLoginAt)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="flex flex-col items-start justify-between gap-3 rounded-xl border bg-background px-4 py-3 text-sm sm:flex-row sm:items-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-300" aria-hidden />
          สิทธิ์ของคุณถูกตรวจสอบจากฐานข้อมูลทุกครั้ง
        </div>
        <Link
          href="/profile"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          ตรวจสอบบัญชีและรหัสผ่าน
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </section>
    </div>
  );
}
