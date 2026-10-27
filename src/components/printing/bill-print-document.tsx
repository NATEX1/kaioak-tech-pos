import { BrandLogo } from "@/components/brand/brand-mark";
import { paymentMethodLabel } from "@/lib/bill-labels";
import { formatThaiDate, formatThaiDateTime } from "@/lib/labels";
import { formatTHB } from "@/lib/money";
import { formatThaiPhone } from "@/lib/phone";
import {
  getPrintDocumentEnglishTitle,
  getPrintDocumentTitle,
  getPrintDocumentWarning,
  type PrintFormat,
} from "@/lib/print-documents";
import type { BillDetail } from "@/server/services/bills";
import type { ShopSettings } from "@/server/services/settings";
import { cn } from "@/lib/utils";

type BillPrintDocumentProps = {
  bill: BillDetail;
  settings: ShopSettings;
  format: PrintFormat;
};

function documentDate(bill: BillDetail): Date {
  return (
    bill.paidAt ??
    bill.approvedAt ??
    bill.submittedAt ??
    bill.createdAt
  );
}

function documentReference(bill: BillDetail): string {
  if (bill.warrantyClaim?.originalBill) {
    return `บิลซื้อเดิม ${bill.warrantyClaim.originalBill.billNumber}`;
  }

  if (bill.billType.requiresRepairDetail && bill.repairDetail?.deviceSerial) {
    return `Serial เครื่อง ${bill.repairDetail.deviceSerial}`;
  }

  return bill.billType.name;
}

function shopContact(settings: ShopSettings): string {
  const parts = [
    settings.phone ? `โทร ${settings.phone}` : null,
    settings.email,
    settings.taxId ? `เลขภาษี ${settings.taxId}` : null,
  ].filter((value): value is string => Boolean(value));

  return parts.join(" · ");
}

function paymentText(bill: BillDetail): string {
  if (bill.status === "PAID") {
    return `ชำระโดย ${paymentMethodLabel(bill.paymentMethod)}${
      bill.paidAt ? ` · ${formatThaiDateTime(bill.paidAt)}` : ""
    }`;
  }

  if (bill.status === "APPROVED") {
    return "ยังไม่ชำระเงิน — ใช้เป็นใบส่งของ/ใบแจ้งหนี้";
  }

  return "ยังไม่ชำระเงิน";
}

function ItemDescription({
  bill,
  item,
}: {
  bill: BillDetail;
  item: BillDetail["items"][number];
}) {
  return (
    <div>
      <p className="font-medium text-neutral-900">{item.description}</p>
      {item.skuSnapshot || item.barcodeSnapshot ? (
        <p className="mt-0.5 font-mono text-[9px] text-neutral-500">
          {[item.skuSnapshot, item.barcodeSnapshot]
            .filter(Boolean)
            .join(" · ")}
        </p>
      ) : null}
      {item.serials.length > 0 ? (
        <div className="mt-1 space-y-0.5 text-[9px] leading-4 text-neutral-600">
          {item.serials.map((serial) => (
            <p key={serial.id}>
              S/N {serial.productSerial.serialNumber}
              {serial.warrantyEndAt
                ? ` · ประกันถึง ${formatThaiDate(serial.warrantyEndAt)}`
                : ""}
            </p>
          ))}
        </div>
      ) : item.warrantyMonths ? (
        <p className="mt-0.5 text-[9px] text-neutral-600">
          ประกัน {item.warrantyMonths} เดือน
        </p>
      ) : null}
      {item.discountAmount.gt(0) ? (
        <p className="mt-0.5 text-[9px] text-rose-700">
          ส่วนลดรายการ {formatTHB(item.discountAmount.toString())}
        </p>
      ) : null}
      {bill.billType.requiresRepairDetail &&
      bill.repairDetail?.deviceBrand ? (
        <p className="mt-0.5 text-[9px] text-neutral-600">
          เครื่อง {bill.repairDetail.deviceBrand}
          {bill.repairDetail.deviceModel
            ? ` ${bill.repairDetail.deviceModel}`
            : ""}
        </p>
      ) : null}
    </div>
  );
}

