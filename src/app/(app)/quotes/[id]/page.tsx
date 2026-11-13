import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  ReceiptText,
  UserRound,
} from "lucide-react";

import { MessageComposer } from "@/components/messaging/message-composer";
import { QuoteActions } from "@/components/quotes/quote-actions";
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
  quoteStatusBadgeClass,
  quoteStatusLabel,
} from "@/lib/bill-labels";
import { formatThaiDate, formatThaiDateTime } from "@/lib/labels";
import { buildQuoteMessage } from "@/lib/messaging";
import { formatTHB } from "@/lib/money";
import { formatThaiPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";
import { requireUser } from "@/server/auth/session";
import { getQuoteById } from "@/server/services/quotes";
import { getShopSettings } from "@/server/services/settings";

export const instant = false;

export const metadata: Metadata = {
  title: "รายละเอียดใบเสนอราคา",
};

export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const actor = await requireUser();
  const [quote, settings] = await Promise.all([
    getQuoteById({ id: actor.id, role: actor.role }, id),
    getShopSettings(),
  ]);

  if (!quote) {
    notFound();
  }

  const status = quote.effectiveStatus;

  const message = buildQuoteMessage({
    shopName: settings.shopName,
    customerName: quote.customer.name,
    quoteNumber: quote.quoteNumber,
    amount: formatTHB(quote.grandTotal),
    validUntil: quote.validUntil,
    note: quote.note,
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/quotes"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            กลับไปใบเสนอราคา
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h2 className="font-mono text-xl font-semibold tracking-tight">
              {quote.quoteNumber}
            </h2>
            <Badge
              variant="outline"
              className={quoteStatusBadgeClass(status)}
            >
              {quoteStatusLabel(status)}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            สร้างเมื่อ {formatThaiDateTime(quote.createdAt)} · ใช้ได้ถึง{" "}
            {formatThaiDate(quote.validUntil)}
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <QuoteActions
            quoteId={quote.id}
            status={status}
            convertedBillId={quote.convertedBill?.id ?? null}
          />
          <MessageComposer
            customerName={quote.customer.name}
            phone={quote.customer.phone}
            lineId={quote.customer.lineId}
            whatsapp={quote.customer.whatsapp}
            defaultMessage={message}
            triggerLabel="ส่งใบเสนอราคา"
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <Card>
            <CardHeader className="border-b">
              <CardTitle className="text-base">รายการเสนอราคา</CardTitle>
              <CardDescription>
                {quote.items.length} รายการ ·{" "}
                {quote.convertedBill
                  ? `เปิดบิลแล้ว ${quote.convertedBill.billNumber}`
                  : "ยังไม่เปิดบิล"}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10 text-right">#</TableHead>
                      <TableHead>รายการ</TableHead>
                      <TableHead className="text-right">จำนวน</TableHead>
                      <TableHead className="text-right">ราคา/หน่วย</TableHead>
                      <TableHead className="text-right">ส่วนลด</TableHead>
                      <TableHead className="text-right">รวม</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {quote.items.map((item, index) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {index + 1}
                        </TableCell>
                        <TableCell>
                          <p className="text-sm font-medium">
                            {item.description}
                          </p>
                          <p className="font-mono text-[10px] text-muted-foreground">
                            {item.product?.sku ?? "บริการ"}
                          </p>
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums">
                          {item.quantity}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums">
                          {formatTHB(item.unitPrice)}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                          {item.discountAmount.greaterThan(0)
                            ? `-${formatTHB(item.discountAmount)}`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium tabular-nums">
                          {formatTHB(item.lineTotal)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {quote.note ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">หมายเหตุ</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                  {quote.note}
                </p>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="border-b">
              <CardTitle className="text-base">ลูกค้า</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-4 text-sm">
              <p className="flex items-center gap-2 font-medium">
                <UserRound className="size-4 text-muted-foreground" aria-hidden />
                {quote.customer.name}
              </p>
              <p className="flex items-center gap-2 text-muted-foreground">
                <Phone className="size-4" aria-hidden />
                {formatThaiPhone(quote.customer.phone)}
              </p>
              {quote.customer.email ? (
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="size-4" aria-hidden />
                  {quote.customer.email}
                </p>
              ) : null}
              {quote.customer.lineId ? (
                <p className="flex items-center gap-2 text-muted-foreground">
                  <MessageCircle className="size-4" aria-hidden />
                  {quote.customer.lineId}
                </p>
              ) : null}
              {quote.customer.address ? (
                <p className="flex items-start gap-2 text-muted-foreground">
                  <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span className="whitespace-pre-wrap">
                    {quote.customer.address}
                  </span>
                </p>
              ) : null}
              <div className="flex items-center gap-2 border-t pt-2 text-xs text-muted-foreground">
                <CalendarDays className="size-4" aria-hidden />
                ใช้ได้ถึง {formatThaiDate(quote.validUntil)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle className="text-base">สรุปยอด</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-4 text-sm">
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">ยอดรายการ</span>
                <span className="tabular-nums">{formatTHB(quote.subtotal)}</span>
              </div>
              {quote.discountAmount.greaterThan(0) ? (
                <div className="flex justify-between gap-2 text-emerald-700 dark:text-emerald-300">
                  <span>ส่วนลด</span>
                  <span className="tabular-nums">
                    -{formatTHB(quote.discountAmount)}
                  </span>
                </div>
              ) : null}
              {quote.vatEnabled ? (
                <div className="flex justify-between gap-2 text-muted-foreground">
                  <span>
                    VAT {quote.vatRate.toString()}%{" "}
                    {quote.vatIncluded ? "(รวมในราคา)" : ""}
                  </span>
                  <span className="tabular-nums">
                    {formatTHB(quote.vatAmount)}
                  </span>
                </div>
              ) : null}
              <div className="flex items-end justify-between gap-2 border-t pt-2">
                <span className="font-semibold">ยอดรวมทั้งสิ้น</span>
                <span className="text-xl font-semibold tabular-nums text-primary">
                  {formatTHB(quote.grandTotal)}
                </span>
              </div>
            </CardContent>
          </Card>

          {quote.convertedBill ? (
            <Link
              href={`/bills/${quote.convertedBill.id}`}
              className={cn(buttonVariants({ variant: "outline" }), "w-full")}
            >
              <ReceiptText aria-hidden />
              เปิดบิล {quote.convertedBill.billNumber}
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
