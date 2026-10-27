import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Barcode,
  Download,
  PackagePlus,
  ScanBarcode,
  Search,
  TriangleAlert,
  Upload,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { isLowStock } from "@/lib/inventory-calculations";
import { inputClassName, selectClassName } from "@/lib/form-styles";
import { formatTHB } from "@/lib/money";
import { cn } from "@/lib/utils";
import { requireUser } from "@/server/auth/session";
import { listActiveCategories } from "@/server/services/categories";
import {
  findExactProductId,
  listProductsPaginated,
  PRODUCTS_PAGE_SIZE,
} from "@/server/services/products";

export const instant = false;

export const metadata: Metadata = {
  title: "รายการสินค้า",
};

type ProductSearchParams = {
  q?: string | string[];
  category?: string | string[];
  status?: string | string[];
  low?: string | string[];
  page?: string | string[];
};

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function statusLabel(status: "active" | "archived" | "all"): string {
  return status === "archived"
    ? "เก็บถาวร"
    : status === "all"
      ? "ทั้งหมด"
      : "เปิดใช้งาน";
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<ProductSearchParams>;
}) {
  const actor = await requireUser();
  const serviceActor = { id: actor.id, role: actor.role };
  const isAdmin = actor.role === "ADMIN";
  const query = await searchParams;
  const q = first(query.q).trim();
  const categoryId = first(query.category);
  const rawStatus = first(query.status);
  const status =
    rawStatus === "archived" || rawStatus === "all" ? rawStatus : "active";
  const lowStockOnly = first(query.low) === "1";
  const page = Math.max(1, parseInt(first(query.page), 10) || 1);

  if (q) {
    const exactProductId = await findExactProductId(serviceActor, q);
    if (exactProductId) {
      redirect(`/inventory/products/${exactProductId}`);
    }
  }

  const [{ items: products, totalCount, pageSize }, categories] =
    await Promise.all([
      listProductsPaginated(serviceActor, {
        query: q,
        categoryId: categoryId || undefined,
        status: isAdmin ? status : "active",
        lowStockOnly,
        page,
        pageSize: PRODUCTS_PAGE_SIZE,
      }),
      listActiveCategories(),
    ]);

  const hasFilters = Boolean(q || categoryId || lowStockOnly);

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">รายการสินค้า</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            สแกนบาร์โค้ดแล้วกด Enter เพื่อเปิดสินค้าได้ทันที
          </p>
        </div>
        {isAdmin ? (
          <div className="flex flex-wrap gap-2">
            <Link
              href="/inventory/products/new"
              className={cn(buttonVariants(), "h-9")}
            >
              <PackagePlus aria-hidden />
              เพิ่มสินค้า
            </Link>
            <Link
              href="/inventory/import"
              className={cn(buttonVariants({ variant: "outline" }), "h-9")}
            >
              <Upload aria-hidden />
              นำเข้า CSV
            </Link>
            <Link
              href="/api/inventory/products/export"
              className={cn(buttonVariants({ variant: "outline" }), "h-9")}
            >
              <Download aria-hidden />
              ส่งออก
            </Link>
          </div>
        ) : null}
      </div>

      <form
        action="/inventory/products"
        method="get"
        className="rounded-xl border bg-background p-3 shadow-xs"
      >
        <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_220px_150px_auto_auto]">
          <div className="relative">
            <ScanBarcode
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              name="q"
              defaultValue={q}
              autoFocus
              autoComplete="off"
              className={cn(inputClassName, "pl-9 font-mono")}
              placeholder="สแกนบาร์โค้ด หรือค้นหาชื่อ / SKU"
              aria-label="สแกนบาร์โค้ดหรือค้นหาสินค้า"
            />
          </div>

          <select
            name="category"
            defaultValue={categoryId}
            className={selectClassName}
            aria-label="กรองตามหมวดหมู่"
          >
            <option value="">ทุกหมวดหมู่</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.code} · {category.name}
              </option>
            ))}
          </select>

          {isAdmin ? (
            <select
              name="status"
              defaultValue={status}
              className={selectClassName}
              aria-label="กรองตามสถานะ"
            >
              <option value="active">เปิดใช้งาน</option>
              <option value="archived">เก็บถาวร</option>
              <option value="all">ทั้งหมด</option>
            </select>
          ) : (
            <div className="hidden md:block" />
          )}

          <label className="inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm">
            <input
              type="checkbox"
              name="low"
              value="1"
              defaultChecked={lowStockOnly}
              className="size-4 accent-primary"
            />
            ใกล้หมด
          </label>

          <div className="flex gap-2">
            <button
              type="submit"
              className={cn(buttonVariants(), "h-10 flex-1 md:flex-none")}
            >
              <Search aria-hidden />
              ค้นหา
            </button>
            {hasFilters ? (
              <Link
                href="/inventory/products"
                className={cn(
                  buttonVariants({ variant: "ghost" }),
                  "h-10 px-3",
                )}
              >
                ล้าง
              </Link>
            ) : null}
          </div>
        </div>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          พบ {products.length.toLocaleString("th-TH")} รายการ
          {q ? (
            <>
              {" "}
              สำหรับ “<span className="font-medium text-foreground">{q}</span>”
            </>
          ) : null}
          {isAdmin && status !== "active" ? ` · ${statusLabel(status)}` : ""}
        </p>
        {q && products.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            ไม่พบสินค้าที่ตรงกัน ลองสแกนบาร์โค้ดอีกครั้งหรือค้นหาด้วยชื่อ
          </p>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-xl border bg-background shadow-xs">
        <ul className="divide-y lg:hidden">
          {products.length === 0 ? (
            <li className="px-4 py-12 text-center text-sm text-muted-foreground">
              ไม่พบสินค้า
            </li>
          ) : (
            products.map((product) => {
              const primaryBarcode =
                product.barcodes.find((barcode) => barcode.isPrimary) ??
                product.barcodes[0];
              const low = isLowStock(product.stockQty, product.reorderLevel);

              return (
                <li key={product.id} className="px-4 py-5">
                  <div className="flex items-start justify-between gap-3">
                    <Link
                      href={`/inventory/products/${product.id}`}
                      className="font-medium hover:text-primary"
                    >
                      {product.name}
                    </Link>
                    {product.deletedAt ? (
                      <Badge variant="outline" className="shrink-0">
                        เก็บถาวร
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="shrink-0 border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300"
                      >
                        เปิดใช้งาน
                      </Badge>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="font-mono">{product.sku}</span>
                    {primaryBarcode ? (
                      <span className="inline-flex items-center gap-1 font-mono">
                        <Barcode className="size-3" aria-hidden />
                        {primaryBarcode.barcode}
                      </span>
                    ) : (
                      <span>ไม่มีบาร์โค้ด</span>
                    )}
                    {product.trackSerial ? (
                      <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
                        Serial
                      </Badge>
                    ) : null}
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <p className="text-xs">
                      คงเหลือ{" "}
                      <span
                        className={cn(
                          "font-semibold tabular-nums",
                          low && "text-amber-700 dark:text-amber-300",
                        )}
                      >
                        {product.stockQty.toLocaleString("th-TH")}
                      </span>
                      {low ? (
                        <TriangleAlert
                          className="ml-1 inline size-3.5 text-amber-600 dark:text-amber-300"
                          aria-label="ต่ำกว่าจุดสั่งซื้อ"
                        />
                      ) : null}
                    </p>
                    <p className="shrink-0 text-sm font-semibold tabular-nums">
                      {formatTHB(product.salePrice.toString())}
                    </p>
                  </div>
                  {isAdmin ? (
                    <div className="mt-3 flex justify-end">
                      <Link
                        href={`/inventory/products/${product.id}/edit`}
                        className={cn(
                          buttonVariants({ variant: "outline", size: "sm" }),
                        )}
                      >
                        แก้ไข
                      </Link>
                    </div>
                  ) : null}
                </li>
              );
            })
          )}
        </ul>
        <div className="hidden overflow-x-auto lg:block">
          <Table className="min-w-220">
            <TableHeader>
              <TableRow>
                <TableHead>สินค้า</TableHead>
                <TableHead>หมวดหมู่</TableHead>
                <TableHead className="text-right">คงเหลือ</TableHead>
                <TableHead className="text-right">ราคาขาย</TableHead>
                {isAdmin ? (
                  <TableHead className="text-right">ต้นทุนเฉลี่ย</TableHead>
                ) : null}
                <TableHead>สถานะ</TableHead>
                <TableHead className="text-right">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={isAdmin ? 7 : 6}
                    className="py-12 text-center text-sm text-muted-foreground"
                  >
                    ไม่พบสินค้า
                  </TableCell>
                </TableRow>
              ) : (
                products.map((product) => {
                  const primaryBarcode =
                    product.barcodes.find((barcode) => barcode.isPrimary) ??
                    product.barcodes[0];
                  const low = isLowStock(
                    product.stockQty,
                    product.reorderLevel,
                  );

                  return (
                    <TableRow key={product.id}>
                      <TableCell>
                        <Link
                          href={`/inventory/products/${product.id}`}
                          className="font-medium hover:text-primary"
                        >
                          {product.name}
                        </Link>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                          <span className="font-mono">{product.sku}</span>
                          {primaryBarcode ? (
                            <span className="inline-flex items-center gap-1 font-mono">
                              <Barcode className="size-3" aria-hidden />
                              {primaryBarcode.barcode}
                            </span>
                          ) : (
                            <span>ไม่มีบาร์โค้ด</span>
                          )}
                          {product.trackSerial ? (
                            <Badge
                              variant="outline"
                              className="h-4 px-1.5 text-[10px]"
                            >
                              Serial
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {product.category.name}
                        <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                          {product.category.code}
                        </p>
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={cn(
                            "font-semibold tabular-nums",
                            low && "text-amber-700 dark:text-amber-300",
                          )}
                        >
                          {product.stockQty.toLocaleString("th-TH")}
                        </span>
                        {low ? (
                          <TriangleAlert
                            className="ml-1 inline size-3.5 text-amber-600 dark:text-amber-300"
                            aria-label="ต่ำกว่าจุดสั่งซื้อ"
                          />
                        ) : null}
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          จุดสั่ง {product.reorderLevel}
                        </p>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatTHB(product.salePrice.toString())}
                      </TableCell>
                      {isAdmin ? (
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {formatTHB(product.costPrice.toString())}
                        </TableCell>
                      ) : null}
                      <TableCell>
                        {product.deletedAt ? (
                          <Badge variant="outline">เก็บถาวร</Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300"
                          >
                            เปิดใช้งาน
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Link
                            href={`/inventory/products/${product.id}`}
                            className={cn(
                              buttonVariants({ variant: "ghost", size: "sm" }),
                            )}
                          >
                            ดู
                          </Link>
                          {isAdmin ? (
                            <Link
                              href={`/inventory/products/${product.id}/edit`}
                              className={cn(
                                buttonVariants({
                                  variant: "outline",
                                  size: "sm",
                                }),
                              )}
                            >
                              แก้ไข
                            </Link>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Pagination
        page={page}
        totalCount={totalCount}
        pageSize={pageSize}
        basePath="/inventory/products"
      />

      {isAdmin ? (
        <p className="text-[11px] text-muted-foreground">
          ต้นทุนในตารางเป็นต้นทุนถัวเฉลี่ยจากใบรับสินค้า
          และจะเปลี่ยนเมื่อรับสินค้าเข้าหรือปรับยอดเพิ่มเท่านั้น
        </p>
      ) : null}
    </div>
  );
}
