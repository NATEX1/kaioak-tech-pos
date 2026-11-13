import type { Metadata } from "next";
import Link from "next/link";
import type { QuoteStatus } from "@/generated/prisma/enums";
import {
  CheckCircle2,
  Clock3,
  FileText,
  Plus,
  Search,
  Send,
} from "lucide-react";

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  quoteStatusBadgeClass,
  quoteStatusLabel,
} from "@/lib/bill-labels";
import { formatThaiDate } from "@/lib/labels";
import { formatTHB } from "@/lib/money";
import { cn } from "@/lib/utils";
import { requireUser } from "@/server/auth/session";
import { getQuoteSummary, listQuotes } from "@/server/services/quotes";

export const instant = false;

export const metadata: Metadata = {
  title: "ใบเสนอราคา",
};

const QUOTE_STATUSES: QuoteStatus[] = [
  "DRAFT",
  "SENT",
  "ACCEPTED",
  "CONVERTED",
  "EXPIRED",
  "CANCELLED",
];

function parseStatus(value?: string): QuoteStatus | undefined {
  return QUOTE_STATUSES.includes(value as QuoteStatus)
    ? (value as QuoteStatus)
    : undefined;
}

function effectiveStatus(status: QuoteStatus, validUntil: Date): QuoteStatus {
  if (status === "SENT" && validUntil.getTime() < Date.now()) {
    return "EXPIRED";
  }
  return status;
}

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const actor = await requireUser();
  const query = await searchParams;
  const q = query.q?.trim().slice(0, 100) ?? "";
  const status = parseStatus(query.status);

  const [result, summary] = await Promise.all([
    listQuotes({ id: actor.id, role: actor.role }, { q, status, pageSize: 100 }),
    getQuoteSummary({ id: actor.id, role: actor.role }),
  ]);

  const stats = [
    {
      label: "รอตอบรับ",
      value: summary.sentCount,
      hint: formatTHB(summary.sentAmount),
      icon: Send,
      tone: "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300",
    },
    {
      label: "ตอบรับแล้ว",
      value: summary.acceptedCount,
      hint: "รอเปิดบิล",
      icon: CheckCircle2,
      tone:
        "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300",
    },
    {
      label: "หมดอายุ",
      value: summary.expiredCount,
      hint: "ควรติดตามลูกค้า",
      icon: Clock3,
      tone: "bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300",
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">ใบเสนอราคา</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            สร้างใบเสนอราคาจากหน้าขาย ส่งให้ลูกค้า และเปิดบิลเมื่อลูกค้าตอบรับ
          </p>
        </div>
        <Link href="/pos" className={cn(buttonVariants(), "h-9")}>
          <Plus aria-hidden />
          สร้างจากหน้าขาย
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-3 p-4">
              <div
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-xl",
                  stat.tone,
                )}
              >
                <stat.icon className="size-5" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className="text-xl font-semibold tabular-nums">
                  {stat.value.toLocaleString("th-TH")}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {stat.hint}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="gap-2 border-b">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">รายการใบเสนอราคา</CardTitle>
              <CardDescription>
                ทั้งหมด {result.totalCount.toLocaleString("th-TH")} ฉบับ
              </CardDescription>
            </div>
          </div>
          <form className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1 space-y-1.5">
              <Label htmlFor="quote-q">ค้นหา</Label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  id="quote-q"
                  name="q"
                  defaultValue={q}
                  placeholder="เลขที่ใบเสนอราคา หรือชื่อลูกค้า"
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="quote-status">สถานะ</Label>
              <select
                id="quote-status"
                name="status"
                defaultValue={status ?? ""}
                className="h-9 rounded-lg border bg-background px-3 text-sm"
              >
                <option value="">ทุกสถานะ</option>
                {QUOTE_STATUSES.map((item) => (
                  <option key={item} value={item}>
                    {quoteStatusLabel(item)}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" variant="outline" className="h-9">
              กรอง
            </Button>
          </form>
        </CardHeader>
        <CardContent className="p-0">
          {result.items.length === 0 ? (
            <div className="px-4 py-16 text-center text-sm text-muted-foreground">
              <FileText className="mx-auto mb-3 size-8 opacity-40" aria-hidden />
              ยังไม่มีใบเสนอราคา
              <p className="mt-1 text-xs">
                เริ่มสร้างได้จากหน้าขายหน้าร้าน (POS)
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>เลขที่</TableHead>
                    <TableHead>ลูกค้า</TableHead>
                    <TableHead>สถานะ</TableHead>
                    <TableHead className="text-right">ยอดรวม</TableHead>
                    <TableHead>ใช้ได้ถึง</TableHead>
                    <TableHead>สร้างโดย</TableHead>
                    <TableHead>เปิดบิล</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.items.map((quote) => {
                    const statusValue = effectiveStatus(
                      quote.status,
                      quote.validUntil,
                    );
                    return (
                      <TableRow key={quote.id}>
                        <TableCell>
                          <Link
                            href={`/quotes/${quote.id}`}
                            className="font-mono text-xs font-semibold text-primary hover:underline"
                          >
                            {quote.quoteNumber}
                          </Link>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {quote._count.items} รายการ ·{" "}
                            {formatThaiDate(quote.createdAt)}
                          </p>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm font-medium">
                            {quote.customer.name}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {quote.customer.phone}
                          </p>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={quoteStatusBadgeClass(statusValue)}
                          >
                            {quoteStatusLabel(statusValue)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm font-semibold tabular-nums">
                          {formatTHB(quote.grandTotal)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatThaiDate(quote.validUntil)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {quote.createdBy?.name ?? "—"}
                        </TableCell>
                        <TableCell>
                          {quote.convertedBill ? (
                            <Link
                              href={`/bills/${quote.convertedBill.id}`}
                              className="font-mono text-xs text-primary hover:underline"
                            >
                              {quote.convertedBill.billNumber}
                            </Link>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              —
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
