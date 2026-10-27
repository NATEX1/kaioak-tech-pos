import { notFound } from "next/navigation";

import { BillPrintDocument } from "@/components/printing/bill-print-document";
import { BillPrintToolbar } from "@/components/printing/bill-print-toolbar";
import { getPrintDocumentTitle, type PrintFormat } from "@/lib/print-documents";
import { requireUser } from "@/server/auth/session";
import { getBillById } from "@/server/services/bills";
import { getShopSettings } from "@/server/services/settings";

type BillPrintPageProps = {
  billId: string;
  format: PrintFormat;
};

export async function BillPrintPage({
  billId,
  format,
}: BillPrintPageProps) {
  const actor = await requireUser();
  const [bill, settings] = await Promise.all([
    getBillById({ id: actor.id, role: actor.role }, billId),
    getShopSettings(),
  ]);

  if (!bill) {
    notFound();
  }

  const pageStyle =
    format === "a4"
      ? "@media print { @page { size: A4; margin: 0; } }"
      : "@media print { @page { size: 80mm auto; margin: 4mm; } }";

  return (
    <div className="print-page min-h-svh bg-muted/40 px-3 py-5 print:min-h-0 print:bg-white print:p-0 sm:px-6 sm:py-8">
      <style>{pageStyle}</style>
      <BillPrintToolbar
        billId={bill.id}
        billNumber={bill.billNumber}
        customerName={bill.customer.name}
        documentTitle={getPrintDocumentTitle(bill.status)}
        format={format}
      />

      <div className="mt-4 overflow-x-auto print:mt-0 print:overflow-visible">
        <div className="mx-auto w-fit print:w-auto">
          <BillPrintDocument
            bill={bill}
            settings={settings}
            format={format}
          />
        </div>
      </div>
    </div>
  );
}