function Totals({
  bill,
  compact,
}: {
  bill: BillDetail;
  compact?: boolean;
}) {
  return (
    <dl
      className={cn(
        "space-y-1 tabular-nums",
        compact ? "text-[10px]" : "text-[11px]",
      )}
    >
      <div className="flex justify-between gap-3">
        <dt className="text-neutral-600">ยอดรายการ</dt>
        <dd>{formatTHB(bill.subtotal.toString())}</dd>
      </div>
      {bill.lineDiscountTotal.gt(0) ? (
        <div className="flex justify-between gap-3">
          <dt className="text-neutral-600">ส่วนลดรายการ</dt>
          <dd>-{formatTHB(bill.lineDiscountTotal.toString())}</dd>
        </div>
      ) : null}
      {bill.discountAmount.gt(0) ? (
        <div className="flex justify-between gap-3">
          <dt className="text-neutral-600">ส่วนลดท้ายบิล</dt>
          <dd>-{formatTHB(bill.discountAmount.toString())}</dd>
        </div>
      ) : null}
      {bill.vatEnabled ? (
        <>
          <div className="flex justify-between gap-3">
            <dt className="text-neutral-600">ยอดก่อน VAT</dt>
            <dd>{formatTHB(bill.netAmountBeforeVat.toString())}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-neutral-600">
              VAT {bill.vatRate.toString()}%
            </dt>
            <dd>{formatTHB(bill.vatAmount.toString())}</dd>
          </div>
        </>
      ) : null}
      <div className="flex justify-between gap-3 border-t border-neutral-900/50 pt-1.5 text-[1.08em] font-bold">
        <dt>ยอดรวมทั้งสิ้น</dt>
        <dd>{formatTHB(bill.grandTotal.toString())}</dd>
      </div>
    </dl>
  );
}

