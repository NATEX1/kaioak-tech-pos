import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  ClipboardList,
  PackagePlus,
  PackageSearch,
  TriangleAlert,
  WalletCards,
} from "lucide-react";

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
  inventoryStockLabel,
  stockMovementTypeLabel,
} from "@/lib/inventory-labels";
import { suggestedReorderQuantity } from "@/lib/inventory-calculations";
import { formatThaiDateTime } from "@/lib/labels";
import { formatTHB } from "@/lib/money";
import { cn } from "@/lib/utils";
import { requireUser } from "@/server/auth/session";
import {
  getInventorySummary,
  listLowStockProducts,
} from "@/server/services/products";
import { listStockMovements } from "@/server/services/stock";

export const instant = false;

export const metadata: Metadata = {
  title: "ภาพรวมสินค้าและสต๊อก",
};

export default async function InventoryOverviewPage() {
  const actor = await requireUser();
  const serviceActor = { id: actor.id, role: actor.role };
  const isAdmin = actor.role === "ADMIN";

  const [summary, lowStock, recentMovements] = await Promise.all([
    getInventorySummary(serviceActor),
    listLowStockProducts(),
    isAdmin
      ? listStockMovements(serviceActor, { take: 8 })
      : Promise.resolve([]),
  ]);

  const stats = [
    {
      label: "รายการสินค้า",
      value: summary.productCount.toLocaleString("th-TH"),
      icon: PackageSearch,
    },
    {
      label: "ชิ้นในสต๊อก",
      value: summary.stockUnits.toLocaleString("th-TH"),
      icon: Boxes,
    },
    {
      label: "ต่ำกว่าจุดสั่งซื้อ",
      value: summary.lowStockCount.toLocaleString("th-TH"),
      icon: TriangleAlert,
      warning: summary.lowStockCount > 0,
    },
    ...(summary.stockValue
      ? [
          {
            label: "มูลค่าสต๊อกตามต้นทุนเฉลี่ย",
            value: formatTHB(summary.stockValue.toString()),
            icon: WalletCards,
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">ภาพรวมสต๊อก</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            ตรวจยอดคงเหลือและรายการที่ต้องสั่งซื้อเพิ่ม
          </p>
        </div>
        {isAdmin ? (
          <div className="flex flex-wrap gap-2">
            <Link
              href="/inventory/receipts/new"
              className={cn(buttonVariants(), "h-9")}
            >
              <ClipboardList aria-hidden />
              รับสินค้าเข้า
            </Link>
            <Link
              href="/inventory/products/new"
              className={cn(buttonVariants({ variant: "outline" }), "h-9")}
            >
              <PackagePlus aria-hidden />
              เพิ่มสินค้า
            </Link>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} size="sm">
              <CardContent className="flex items-center gap-3">
                <div
                  className={cn(
                    "hidden size-10 shrink-0 items-center justify-center rounded-xl sm:flex",
                    stat.warning
                      ? "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300"
                      : "bg-primary/10 text-primary",
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-lg font-semibold leading-tight">
                    {stat.value}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {stat.label}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <Card className="py-0">
          <CardHeader className="border-b py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle>สินค้าที่ควรสั่งเพิ่ม</CardTitle>
                <CardDescription>
                  สินค้าที่มียอดคงเหลือต่ำกว่าหรือเท่ากับจุดสั่งซื้อ
                </CardDescription>
              </div>
              <Link
                href="/inventory/low-stock"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                ดูทั้งหมด
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="px-0">
            {lowStock.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                ยังไม่มีสินค้าใกล้หมด
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>สินค้า</TableHead>
                      <TableHead className="text-right">คงเหลือ</TableHead>
                      <TableHead className="text-right">จุดสั่งซื้อ</TableHead>
                      <TableHead className="text-right">แนะนำสั่ง</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lowStock.slice(0, 6).map((product) => (
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
                        <TableCell className="text-right font-semibold text-amber-700 dark:text-amber-300">
                          {inventoryStockLabel(product.stockQty)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {product.reorderLevel}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {suggestedReorderQuantity(
                            product.stockQty,
                            product.reorderLevel,
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {isAdmin ? (
          <Card className="py-0">
            <CardHeader className="border-b py-4">
              <div className="flex items-center justify-between gap-2">
                <CardTitle>ความเคลื่อนไหวล่าสุด</CardTitle>
                <Link
                  href="/inventory/stock"
                  className="text-xs font-medium text-primary hover:underline"
                >
                  ดูทั้งหมด
                </Link>
              </div>
            </CardHeader>
            <CardContent className="px-0">
              {recentMovements.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                  ยังไม่มีการเคลื่อนไหว
                </p>
              ) : (
                <ul className="divide-y">
                  {recentMovements.map((movement) => (
                    <li key={movement.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Link
                            href={`/inventory/products/${movement.product.id}`}
                            className="truncate text-sm font-medium hover:text-primary"
                          >
                            {movement.product.name}
                          </Link>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {stockMovementTypeLabel(movement.type)} ·{" "}
                            {formatThaiDateTime(movement.createdAt)}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            "shrink-0 tabular-nums",
                            movement.quantityDelta > 0
                              ? "border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300"
                              : "border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300",
                          )}
                        >
                          {movement.quantityDelta > 0 ? "+" : ""}
                          {movement.quantityDelta}
                        </Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>ค้นหาสินค้าด้วยบาร์โค้ด</CardTitle>
              <CardDescription>
                ใช้ช่องค้นหาในหน้ารายการสินค้า สแกนบาร์โค้ดแล้วกด Enter
                ระบบจะเปิดสินค้าที่ตรงกันทันที
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link
                href="/inventory/products"
                className={cn(buttonVariants({ variant: "outline" }), "h-9")}
              >
                <PackageSearch aria-hidden />
                ไปที่รายการสินค้า
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
