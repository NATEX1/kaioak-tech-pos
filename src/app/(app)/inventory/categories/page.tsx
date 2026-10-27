import type { Metadata } from "next";
import Link from "next/link";
import { FolderTree, Pencil, Plus } from "lucide-react";

import { SuccessAlert } from "@/components/forms/form-feedback";
import { CategoryForm } from "@/components/inventory/category-form";
import { InventoryStatusForm } from "@/components/inventory/inventory-status-form";
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
import { formatThaiDate } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { requireAdmin } from "@/server/auth/session";
import { listCategories } from "@/server/services/categories";

export const instant = false;

export const metadata: Metadata = {
  title: "หมวดหมู่สินค้า",
};

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const actor = await requireAdmin();
  const [categories, query] = await Promise.all([
    listCategories({ id: actor.id, role: actor.role }),
    searchParams,
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">หมวดหมู่สินค้า</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          ใช้รหัสหมวดหมู่เป็น Prefix สำหรับสร้าง SKU อัตโนมัติ
        </p>
      </div>

      {query.archived ? (
        <SuccessAlert title="เก็บหมวดหมู่ถาวรแล้ว">
          ประวัติสินค้ายังคงอยู่ และสามารถกู้คืนหมวดหมู่ได้ภายหลัง
        </SuccessAlert>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="overflow-hidden rounded-xl border bg-background shadow-xs">
          <div className="border-b px-4 py-3">
            <h3 className="font-semibold">หมวดหมู่ทั้งหมด ({categories.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <Table className="min-w-150">
              <TableHeader>
                <TableRow>
                  <TableHead>รหัส</TableHead>
                  <TableHead>ชื่อ</TableHead>
                  <TableHead className="text-right">สินค้าใช้งาน</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead className="text-right">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-12 text-center text-sm text-muted-foreground"
                    >
                      ยังไม่มีหมวดหมู่
                    </TableCell>
                  </TableRow>
                ) : (
                  categories.map((category) => (
                    <TableRow key={category.id}>
                      <TableCell className="font-mono text-sm font-semibold">
                        {category.code}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/inventory/categories/${category.id}`}
                          className="font-medium hover:text-primary"
                        >
                          {category.name}
                        </Link>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          สร้าง {formatThaiDate(category.createdAt)}
                        </p>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {category._count.products}
                      </TableCell>
                      <TableCell>
                        {category.deletedAt ? (
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
                      <TableCell>
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          <Link
                            href={`/inventory/categories/${category.id}`}
                            className={cn(
                              buttonVariants({ variant: "ghost", size: "sm" }),
                            )}
                          >
                            <Pencil aria-hidden />
                            แก้ไข
                          </Link>
                          <InventoryStatusForm
                            kind="category"
                            id={category.id}
                            active={!category.deletedAt}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <Card>
          <CardHeader className="border-b">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Plus className="size-4" aria-hidden />
              </div>
              <div>
                <CardTitle>เพิ่มหมวดหมู่</CardTitle>
                <CardDescription>รหัสจะใช้สร้าง SKU</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <CategoryForm mode="create" />
          </CardContent>
        </Card>
      </div>

      <p className="text-[11px] text-muted-foreground">
        <FolderTree className="mr-1 inline size-3.5" aria-hidden />
        ไม่สามารถเก็บหมวดหมู่ถาวรได้ขณะยังมีสินค้าเปิดใช้งานอยู่
      </p>
    </div>
  );
}