function ThermalDocument({
  bill,
  settings,
}: {
  bill: BillDetail;
  settings: ShopSettings;
}) {
  const warning = getPrintDocumentWarning(bill.status);
  const printOptions = {
    vatEnabled: bill.vatEnabled,
    hasCustomerTaxId: Boolean(bill.customer.taxId?.trim()),
  };
  const footer =
    settings.receiptFooter?.trim() ||
    `ขอบคุณที่ใช้บริการ ${settings.shopName}`;

  return (
    <article className="print-sheet print-sheet-thermal relative overflow-hidden bg-white text-neutral-900">
      {bill.status === "VOIDED" ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <span className="rotate-[-28deg] text-5xl font-black tracking-widest text-rose-600/15">
            ยกเลิก
          </span>
        </div>
      ) : null}

      {warning ? (
        <div className="mb-2 border border-dashed border-amber-500 px-1.5 py-1 text-center text-[9px] font-medium leading-4 text-amber-800">
          {warning}
        </div>
      ) : null}

      <header className="text-center">
        <BrandLogo
          src={settings.logoUrl}
          alt={`โลโก้ ${settings.shopName}`}
          size="sm"
          tile={false}
          priority
          className="mx-auto mb-1"
        />
        <h1 className="text-[15px] font-bold leading-tight">
          {settings.shopName}
        </h1>
        {settings.address ? (
          <p className="mt-1 whitespace-pre-line text-[9px] leading-4 text-neutral-600">
            {settings.address}
          </p>
        ) : null}
        {shopContact(settings) ? (
          <p className="mt-0.5 text-[9px] leading-4 text-neutral-600">
            {shopContact(settings)}
          </p>
        ) : null}
        <div className="my-2 border-y border-dashed border-neutral-400 py-1.5">
          <p className="text-[12px] font-bold">
            {getPrintDocumentTitle(bill.status, printOptions)}
          </p>
          <p className="mt-0.5 font-mono text-[10px]">{bill.billNumber}</p>
        </div>
      </header>

      <section className="space-y-0.5 text-[9.5px] leading-4">
        <p>
          <span className="text-neutral-500">วันที่: </span>
          {formatThaiDateTime(documentDate(bill))}
        </p>
        <p>
          <span className="text-neutral-500">ลูกค้า: </span>
          {bill.customer.name}
        </p>
        <p>
          <span className="text-neutral-500">โทร: </span>
          {formatThaiPhone(bill.customer.phone)}
        </p>
        {bill.customer.address ? (
          <p>
            <span className="text-neutral-500">ที่อยู่: </span>
            {bill.customer.address}
          </p>
        ) : null}
        {bill.customer.taxId ? (
          <p>
            <span className="text-neutral-500">เลขภาษีลูกค้า: </span>
            {bill.customer.taxId}
          </p>
        ) : null}
        <p>
          <span className="text-neutral-500">ช่างผู้รับผิดชอบ: </span>
          {bill.technician.name}
        </p>
        <p>
          <span className="text-neutral-500">อ้างอิง: </span>
          {documentReference(bill)}
        </p>
      </section>

      <div className="my-2 border-t border-dashed border-neutral-400" />

      <table className="w-full table-fixed border-collapse text-[9.5px]">
        <thead>
          <tr className="border-b border-neutral-400 text-left">
            <th className="w-[48mm] pb-1 font-semibold">รายการ</th>
            <th className="w-[24mm] pb-1 text-right font-semibold">
              จำนวนเงิน
            </th>
          </tr>
        </thead>
        <tbody>
          {bill.items.map((item) => (
            <tr
              key={item.id}
              className="border-b border-dashed border-neutral-300 align-top"
            >
              <td className="py-1 pr-1">
                <ItemDescription bill={bill} item={item} />
                <p className="mt-0.5 text-[9px] text-neutral-500">
                  {item.quantity.toLocaleString("th-TH")} ×{" "}
                  {formatTHB(item.unitPrice.toString())}
                </p>
              </td>
              <td className="py-1 text-right font-medium tabular-nums">
                {formatTHB(item.lineTotal.toString())}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-2 border-t border-dashed border-neutral-400 pt-2">
        <Totals bill={bill} compact />
      </div>

      {bill.repairDetail ? (
        <section className="mt-2 border-t border-dashed border-neutral-400 pt-2 text-[9px] leading-4">
          <p className="font-semibold">ข้อมูลงานซ่อม</p>
          <p>
            {[bill.repairDetail.deviceBrand, bill.repairDetail.deviceModel]
              .filter(Boolean)
              .join(" ") || "—"}
            {bill.repairDetail.deviceSerial
              ? ` · S/N ${bill.repairDetail.deviceSerial}`
              : ""}
          </p>
          <p className="text-neutral-600">
            {bill.repairDetail.reportedSymptoms}
          </p>
        </section>
      ) : null}

      {bill.warrantyClaim ? (
        <section className="mt-2 border-t border-dashed border-neutral-400 pt-2 text-[9px] leading-4">
          <p className="font-semibold">ข้อมูลเคลม</p>
          <p>
            {bill.warrantyClaim.product.name}
            {bill.warrantyClaim.productSerial
              ? ` · S/N ${bill.warrantyClaim.productSerial.serialNumber}`
              : ""}
          </p>
          {bill.warrantyClaim.originalBill ? (
            <p className="text-neutral-600">
              บิลซื้อเดิม {bill.warrantyClaim.originalBill.billNumber}
            </p>
          ) : null}
          {bill.warrantyClaim.warrantyEndsAt ? (
            <p className="text-neutral-600">
              ประกันถึง {formatThaiDate(bill.warrantyClaim.warrantyEndsAt)}
            </p>
          ) : null}
        </section>
      ) : null}

      <div className="mt-2 border-t border-dashed border-neutral-400 pt-2 text-[9.5px]">
        <p>{paymentText(bill)}</p>
        {bill.voidReason ? (
          <p className="mt-1 text-[9px] text-rose-700">
            เหตุผลยกเลิก: {bill.voidReason}
          </p>
        ) : null}
      </div>

      <footer className="mt-3 border-t border-dashed border-neutral-400 pt-2 text-center text-[9px] leading-4">
        <p>{footer}</p>
        <p className="mt-1 text-neutral-500">
          พิมพ์เมื่อ {formatThaiDateTime(new Date())}
        </p>
      </footer>
    </article>
  );
}

function A4Document({
  bill,
  settings,
}: {
  bill: BillDetail;
  settings: ShopSettings;
}) {
  const warning = getPrintDocumentWarning(bill.status);
  const printOptions = {
    vatEnabled: bill.vatEnabled,
    hasCustomerTaxId: Boolean(bill.customer.taxId?.trim()),
  };
  const footer =
    settings.receiptFooter?.trim() ||
    `ขอบคุณที่ใช้บริการ ${settings.shopName}`;

  return (
    <article className="print-sheet print-sheet-a4 relative bg-white text-neutral-900">
      {bill.status === "VOIDED" ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <span className="rotate-[-28deg] text-[110px] font-black tracking-widest text-rose-600/10">
            ยกเลิก
          </span>
        </div>
      ) : null}

      {warning ? (
        <div className="mb-5 border border-dashed border-amber-500 bg-amber-50 px-4 py-2 text-center text-[11px] font-medium text-amber-900">
          {warning}
        </div>
      ) : null}

      <header className="flex items-start justify-between gap-8">
        <div className="flex min-w-0 items-start gap-3">
          <BrandLogo
            src={settings.logoUrl}
            alt={`โลโก้ ${settings.shopName}`}
            size="lg"
            tile={false}
            priority
          />
          <div className="min-w-0">
            <h1 className="text-[22px] font-bold leading-tight">
              {settings.shopName}
            </h1>
            {settings.address ? (
              <p className="mt-2 max-w-[95mm] whitespace-pre-line text-[10.5px] leading-5 text-neutral-600">
                {settings.address}
              </p>
            ) : null}
            {shopContact(settings) ? (
              <p className="mt-1 text-[10.5px] leading-5 text-neutral-600">
                {shopContact(settings)}
              </p>
            ) : null}
          </div>
        </div>

        <div className="w-[70mm] shrink-0 text-right">
          <p className="text-[22px] font-bold leading-tight">
            {getPrintDocumentTitle(bill.status, printOptions)}
          </p>
          <p className="mt-0.5 text-[9px] uppercase tracking-[0.16em] text-neutral-500">
            {getPrintDocumentEnglishTitle(bill.status, printOptions)}
          </p>
          <div className="mt-3 rounded-md border border-neutral-300 px-3 py-2 text-left">
            <p className="text-[9px] text-neutral-500">เลขที่เอกสาร</p>
            <p className="mt-0.5 font-mono text-[13px] font-semibold">
              {bill.billNumber}
            </p>
            <p className="mt-1.5 text-[9px] text-neutral-500">วันที่</p>
            <p className="text-[10.5px]">
              {formatThaiDateTime(documentDate(bill))}
            </p>
          </div>
        </div>
      </header>

      <div className="my-5 border-t-2 border-neutral-900" />

      <section className="grid grid-cols-2 gap-8 text-[10.5px] leading-5">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
            ลูกค้า / CUSTOMER
          </p>
          <p className="mt-1 text-[13px] font-semibold">
            {bill.customer.name}
          </p>
          <p>โทร {formatThaiPhone(bill.customer.phone)}</p>
          {bill.customer.email ? <p>{bill.customer.email}</p> : null}
          {bill.customer.address ? (
            <p className="whitespace-pre-line text-neutral-600">
              {bill.customer.address}
            </p>
          ) : null}
          {bill.customer.taxId ? (
            <p className="text-neutral-600">
              เลขประจำตัวผู้เสียภาษี {bill.customer.taxId}
            </p>
          ) : null}
        </div>

        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
            ข้อมูลบิล / BILL DETAILS
          </p>
          <dl className="mt-1 grid grid-cols-[34mm_1fr] gap-x-2 gap-y-0.5">
            <dt className="text-neutral-500">ประเภท</dt>
            <dd>
              {bill.billType.name}{" "}
              <span className="font-mono text-[9px] text-neutral-500">
                {bill.billType.code}
              </span>
            </dd>
            <dt className="text-neutral-500">ช่างผู้รับผิดชอบ</dt>
            <dd>{bill.technician.name}</dd>
            <dt className="text-neutral-500">อ้างอิง</dt>
            <dd>{documentReference(bill)}</dd>
            <dt className="text-neutral-500">สถานะ</dt>
            <dd>{getPrintDocumentTitle(bill.status, printOptions)}</dd>
          </dl>
        </div>
      </section>

      <table className="mt-5 w-full table-fixed border-collapse text-[10.5px]">
        <thead>
          <tr className="bg-neutral-100 text-left">
            <th className="w-8 border-y border-neutral-300 px-2 py-2 text-center font-semibold">
              #
            </th>
            <th className="border-y border-neutral-300 px-2 py-2 font-semibold">
              รายละเอียด
            </th>
            <th className="w-16 border-y border-neutral-300 px-2 py-2 text-right font-semibold">
              จำนวน
            </th>
            <th className="w-24 border-y border-neutral-300 px-2 py-2 text-right font-semibold">
              ราคา/หน่วย
            </th>
            <th className="w-24 border-y border-neutral-300 px-2 py-2 text-right font-semibold">
              รวม
            </th>
          </tr>
        </thead>
        <tbody>
          {bill.items.map((item, index) => (
            <tr key={item.id} className="align-top">
              <td className="border-b border-neutral-200 px-2 py-2 text-center text-[9px] text-neutral-500">
                {index + 1}
              </td>
              <td className="border-b border-neutral-200 px-2 py-2">
                <ItemDescription bill={bill} item={item} />
              </td>
              <td className="border-b border-neutral-200 px-2 py-2 text-right tabular-nums">
                {item.quantity.toLocaleString("th-TH")}
              </td>
              <td className="border-b border-neutral-200 px-2 py-2 text-right tabular-nums">
                {formatTHB(item.unitPrice.toString())}
              </td>
              <td className="border-b border-neutral-200 px-2 py-2 text-right font-medium tabular-nums">
                {formatTHB(item.lineTotal.toString())}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="mt-4 grid grid-cols-[minmax(0,1fr)_72mm] gap-8">
        <div className="space-y-3 text-[10px] leading-5 text-neutral-600">
          {bill.description ? (
            <div>
              <p className="font-semibold text-neutral-900">รายละเอียด</p>
              <p className="whitespace-pre-line">{bill.description}</p>
            </div>
          ) : null}
          {bill.note ? (
            <div>
              <p className="font-semibold text-neutral-900">หมายเหตุ</p>
              <p className="whitespace-pre-line">{bill.note}</p>
            </div>
          ) : null}
          {bill.repairDetail ? (
            <div>
              <p className="font-semibold text-neutral-900">ข้อมูลงานซ่อม</p>
              <p>
                {[
                  bill.repairDetail.deviceBrand,
                  bill.repairDetail.deviceModel,
                ]
                  .filter(Boolean)
                  .join(" ") || "—"}
                {bill.repairDetail.deviceSerial
                  ? ` · S/N ${bill.repairDetail.deviceSerial}`
                  : ""}
              </p>
              <p>อาการเสีย: {bill.repairDetail.reportedSymptoms}</p>
              {bill.repairDetail.diagnosis ? (
                <p>ผลตรวจ: {bill.repairDetail.diagnosis}</p>
              ) : null}
              {bill.repairDetail.resolution ? (
                <p>วิธีแก้ไข: {bill.repairDetail.resolution}</p>
              ) : null}
            </div>
          ) : null}
          {bill.warrantyClaim ? (
            <div>
              <p className="font-semibold text-neutral-900">ข้อมูลเคลม</p>
              <p>
                {bill.warrantyClaim.product.name}
                {bill.warrantyClaim.productSerial
                  ? ` · S/N ${bill.warrantyClaim.productSerial.serialNumber}`
                  : ""}
              </p>
              {bill.warrantyClaim.originalBill ? (
                <p>
                  บิลซื้อเดิม {bill.warrantyClaim.originalBill.billNumber}
                  {bill.warrantyClaim.originalSaleAt
                    ? ` · ${formatThaiDate(bill.warrantyClaim.originalSaleAt)}`
                    : ""}
                </p>
              ) : null}
              {bill.warrantyClaim.warrantyEndsAt ? (
                <p>
                  สิ้นสุดประกัน{" "}
                  {formatThaiDate(bill.warrantyClaim.warrantyEndsAt)}
                </p>
              ) : null}
            </div>
          ) : null}
          {bill.voidReason ? (
            <div className="rounded border border-rose-200 bg-rose-50 p-2 text-rose-800">
              <p className="font-semibold">เหตุผลการยกเลิก</p>
              <p className="whitespace-pre-line">{bill.voidReason}</p>
            </div>
          ) : null}
        </div>

        <div>
          <div className="border border-neutral-300 p-3">
            <Totals bill={bill} />
            <div className="mt-3 border-t border-neutral-200 pt-2 text-[10px] leading-5">
              <p>{paymentText(bill)}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-12 grid grid-cols-2 gap-16 text-center text-[10px] text-neutral-600">
        <div>
          <div className="mx-auto mb-2 w-[55mm] border-t border-neutral-400" />
          <p>ผู้รับสินค้า / ผู้รับบริการ</p>
          <p className="mt-1 text-[9px] text-neutral-500">
            วันที่ ........./........./..........
          </p>
        </div>
        <div>
          <div className="mx-auto mb-2 w-[55mm] border-t border-neutral-400" />
          <p>ผู้รับเงิน / ผู้มีอำนาจลงนาม</p>
          <p className="mt-1 text-[9px] text-neutral-500">
            วันที่ ........./........./..........
          </p>
        </div>
      </section>

      <footer className="mt-8 border-t border-neutral-200 pt-3 text-center text-[9.5px] leading-5 text-neutral-500">
        <p className="text-neutral-700">{footer}</p>
        <p className="mt-0.5">
          เอกสารออกโดยระบบ {settings.shopName} · พิมพ์เมื่อ{" "}
          {formatThaiDateTime(new Date())}
        </p>
      </footer>
    </article>
  );
}

export function BillPrintDocument({
  bill,
  settings,
  format,
}: BillPrintDocumentProps) {
  if (format === "thermal-80mm") {
    return <ThermalDocument bill={bill} settings={settings} />;
  }

  return <A4Document bill={bill} settings={settings} />;
}
