import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftRight, Search } from "lucide-react";

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
import type { StockMovementType } from "@/generated/prisma/enums";
import { stockMovementTypeLabel } from "@/lib/inventory-labels";
import { selectClassName } from "@/lib/form-styles";
import { formatThaiDateTime } from "@/lib/labels";
import { formatTHB } from "@/lib/money";
import { Pagination } from "@/components/ui/pagination";
import { cn } from "@/lib/utils";
import { requireAdmin } from "@/server/auth/session";
import { listProductOptions } from "@/server/services/products";
import {
  listStockMovementsPaginated,
  STOCK_MOVEMENTS_PAGE_SIZE,
} from "@/server/services/stock";

export const instant = false;

export const metadata: Metadata = {
  title: "ความเคลื่อนไหวสต๊อก",
};

const movementTypes: StockMovementType[] = [
  "GOODS_RECEIPT",
  "SALE",
  "ADJUSTMENT",
  "VOID_RESTOCK",
  "CLAIM",
  "RETURN",
];

function isMovementType(value: string): value is StockMovementType {
  return (movementTypes as string[]).includes(value);
}

export default async function StockLedgerPage({
  searchParams,
}: {
  searchParams: Promise<{
    product?: string;
    type?: string;
    page?: string;
  }>;
}) {
  const actor = await requireAdmin();
  const query = await searchParams;
  const page = Math.max(1, parseInt(query.page ?? "1", 10) || 1);
  const productId = query.product?.trim() || undefined;
  const type = query.type && isMovementType(query.type) ? query.type : undefined;

  const [movementResult, products] = await Promise.all([
    listStockMovementsPaginated(
      { id: actor.id, role: actor.role },
      { productId, type, page, pageSize: STOCK_MOVEMENTS_PAGE_SIZE },
    ),
    listProductOptions({ id: actor.id, role: actor.role }),
  ]);

  const movements = movementResult.items;
  const preserveParams: Record<string, string | undefined> = {
    ...(productId ? { product: productId } : {}),
    ...(type ? { type } : {}),
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">
          ความเคลื่อนไหวสต๊อก
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Stock ledger ทุกครั้งที่ยอดเปลี่ยน พร้อมยอดคงเหลือหลังทำรายการ
        </p>
      </div>

      <form
        action="/inventory/stock"
        method="get"
        className="grid gap-2 rounded-xl border bg-background p-3 shadow-xs md:grid-cols-[minmax(0,1fr)_220px_auto_auto]"
      >
        <select
          name="product"
          defaultValue={productId ?? ""}
          className={selectClassName}
          aria-label="กรองตามสินค้า"
        >
          <option value="">ทุกสินค้า</option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.sku} · {product.name}
            </option>
          ))}
        </select>
        <select
          name="type"
          defaultValue={type ?? ""}
          className={selectClassName}
          aria-label="กรองตามประเภท"
        >
          <option value="">ทุกประเภท</option>
          {movementTypes.map((movementType) => (
            <option key={movementType} value={movementType}>
              {stockMovementTypeLabel(movementType)}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className={cn(buttonVariants(), "h-10")}
        >
          <Search aria-hidden />
          กรอง
        </button>
        {productId || type ? (
          <Link
            href="/inventory/stock"
            className={cn(buttonVariants({ variant: "ghost" }), "h-10")}
          >
            ล้าง
          </Link>
        ) : (
          <span />
        )}
      </form>

      <div className="overflow-hidden rounded-xl border bg-background shadow-xs">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-medium">
            ล่าสุด {movements.length.toLocaleString("th-TH")} รายการ
          </p>
          <p className="text-[11px] text-muted-foreground">แสดงสูงสุด 200</p>
        </div>
        <div className="overflow-x-auto">
          <Table className="min-w-190">
            <TableHeader>
              <TableRow>
                <TableHead>วันที่</TableHead>
                <TableHead>สินค้า</TableHead>
                <TableHead>ประเภท</TableHead>
                <TableHead className="text-right">เปลี่ยนแปลง</TableHead>
                <TableHead className="text-right">คงเหลือ</TableHead>
                <TableHead className="text-right">ต้นทุน/หน่วย</TableHead>
                <TableHead>อ้างอิง</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-14 text-center text-sm text-muted-foreground"
                  >
                    <ArrowLeftRight
                      className="mx-auto mb-2 size-6 text-muted-foreground/60"
                      aria-hidden
                    />
                    ไม่พบความเคลื่อนไหวตามเงื่อนไข
                  </TableCell>
                </TableRow>
              ) : (
                movements.map((movement) => (
                  <TableRow key={movement.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatThaiDateTime(movement.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/inventory/products/${movement.product.id}`}
                        className="font-medium hover:text-primary"
                      >
                        {movement.product.name}
                      </Link>
                      <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                        {movement.product.sku}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {stockMovementTypeLabel(movement.type)}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-semibold tabular-nums",
                        movement.quantityDelta > 0
                          ? "text-emerald-700 dark:text-emerald-300"
                          : "text-rose-700 dark:text-rose-300",
                      )}
                    >
                      {movement.quantityDelta > 0 ? "+" : ""}
                      {movement.quantityDelta}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {movement.balanceAfter}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {movement.unitCost
                        ? formatTHB(movement.unitCost.toString())
                        : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {movement.goodsReceiptItem ? (
                        <Link
                          href={`/inventory/receipts/${movement.goodsReceiptItem.goodsReceipt.id}`}
                          className="font-mono text-primary hover:underline"
                        >
                          {movement.goodsReceiptItem.goodsReceipt.receiptNo}
                        </Link>
                      ) : (
                        <span className="line-clamp-2 max-w-56">
                          {movement.note || "—"}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <Pagination
          page={movementResult.page}
          pageSize={movementResult.pageSize}
          totalCount={movementResult.totalCount}
          basePath="/inventory/stock"
          preserveParams={preserveParams}
        />
      </div>

      <p className="text-[11px] text-muted-foreground">
        ยอดคงเหลือทุกแถวเป็นค่าที่บันทึก ณ เวลานั้น ไม่ได้คำนวณย้อนหลัง
      </p>
    </div>
  );
}
