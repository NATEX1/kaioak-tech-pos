import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { toSVG } from "bwip-js/node";
import { ArrowLeft, Barcode, TriangleAlert } from "lucide-react";

import { PrintButton } from "@/components/inventory/print-button";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { inputClassName, selectClassName } from "@/lib/form-styles";
import { formatTHB } from "@/lib/money";
import { cn } from "@/lib/utils";
import { requireAdmin } from "@/server/auth/session";
import { getProductById } from "@/server/services/products";
import { getShopSettings } from "@/server/services/settings";

export const instant = false;

export const metadata: Metadata = {
  title: "พิมพ์ป้ายบาร์โค้ด",
};

function barcodeSvg(barcode: string, type: "CODE128" | "EAN13"): string | null {
  try {
    return toSVG({
      bcid: type === "EAN13" ? "ean13" : "code128",
      text: barcode,
      scale: 2,
      height: 10,
      includetext: false,
      paddingwidth: 0,
      paddingheight: 0,
      backgroundcolor: "FFFFFF",
    });
  } catch {
    return null;
  }
}

export default async function ProductLabelPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ barcodeId?: string; copies?: string }>;
}) {
  const actor = await requireAdmin();
  const { id } = await params;
  const [product, settings, query] = await Promise.all([
    getProductById({ id: actor.id, role: actor.role }, id),
    getShopSettings(),
    searchParams,
  ]);

  if (!product) {
    notFound();
  }

  const selectedBarcode =
    product.barcodes.find((barcode) => barcode.id === query.barcodeId) ??
    product.barcodes.find((barcode) => barcode.isPrimary) ??
    product.barcodes[0];

  const requestedCopies = Number(query.copies ?? 1);
  const copies = Number.isFinite(requestedCopies)
    ? Math.min(60, Math.max(1, Math.trunc(requestedCopies)))
    : 1;
  const svg = selectedBarcode
    ? barcodeSvg(selectedBarcode.barcode, selectedBarcode.type)
    : null;

  return (
    <div className="space-y-5">
      <div className="print:hidden">
        <Link
          href={`/inventory/products/${product.id}`}
          className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          กลับรายละเอียดสินค้า
        </Link>
        <h2 className="text-xl font-semibold tracking-tight">
          พิมพ์ป้ายบาร์โค้ด
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {product.name} · {product.sku}
        </p>
      </div>

      {!selectedBarcode ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 print:hidden">
          <div className="flex gap-2">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            สินค้านี้ยังไม่มีบาร์โค้ด กรุณาเพิ่มบาร์โค้ดก่อนพิมพ์ป้าย
          </div>
        </div>
      ) : (
        <>
          <form
            action={`/inventory/products/${product.id}/label`}
            method="get"
            className="grid gap-3 rounded-xl border bg-background p-4 shadow-xs print:hidden sm:grid-cols-[minmax(0,1fr)_110px_auto_auto] sm:items-end"
          >
            <div className="space-y-2">
              <Label htmlFor="barcodeId">บาร์โค้ดที่จะพิมพ์</Label>
              <select
                id="barcodeId"
                name="barcodeId"
                defaultValue={selectedBarcode.id}
                className={selectClassName}
              >
                {product.barcodes.map((barcode) => (
                  <option key={barcode.id} value={barcode.id}>
                    {barcode.barcode}
                    {barcode.isPrimary ? " (หลัก)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="copies">จำนวนป้าย</Label>
              <Input
                id="copies"
                name="copies"
                type="number"
                min={1}
                max={60}
                defaultValue={copies}
                className={inputClassName}
              />
            </div>
            <button
              type="submit"
              className={cn(buttonVariants({ variant: "outline" }), "h-10")}
            >
              แสดงตัวอย่าง
            </button>
            <PrintButton />
          </form>

          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground print:hidden">
            <span className="inline-flex items-center gap-1">
              <Barcode className="size-3.5" aria-hidden />
              {selectedBarcode.barcode}
            </span>
            <span>·</span>
            <span>{copies} ดวง · กระดาษ A4</span>
            <span>·</span>
            <span>ป้ายขนาด 60 × 35 มม.</span>
          </div>

          <div className="label-sheet flex flex-wrap gap-2 print:gap-0">
            {Array.from({ length: copies }, (_, index) => {
              return (
                <div
                  key={index}
                  className="label-card flex h-[35mm] w-[60mm] break-inside-avoid flex-col justify-between overflow-hidden border border-dashed border-neutral-300 bg-white p-2 text-neutral-900"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[7px] font-semibold uppercase tracking-[0.15em] text-neutral-500">
                        {settings.shopName}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-[10px] font-semibold leading-tight">
                        {product.name}
                      </p>
                    </div>
                    <p className="shrink-0 text-[10px] font-bold">
                      {formatTHB(product.salePrice.toString())}
                    </p>
                  </div>

                  <div className="mt-1 flex min-h-0 flex-1 items-center justify-center overflow-hidden">
                    {svg ? (
                      <div
                        className="label-barcode w-full [&>svg]:h-auto [&>svg]:max-h-[13mm] [&>svg]:w-full"
                        dangerouslySetInnerHTML={{ __html: svg }}
                      />
                    ) : (
                      <p className="font-mono text-xs">
                        {selectedBarcode.barcode}
                      </p>
                    )}
                  </div>

                  <div className="flex items-end justify-between gap-2">
                    <p className="font-mono text-[8px] leading-none">
                      {selectedBarcode.barcode}
                    </p>
                    <p className="font-mono text-[7px] leading-none text-neutral-500">
                      {product.sku}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
