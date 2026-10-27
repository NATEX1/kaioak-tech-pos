import { PrintButton } from "@/components/printing/print-button";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  printFormatHref,
  printFormatLabel,
  type PrintFormat,
} from "@/lib/print-documents";

type BillPrintToolbarProps = {
  billId: string;
  billNumber: string;
  customerName: string;
  documentTitle: string;
  format: PrintFormat;
};

export function BillPrintToolbar({
  billId,
  billNumber,
  customerName,
  documentTitle,
  format,
}: BillPrintToolbarProps) {
  return (
    <div className="mx-auto w-full max-w-5xl print:hidden">
      <div className="flex flex-col gap-4 rounded-xl border bg-background p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            ตัวอย่างก่อนพิมพ์
          </p>
          <h1 className="mt-1 font-mono text-lg font-semibold tracking-tight">
            {billNumber}
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {customerName} · {documentTitle} ·{" "}
            {printFormatLabel(format)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border bg-muted/30 p-1">
            <a
              href={printFormatHref(billId, "a4")}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                format === "a4"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
              aria-current={format === "a4" ? "page" : undefined}
            >
              A4
            </a>
            <a
              href={printFormatHref(billId, "thermal-80mm")}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                format === "thermal-80mm"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
              aria-current={
                format === "thermal-80mm" ? "page" : undefined
              }
            >
              80 มม.
            </a>
          </div>
          <a
            href={`/bills/${billId}`}
            className={cn(buttonVariants({ variant: "outline" }), "h-9")}
          >
            กลับบิล
          </a>
          <PrintButton label="พิมพ์เอกสาร" />
        </div>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        {format === "a4"
          ? "ตั้งค่ากระดาษ A4, Margin ไม่ต้องเพิ่ม และ Scale 100%"
          : "ตั้งค่ากระดาษ 80 มม., Margin 0 และ Scale 100% ก่อนพิมพ์"}
        {" · "}เอกสารที่ไม่ใช่บิลชำระแล้วจะมีข้อความกำกับว่าเป็นตัวอย่าง
      </p>
    </div>
  );
}
