import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, Plus } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatThaiDate } from "@/lib/labels";
import { formatTHB } from "@/lib/money";
import { cn } from "@/lib/utils";
import { requireAdmin } from "@/server/auth/session";
import {
  listGoodsReceiptsPaginated,
  GOODS_RECEIPTS_PAGE_SIZE,
} from "@/server/services/goods-receipts";

export const instant = false;

export const metadata: Metadata = {
  title: "รับสินค้า",
};

export default async function GoodsReceiptsPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string | string[] }>;
}) {
  const actor = await requireAdmin();
  const query = searchParams ? await searchParams : {};
  const rawPage = Array.isArray(query.page) ? query.page[0] : query.page;
  const page = Math.max(1, parseInt(rawPage ?? "1", 10) || 1);

  const { items: receipts, totalCount, pageSize } =
    await listGoodsReceiptsPaginated(
      { id: actor.id, role: actor.role },
      { page, pageSize: GOODS_RECEIPTS_PAGE_SIZE },
    );

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">รับสินค้า</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            บันทึกการรับเข้าคลังและต้นทุนถัวเฉลี่ยจากผู้จัดจำหน่าย
          </p>
        </div>
        <Link
          href="/inventory/receipts/new"
          aria-label="สร้างใบรับสินค้า"
          className={cn(buttonVariants(), "h-9 self-start sm:self-auto")}
        >
          <Plus aria-hidden />
          สร้างใบรับสินค้า
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border bg-background shadow-xs">
        <div className="overflow-x-auto">
          <Table className="min-w-170">
            <TableHeader>
              <TableRow>
                <TableHead>เลขที่ใบรับ</TableHead>
                <TableHead>วันที่รับ</TableHead>
                <TableHead>ผู้จัดจำหน่าย</TableHead>
                <TableHead className="text-right">รายการ</TableHead>
                <TableHead className="text-right">ต้นทุนรวม</TableHead>
                <TableHead className="text-right">ดู</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {receipts.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-14 text-center text-sm text-muted-foreground"
                  >
                    <ClipboardList
                      className="mx-auto mb-2 size-6 text-muted-foreground/60"
                      aria-hidden
                    />
                    ยังไม่มีใบรับสินค้า
                  </TableCell>
                </TableRow>
              ) : (
                receipts.map((receipt) => (
                  <TableRow key={receipt.id}>
                    <TableCell>
                      <Link
                        href={`/inventory/receipts/${receipt.id}`}
                        className="font-mono text-sm font-semibold text-primary hover:underline"
                      >
                        {receipt.receiptNo}
                      </Link>
                      {receipt.note ? (
                        <p className="mt-0.5 max-w-56 truncate text-[11px] text-muted-foreground">
                          {receipt.note}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {formatThaiDate(receipt.receivedAt)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {receipt.supplier.name}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {receipt._count.items}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatTHB(receipt.totalCost.toString())}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/inventory/receipts/${receipt.id}`}
                        className={cn(
                          buttonVariants({ variant: "ghost", size: "sm" }),
                        )}
                      >
                        เปิด
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Pagination
        page={page}
        totalCount={totalCount}
        pageSize={pageSize}
        basePath="/inventory/receipts"
      />
    </div>
  );
}
