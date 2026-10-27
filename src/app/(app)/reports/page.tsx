import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  FileSpreadsheet,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

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
import { formatThaiDate } from "@/lib/labels";
import { Decimal, formatTHB } from "@/lib/money";
import { cn } from "@/lib/utils";
import { requireUser } from "@/server/auth/session";
import { getMonthlySalesReport } from "@/server/services/reports";

export const instant = false;

export const metadata: Metadata = {
  title: "รายงานยอดขาย",
};

export default async function ReportsPage() {
  const user = await requireUser();

  if (user.role !== "ADMIN") {
    notFound();
  }

  const now = new Date();
  const rows = await getMonthlySalesReport(now);

  // สรุปรวม 12 เดือน
  const totals = rows.reduce(
    (acc, row) => ({
      revenue: acc.revenue.plus(row.revenue),
      costOfGoods: acc.costOfGoods.plus(row.costOfGoods),
      grossProfit: acc.grossProfit.plus(row.grossProfit),
      billCount: acc.billCount + row.billCount,
    }),
    {
      revenue: new Decimal(0),
      costOfGoods: new Decimal(0),
      grossProfit: new Decimal(0),
      billCount: 0,
    },
  );

  const maxRevenue = rows.reduce(
    (max, row) => (row.revenue.gt(max) ? row.revenue : max),
    new Decimal(0),
  );

  const currentMonthRow = rows[rows.length - 1];

  const gpMarginPct =
    totals.revenue.gt(0)
      ? totals.grossProfit.dividedBy(totals.revenue).times(100).toFixed(1)
      : "0.0";

  const isGpPositive = totals.grossProfit.gte(0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <Link
            href="/"
            className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            กลับภาพรวม
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="bg-background">
              <span className="size-1.5 rounded-full bg-teal-500" />
              ข้อมูลสด · {formatThaiDate(now)}
            </Badge>
            <Badge variant="outline" className="bg-background">
              Admin only
            </Badge>
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
            รายงานยอดขาย
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            สรุปยอดขาย กำไรขั้นต้น และต้นทุนสินค้า 12 เดือนย้อนหลัง ·
            นับเฉพาะบิลสถานะชำระแล้ว
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/api/reports/export"
            download
            className={cn(buttonVariants({ variant: "outline" }), "h-9 shrink-0")}
          >
            <FileSpreadsheet className="size-3.5" aria-hidden />
            ส่งออก CSV
          </a>
          <Link
            href="/bills?status=PAID"
            className={cn(buttonVariants({ variant: "outline" }), "h-9 shrink-0")}
          >
            ดูรายการบิล
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      </section>

      {/* Summary cards */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                ยอดขายรวม 12 เดือน
              </p>
              <p className="mt-2 text-xl font-semibold tabular-nums">
                {formatTHB(totals.revenue)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {totals.billCount.toLocaleString("th-TH")} บิลที่ชำระแล้ว
              </p>
            </div>
            <div className="hidden size-9 shrink-0 items-center justify-center rounded-xl sm:flex bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300">
              <BarChart3 className="size-4" aria-hidden />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                ต้นทุนสินค้ารวม
              </p>
              <p className="mt-2 text-xl font-semibold tabular-nums">
                {formatTHB(totals.costOfGoods)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                เฉลี่ย{" "}
                {totals.billCount > 0
                  ? formatTHB(
                      totals.costOfGoods.dividedBy(totals.billCount),
                    )
                  : "฿0.00"}{" "}
                / บิล
              </p>
            </div>
            <div className="hidden size-9 shrink-0 items-center justify-center rounded-xl sm:flex bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300">
              <TrendingDown className="size-4" aria-hidden />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                กำไรขั้นต้นรวม
              </p>
              <p
                className={cn(
                  "mt-2 text-xl font-semibold tabular-nums",
                  isGpPositive ? "text-teal-700 dark:text-teal-300" : "text-rose-700 dark:text-rose-300",
                )}
              >
                {formatTHB(totals.grossProfit)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Gross Margin {gpMarginPct}%
              </p>
            </div>
            <div
              className={cn(
                "hidden size-9 shrink-0 items-center justify-center rounded-xl sm:flex",
                isGpPositive
                  ? "bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-300"
                  : "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300",
              )}
            >
              <TrendingUp className="size-4" aria-hidden />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                ยอดขายเดือนนี้
              </p>
              <p className="mt-2 text-xl font-semibold tabular-nums">
                {formatTHB(currentMonthRow?.revenue ?? 0)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                กำไร {formatTHB(currentMonthRow?.grossProfit ?? 0)}
              </p>
            </div>
            <div className="hidden size-9 shrink-0 items-center justify-center rounded-xl sm:flex bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300">
              <TrendingUp className="size-4" aria-hidden />
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Bar chart section */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-primary">
                <BarChart3 className="size-4" aria-hidden />
                <span className="text-xs font-semibold tracking-wide">
                  REVENUE · 12 MONTHS
                </span>
              </div>
              <CardTitle className="pt-1 text-lg">
                ยอดขายที่ชำระแล้ว 12 เดือนย้อนหลัง
              </CardTitle>
              <CardDescription>
                ยอดรวม {formatTHB(totals.revenue)} ·{" "}
                {totals.billCount.toLocaleString("th-TH")} บิล
              </CardDescription>
            </div>
            <div className="flex items-center gap-4 whitespace-nowrap text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="inline-block size-2.5 rounded-sm bg-primary" />
                ยอดขาย
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block size-2.5 rounded-sm bg-teal-500" />
                กำไรขั้นต้น
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex h-52 items-end gap-1.5 sm:gap-2">
            {rows.map((row) => {
              const revenueRatio = maxRevenue.gt(0)
                ? row.revenue.dividedBy(maxRevenue).times(100).toNumber()
                : 0;
              const revenueHeight = row.revenue.gt(0)
                ? Math.max(4, revenueRatio)
                : 0;

              const gpRatio = maxRevenue.gt(0)
                ? row.grossProfit
                    .dividedBy(maxRevenue)
                    .times(100)
                    .toNumber()
                : 0;
              const gpHeight = row.grossProfit.gt(0)
                ? Math.max(2, gpRatio)
                : 0;

              const isCurrentMonth = row.monthKey === currentMonthRow?.monthKey;

              return (
                <div
                  key={row.monthKey}
                  className="flex min-w-0 flex-1 flex-col items-center gap-1"
                  title={`${row.label}: ยอดขาย ${formatTHB(row.revenue)} · กำไร ${formatTHB(row.grossProfit)}`}
                >
                  <div className="relative flex h-40 w-full items-end gap-0.5 rounded-t-sm bg-muted/25">
                    {/* Revenue bar */}
                    <div
                      className={cn(
                        "flex-1 rounded-t-sm transition-all",
                        isCurrentMonth ? "bg-primary" : "bg-primary/30",
                      )}
                      style={{ height: `${revenueHeight}%` }}
                    />
                    {/* Gross profit bar */}
                    <div
                      className={cn(
                        "flex-1 rounded-t-sm transition-all",
                        row.grossProfit.isNegative()
                          ? "bg-rose-500/60"
                          : isCurrentMonth
                            ? "bg-teal-500"
                            : "bg-teal-500/40",
                      )}
                      style={{
                        height: `${row.grossProfit.isNegative() ? 4 : gpHeight}%`,
                      }}
                    />
                  </div>
                  <p
                    className={cn(
                      "truncate text-[9px] leading-3",
                      isCurrentMonth
                        ? "font-semibold text-primary"
                        : "text-muted-foreground",
                    )}
                  >
                    {row.label.split(" ")[0]}
                  </p>
                  <p className="text-[8px] leading-3 text-muted-foreground">
                    {row.thaiYear}
                  </p>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            กำไรขั้นต้น = ยอดขายสุทธิ (ไม่รวม VAT) − ต้นทุนสินค้า ·
            ยังไม่หักค่าคอมมิชชั่นและค่าใช้จ่ายดำเนินการ ·
            วางเมาส์บนแต่ละแท่งเพื่อดูรายละเอียด
          </p>
        </CardContent>
      </Card>

      {/* Monthly table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">รายละเอียดรายเดือน</CardTitle>
          <CardDescription>12 เดือนล่าสุด — เรียงจากใหม่ไปเก่า</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-4">เดือน</TableHead>
                <TableHead className="px-4 text-right">บิล</TableHead>
                <TableHead className="px-4 text-right">ยอดขายสุทธิ</TableHead>
                <TableHead className="px-4 text-right">ต้นทุนสินค้า</TableHead>
                <TableHead className="px-4 text-right">กำไรขั้นต้น</TableHead>
                <TableHead className="px-4 text-right">Margin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...rows].reverse().map((row) => {
                const margin = row.revenue.gt(0)
                  ? row.grossProfit
                      .dividedBy(row.revenue)
                      .times(100)
                      .toFixed(1)
                  : null;
                const isCurrentMonth =
                  row.monthKey === currentMonthRow?.monthKey;
                const isGpNeg = row.grossProfit.isNegative();

                return (
                  <TableRow
                    key={row.monthKey}
                    className={isCurrentMonth ? "bg-primary/5 font-medium" : ""}
                  >
                    <TableCell className="px-4">
                      <span className="text-sm">
                        {row.label}
                        {isCurrentMonth ? (
                          <Badge
                            variant="outline"
                            className="ml-2 border-primary/30 bg-primary/10 text-primary"
                          >
                            เดือนนี้
                          </Badge>
                        ) : null}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 text-right tabular-nums">
                      {row.billCount.toLocaleString("th-TH")}
                    </TableCell>
                    <TableCell className="px-4 text-right tabular-nums">
                      {formatTHB(row.revenue)}
                    </TableCell>
                    <TableCell className="px-4 text-right tabular-nums text-muted-foreground">
                      {formatTHB(row.costOfGoods)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "px-4 text-right font-medium tabular-nums",
                        row.billCount > 0
                          ? isGpNeg
                            ? "text-rose-700 dark:text-rose-300"
                            : "text-teal-700 dark:text-teal-300"
                          : "text-muted-foreground",
                      )}
                    >
                      {formatTHB(row.grossProfit)}
                    </TableCell>
                    <TableCell className="px-4 text-right tabular-nums">
                      {margin !== null ? (
                        <span
                          className={cn(
                            "text-xs",
                            isGpNeg
                              ? "text-rose-700 dark:text-rose-300"
                              : "text-muted-foreground",
                          )}
                        >
                          {margin}%
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {/* Footer totals row */}
          <div className="mt-1 grid grid-cols-6 border-t bg-muted/30 px-4 py-3 text-sm font-semibold tabular-nums">
            <span>รวม 12 เดือน</span>
            <span className="text-right">
              {totals.billCount.toLocaleString("th-TH")}
            </span>
            <span className="text-right">{formatTHB(totals.revenue)}</span>
            <span className="text-right text-muted-foreground">
              {formatTHB(totals.costOfGoods)}
            </span>
            <span
              className={cn(
                "text-right",
                isGpPositive ? "text-teal-700 dark:text-teal-300" : "text-rose-700 dark:text-rose-300",
              )}
            >
              {formatTHB(totals.grossProfit)}
            </span>
            <span className="text-right text-xs font-normal text-muted-foreground">
              {gpMarginPct}%
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Notice */}
      <section className="rounded-xl border bg-background px-4 py-3 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">หมายเหตุ</p>
        <ul className="mt-1.5 list-disc space-y-1 pl-4">
          <li>
            ยอดขายสุทธิ = ยอดรวม (grandTotal) − VAT — ไม่นับบิลที่ถูกยกเลิก
          </li>
          <li>
            ต้นทุนสินค้า = ผลรวม (unitCost × จำนวน) ของทุกรายการในบิล PAID
          </li>
          <li>
            กำไรขั้นต้น ยังไม่ได้หัก: ค่าคอมมิชชั่น, ค่าใช้จ่ายดำเนินการ,
            ค่าเสื่อม
          </li>
          <li>
            สินค้าประเภทบริการ/แรงงาน (kind = SERVICE) มีต้นทุน 0 บาทตามค่าเริ่มต้น
          </li>
        </ul>
      </section>
    </div>
  );
}
