import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CircleAlert } from "lucide-react";

import { GoodsReceiptForm } from "@/components/inventory/goods-receipt-form";
import { buttonVariants } from "@/components/ui/button";
import { inventoryDateInputValue } from "@/lib/inventory-labels";
import { cn } from "@/lib/utils";
import { requireAdmin } from "@/server/auth/session";
import { listProductOptions } from "@/server/services/products";
import { listActiveSuppliers } from "@/server/services/suppliers";

export const instant = false;

export const metadata: Metadata = {
  title: "สร้างใบรับสินค้า",
};

export default async function NewGoodsReceiptPage() {
  const actor = await requireAdmin();
  const [suppliers, products] = await Promise.all([
    listActiveSuppliers(),
    listProductOptions({ id: actor.id, role: actor.role }),
  ]);

  const productOptions = products.map((product) => ({
    id: product.id,
    sku: product.sku,
    name: product.name,
    costPrice: product.costPrice.toFixed(2),
    stockQty: product.stockQty,
    trackSerial: product.trackSerial,
    barcodes: product.barcodes.map((barcode) => barcode.barcode),
  }));

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/inventory/receipts"
          className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          กลับรายการรับสินค้า
        </Link>
        <h2 className="text-xl font-semibold tracking-tight">
          สร้างใบรับสินค้า
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          สแกนบาร์โค้ด ระบุจำนวนและต้นทุน
          ระบบจะคำนวณต้นทุนเฉลี่ยและบันทึก stock ledger ให้อัตโนมัติ
        </p>
      </div>

      {suppliers.length === 0 ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm text-amber-900 dark:text-amber-200">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div>
            ยังไม่มีผู้จัดจำหน่ายที่เปิดใช้งาน กรุณา{" "}
            <Link
              href="/inventory/suppliers"
              className="font-semibold underline underline-offset-2"
            >
              สร้างผู้จัดจำหน่าย
            </Link>{" "}
            ก่อนทำใบรับสินค้า
          </div>
        </div>
      ) : null}

      {products.length === 0 ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm text-amber-900 dark:text-amber-200">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div>
            ยังไม่มีสินค้าที่เปิดใช้งาน กรุณา{" "}
            <Link
              href="/inventory/products/new"
              className="font-semibold underline underline-offset-2"
            >
              เพิ่มสินค้า
            </Link>{" "}
            ก่อนรับสินค้าเข้าคลัง
          </div>
        </div>
      ) : null}

      {suppliers.length > 0 && products.length > 0 ? (
        <GoodsReceiptForm
          suppliers={suppliers}
          products={productOptions}
          defaultReceivedDate={inventoryDateInputValue()}
        />
      ) : (
        <Link
          href="/inventory/receipts"
          className={cn(buttonVariants({ variant: "outline" }), "h-9")}
        >
          กลับรายการรับสินค้า
        </Link>
      )}
    </div>
  );
}
