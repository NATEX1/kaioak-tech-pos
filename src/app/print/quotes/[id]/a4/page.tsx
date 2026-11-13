import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { QuotePrintToolbar } from "@/components/printing/quote-print-toolbar";
import {
  quoteStatusLabel,
} from "@/lib/bill-labels";
import { formatThaiDate, formatThaiDateTime } from "@/lib/labels";
import { formatTHB } from "@/lib/money";
import { formatThaiPhone } from "@/lib/phone";
import { requireUser } from "@/server/auth/session";
import { getQuoteById } from "@/server/services/quotes";
import { getShopSettings } from "@/server/services/settings";

export const instant = false;

export const metadata: Metadata = {
  title: "พิมพ์ใบเสนอราคา",
};

export default async function QuotePrintPage({
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

  return (
    <div className="min-h-svh bg-muted/40 px-3 py-5 print:min-h-0 print:bg-white print:p-0">
      <style>{"@media print { @page { size: A4; margin: 0; } }"}</style>
      <QuotePrintToolbar
        quoteId={quote.id}
        quoteNumber={quote.quoteNumber}
      />

      <div className="mx-auto mt-4 w-full max-w-[210mm] bg-white p-[12mm] text-[12px] text-black shadow-sm print:mt-0 print:shadow-none">
        <header className="flex items-start justify-between gap-6 border-b-2 border-black/80 pb-4">
          <div className="flex items-start gap-3">
            {settings.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={settings.logoUrl}
                alt=""
                className="h-14 w-14 object-contain"
              />
            ) : null}
            <div>
              <h1 className="text-lg font-bold">{settings.shopName}</h1>
              {settings.address ? (
                <p className="mt-0.5 whitespace-pre-wrap text-[11px] leading-4 text-black/70">
                  {settings.address}
                </p>
              ) : null}
              <p className="mt-0.5 text-[11px] text-black/70">
                {[
                  settings.phone ? `โทร ${formatThaiPhone(settings.phone)}` : null,
                  settings.email,
                  settings.taxId ? `เลขผู้เสียภาษี ${settings.taxId}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold tracking-wide">ใบเสนอราคา</p>
            <p className="text-[11px] text-black/60">QUOTATION</p>
            <p className="mt-1 font-mono text-sm font-semibold">
              {quote.quoteNumber}
            </p>
            <p className="text-[11px] text-black/60">
              วันที่ {formatThaiDateTime(quote.createdAt)}
            </p>
            <p className="text-[11px] text-black/60">
              ใช้ได้ถึง {formatThaiDate(quote.validUntil)}
            </p>
            <p className="mt-1 inline-block rounded border border-neutral-300 px-2 py-0.5 text-[10px]">
              {quoteStatusLabel(quote.effectiveStatus)}
            </p>
          </div>
        </header>

        <section className="mt-4 grid grid-cols-2 gap-4">
          <div className="rounded border border-neutral-300 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-black/50">
              ลูกค้า
            </p>
            <p className="mt-1 text-sm font-semibold">{quote.customer.name}</p>
            <p className="text-[11px]">{formatThaiPhone(quote.customer.phone)}</p>
            {quote.customer.email ? (
              <p className="text-[11px]">{quote.customer.email}</p>
            ) : null}
            {quote.customer.address ? (
              <p className="mt-1 whitespace-pre-wrap text-[11px] text-black/70">
                {quote.customer.address}
              </p>
            ) : null}
            {quote.customer.taxId ? (
              <p className="mt-1 text-[11px] text-black/70">
                เลขผู้เสียภาษี {quote.customer.taxId}
              </p>
            ) : null}
          </div>
          <div className="rounded border border-neutral-300 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-black/50">
              ข้อมูลเอกสาร
            </p>
            <dl className="mt-1 space-y-0.5 text-[11px]">
              <div className="flex justify-between gap-2">
                <dt className="text-black/60">ผู้จัดทำ</dt>
                <dd>{quote.createdBy?.name ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-black/60">จำนวนรายการ</dt>
                <dd>{quote.items.length}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-black/60">ยอดรวม</dt>
                <dd className="font-semibold">{formatTHB(quote.grandTotal)}</dd>
              </div>
            </dl>
          </div>
        </section>

        <table className="mt-4 w-full border-collapse text-[11px]">
          <thead>
            <tr className="bg-black text-white">
              <th className="w-8 px-2 py-1.5 text-right">#</th>
              <th className="px-2 py-1.5 text-left">รายละเอียด</th>
              <th className="w-16 px-2 py-1.5 text-right">จำนวน</th>
              <th className="w-24 px-2 py-1.5 text-right">ราคา/หน่วย</th>
              <th className="w-20 px-2 py-1.5 text-right">ส่วนลด</th>
              <th className="w-24 px-2 py-1.5 text-right">รวม</th>
            </tr>
          </thead>
          <tbody>
            {quote.items.map((item, index) => (
              <tr key={item.id} className="border-b border-black/10">
                <td className="px-2 py-1.5 text-right text-black/50">
                  {index + 1}
                </td>
                <td className="px-2 py-1.5">
                  <p className="font-medium">{item.description}</p>
                  {item.product?.sku ? (
                    <p className="font-mono text-[9px] text-black/50">
                      {item.product.sku}
                    </p>
                  ) : null}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {item.quantity}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {formatTHB(item.unitPrice)}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {item.discountAmount.greaterThan(0)
                    ? `-${formatTHB(item.discountAmount)}`
                    : "—"}
                </td>
                <td className="px-2 py-1.5 text-right font-medium tabular-nums">
                  {formatTHB(item.lineTotal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <section className="mt-3 flex justify-end">
          <div className="w-64 space-y-1 text-[11px]">
            <div className="flex justify-between gap-2">
              <span className="text-black/60">ยอดรายการ</span>
              <span className="tabular-nums">{formatTHB(quote.subtotal)}</span>
            </div>
            {quote.discountAmount.greaterThan(0) ? (
              <div className="flex justify-between gap-2">
                <span className="text-black/60">ส่วนลด</span>
                <span className="tabular-nums">
                  -{formatTHB(quote.discountAmount)}
                </span>
              </div>
            ) : null}
            {quote.vatEnabled ? (
              <div className="flex justify-between gap-2">
                <span className="text-black/60">
                  VAT {quote.vatRate.toString()}%
                </span>
                <span className="tabular-nums">
                  {formatTHB(quote.vatAmount)}
                </span>
              </div>
            ) : null}
            <div className="flex justify-between gap-2 border-t-2 border-black pt-1 text-sm font-bold">
              <span>รวมทั้งสิ้น</span>
              <span className="tabular-nums">{formatTHB(quote.grandTotal)}</span>
            </div>
          </div>
        </section>

        {quote.note ? (
          <section className="mt-4 rounded border border-neutral-300 p-3 text-[11px]">
            <p className="font-semibold">หมายเหตุ</p>
            <p className="mt-1 whitespace-pre-wrap text-black/70">
              {quote.note}
            </p>
          </section>
        ) : null}

        {settings.repairTerms ? (
          <section className="mt-3 rounded border border-neutral-300 p-3 text-[10px] text-black/70">
            <p className="font-semibold text-black">เงื่อนไข</p>
            <p className="mt-1 whitespace-pre-wrap">{settings.repairTerms}</p>
          </section>
        ) : null}

        <footer className="mt-10 grid grid-cols-2 gap-10 text-center text-[11px]">
          <div>
            <div className="mx-auto h-12 w-40 border-b border-dashed border-black/40" />
            <p className="mt-1">ผู้เสนอราคา</p>
            <p className="text-[10px] text-black/50">
              วันที่ {formatThaiDate(new Date())}
            </p>
          </div>
          <div>
            <div className="mx-auto h-12 w-40 border-b border-dashed border-black/40" />
            <p className="mt-1">ผู้ยอมรับราคา</p>
            <p className="text-[10px] text-black/50">
              วันที่ ____ / ____ / ______
            </p>
          </div>
        </footer>

        {settings.receiptFooter ? (
          <p className="mt-6 border-t border-neutral-300 pt-2 text-center text-[10px] whitespace-pre-wrap text-black/60">
            {settings.receiptFooter}
          </p>
        ) : null}
      </div>
    </div>
  );
}
