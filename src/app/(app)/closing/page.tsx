import type { Metadata } from "next";
import Link from "next/link";
import {
  Banknote,
  CalendarDays,
  CreditCard,
  FileText,
  Landmark,
  QrCode,
  ReceiptText,
  ShieldAlert,
  WalletCards,
} from "lucide-react";

import { DayClosingForm } from "@/components/closing/day-closing-form";
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
import { bangkokDayKey } from "@/lib/bangkok-periods";
import { paymentMethodLabel } from "@/lib/bill-labels";
import { formatThaiDate, formatThaiDateTime } from "@/lib/labels";
import { formatTHB } from "@/lib/money";
import { requireAdmin } from "@/server/auth/session";
import {
  getDayClosingPreview,
  parseBangkokDateKey,
} from "@/server/services/day-closing";

export const instant = false;

export const metadata: Metadata = {
  title: "ปิดยอดรายวัน",
};

export default async function ClosingPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; saved?: string }>;
}) {
  await requireAdmin();
  const query = await searchParams;
  let dateKey =
    query.date && /^\d{4}-\d{2}-\d{2}$/.test(query.date)
      ? query.date
      : bangkokDayKey();

  try {
    parseBangkokDateKey(dateKey);
  } catch {
    dateKey = bangkokDayKey();
  }

  const preview = await getDayClosingPreview(dateKey);

  const summary = [
    {
      label: "ยอดขายรวม",
      value: formatTHB(preview.totalSales),
      hint: `${preview.billCount} บิลที่ชำระแล้ว`,
      icon: ReceiptText,
      tone: "bg-primary/10 text-primary",
    },
    {
      label: "เงินสดที่ควรมี",
      value: formatTHB(preview.expectedCash),
      hint: "เงินสด + เงินมัดจำซ่อม",
      icon: Banknote,
      tone:
        "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300",
    },
    {
      label: "เงินมัดจำซ่อม",
      value: formatTHB(preview.repairDeposits),
      hint: "รับจากงานซ่อมวันนี้",
      icon: WalletCards,
      tone: "bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300",
    },
    {
      label: "บิลยกเลิก",
      value: preview.voidCount.toLocaleString("th-TH"),
      hint: "รายการที่ถูกยกเลิกวันนี้",
      icon: ShieldAlert,
      tone: "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300",
    },
  ];

  const paymentRows = [
    {
      label: "เงินสด",
      value: preview.cashSales,
      icon: Banknote,
      tone: "text-emerald-700 dark:text-emerald-300",
    },
    {
      label: "พร้อมเพย์ / QR",
      value: preview.qrSales,
      icon: QrCode,
      tone: "text-blue-700 dark:text-blue-300",
    },
    {
      label: "โอนเงิน",
      value: preview.transferSales,
      icon: Landmark,
      tone: "text-violet-700 dark:text-violet-300",
    },
    {
      label: "บัตร",
      value: preview.cardSales,
      icon: CreditCard,
      tone: "text-amber-700 dark:text-amber-300",
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">ปิดยอดรายวัน</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            ตรวจสอบยอดขาย แยกตามวิธีชำระเงิน และบันทึกเงินสดที่นับได้จริง
          </p>
        </div>
        <form className="flex items-end gap-2">
          <div className="space-y-1.5">
            <label
              htmlFor="closing-date"
              className="flex items-center gap-1 text-xs font-medium text-muted-foreground"
            >
              <CalendarDays className="size-3.5" aria-hidden />
              วันที่
            </label>
            <input
              id="closing-date"
              type="date"
              name="date"
              defaultValue={dateKey}
              className="h-9 rounded-lg border bg-background px-3 text-sm"
            />
          </div>
          <button
            type="submit"
            className="inline-flex h-9 items-center justify-center rounded-lg border bg-background px-3 text-sm font-medium hover:bg-muted"
          >
            ดูยอด
          </button>
        </form>
      </div>

      {query.saved === "1" ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">
          บันทึกปิดยอดวันที่ {formatThaiDate(`${dateKey}T00:00:00+07:00`)} เรียบร้อยแล้ว
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {summary.map((item) => (
          <Card key={item.label}>
            <CardContent className="flex items-center gap-3 p-4">
              <div
                className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${item.tone}`}
              >
                <item.icon className="size-5" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="truncate text-xl font-semibold tabular-nums">
                  {item.value}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {item.hint}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <Card>
            <CardHeader className="border-b">
              <CardTitle className="text-base">ยอดตามวิธีชำระเงิน</CardTitle>
              <CardDescription>
                วันที่ {formatThaiDate(`${dateKey}T00:00:00+07:00`)}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 pt-4 sm:grid-cols-2">
              {paymentRows.map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between gap-2 rounded-lg border bg-muted/20 px-3 py-2.5 text-sm"
                >
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <row.icon className={`size-4 ${row.tone}`} aria-hidden />
                    {row.label}
                  </span>
                  <span className="font-semibold tabular-nums">
                    {formatTHB(row.value)}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle className="text-base">บิลที่ชำระเงินแล้ว</CardTitle>
              <CardDescription>
                {preview.paidBills.length} รายการในวันนี้
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {preview.paidBills.length === 0 ? (
                <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                  <FileText
                    className="mx-auto mb-2 size-7 opacity-40"
                    aria-hidden
                  />
                  ยังไม่มีบิลที่ชำระเงินในวันนี้
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>เวลา</TableHead>
                        <TableHead>เลขที่บิล</TableHead>
                        <TableHead>ลูกค้า</TableHead>
                        <TableHead>วิธีชำระ</TableHead>
                        <TableHead className="text-right">ยอด</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.paidBills.map((bill) => (
                        <TableRow key={bill.id}>
                          <TableCell className="text-xs text-muted-foreground">
                            {bill.paidAt
                              ? formatThaiDateTime(bill.paidAt).split(" ").pop()
                              : "—"}
                          </TableCell>
                          <TableCell>
                            <Link
                              href={`/bills/${bill.id}`}
                              className="font-mono text-xs font-semibold text-primary hover:underline"
                            >
                              {bill.billNumber}
                            </Link>
                          </TableCell>
                          <TableCell className="text-sm">
                            {bill.customer.name}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">
                              {paymentMethodLabel(bill.paymentMethod)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-sm font-semibold tabular-nums">
                            {formatTHB(bill.grandTotal)}
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

        <div className="space-y-4">
          <Card>
            <CardHeader className="border-b">
              <CardTitle className="text-base">
                {preview.saved ? "แก้ไขการปิดยอด" : "ปิดยอดประจำวัน"}
              </CardTitle>
              <CardDescription>
                {preview.saved
                  ? `บันทึกล่าสุด ${formatThaiDateTime(preview.saved.closedAt)}`
                  : "กรอกเงินสดที่นับได้จริงเพื่อเปรียบเทียบ"}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <DayClosingForm
                key={dateKey}
                dateKey={dateKey}
                expectedCash={preview.expectedCash.toFixed(2)}
                saved={
                  preview.saved
                    ? {
                        countedCash: preview.saved.countedCash.toFixed(2),
                        difference: preview.saved.difference.toFixed(2),
                        note: preview.saved.note,
                      }
                    : null
                }
              />
            </CardContent>
          </Card>

          {preview.recent.length > 0 ? (
            <Card>
              <CardHeader className="border-b">
                <CardTitle className="text-base">ปิดยอดล่าสุด</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-4">
                {preview.recent.map((closing) => (
                  <Link
                    key={closing.id}
                    href={`/closing?date=${closing.dateKey}`}
                    className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted/40"
                  >
                    <div>
                      <p className="font-medium">
                        {formatThaiDate(`${closing.dateKey}T00:00:00+07:00`)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {closing.billCount} บิล · {formatTHB(closing.totalSales)}
                      </p>
                    </div>
                    <span
                      className={
                        closing.difference.isZero()
                          ? "text-xs font-medium text-emerald-700 dark:text-emerald-300"
                          : "text-xs font-medium text-amber-700 dark:text-amber-300"
                      }
                    >
                      {closing.difference.isZero()
                        ? "ตรง"
                        : `${closing.difference.greaterThan(0) ? "+" : ""}${formatTHB(closing.difference)}`}
                    </span>
                  </Link>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
