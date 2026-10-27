import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, ClipboardList } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { suggestedReorderQuantity } from "@/lib/inventory-calculations";
import { inventoryStockLabel } from "@/lib/inventory-labels";
import { cn } from "@/lib/utils";
import { requireUser } from "@/server/auth/session";
import { listLowStockProducts } from "@/server/services/products";

export const instant = false;

export const metadata: Metadata = {
  title: "สินค้าใกล้หมด",
};

export default async function LowStockPage() {
  const actor = await requireUser();
  const products = await listLowStockProducts();
  const isAdmin = actor.role === "ADMIN";

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">สินค้าใกล้หมด</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            เรียงตามส่วนต่างจากจุดสั่งซื้อมากที่สุด เพื่อวางแผนสั่งซื้อ
          </p>
        </div>
        {isAdmin ? (
          <Link
            href="/inventory/receipts/new"
            className={cn(buttonVariants(), "h-9 self-start sm:self-auto")}
          >
            <ClipboardList aria-hidden />
            รับสินค้าเข้า
          </Link>
        ) : null}
      </div>

      {products.length === 0 ? (
        <div className="rounded-xl border bg-background px-6 py-16 text-center shadow-xs">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-300">
            <CheckCircle2 className="size-6" aria-hidden />
          </div>
          <p className="mt-3 font-medium">สต๊อกทุกรายการยังเพียงพอ</p>
          <p className="mt-1 text-sm text-muted-foreground">
            ไม่มีสินค้าที่มียอดคงเหลือต่ำกว่าหรือเท่ากับจุดสั่งซื้อ
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-background shadow-xs">
          <div className="overflow-x-auto">
            <Table className="min-w-180">
              <TableHeader>
                <TableRow>
                  <TableHead>สินค้า</TableHead>
                  <TableHead>หมวดหมู่</TableHead>
                  <TableHead className="text-right">คงเหลือ</TableHead>
                  <TableHead className="text-right">จุดสั่งซื้อ</TableHead>
                  <TableHead className="text-right">แนะนำสั่งเพิ่ม</TableHead>
                  <TableHead>ผู้จัดจำหน่ายหลัก</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <Link
                        href={`/inventory/products/${product.id}`}
                        className="font-medium hover:text-primary"
                      >
                        {product.name}
                      </Link>
                      <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                        {product.sku}
                      </p>
                    </TableCell>
                    <TableCell className="text-sm">
                      {product.category.name}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant="outline"
                        className={cn(
                          "tabular-nums",
                          product.stockQty === 0
                            ? "border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300"
                            : "border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300",
                        )}
                      >
                        {inventoryStockLabel(product.stockQty)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {product.reorderLevel}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {suggestedReorderQuantity(
                        product.stockQty,
                        product.reorderLevel,
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {product.defaultSupplier?.name ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
