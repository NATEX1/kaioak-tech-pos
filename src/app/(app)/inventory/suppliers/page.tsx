import type { Metadata } from "next";
import Link from "next/link";
import { Pencil, Plus, Store } from "lucide-react";

import { SuccessAlert } from "@/components/forms/form-feedback";
import { InventoryStatusForm } from "@/components/inventory/inventory-status-form";
import { SupplierForm } from "@/components/inventory/supplier-form";
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
import { cn } from "@/lib/utils";
import { requireAdmin } from "@/server/auth/session";
import { listSuppliers } from "@/server/services/suppliers";

export const instant = false;

export const metadata: Metadata = {
  title: "ผู้จัดจำหน่าย",
};

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const actor = await requireAdmin();
  const [suppliers, query] = await Promise.all([
    listSuppliers({ id: actor.id, role: actor.role }),
    searchParams,
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">ผู้จัดจำหน่าย</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          ใช้สำหรับใบรับสินค้าและผู้จัดจำหน่ายหลักของสินค้า
        </p>
      </div>

      {query.archived ? (
        <SuccessAlert title="เก็บผู้จัดจำหน่ายถาวรแล้ว">
          ประวัติใบรับสินค้ายังคงอยู่ และกู้คืนได้ภายหลัง
        </SuccessAlert>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="overflow-hidden rounded-xl border bg-background shadow-xs">
          <div className="border-b px-4 py-3">
            <h3 className="font-semibold">
              ผู้จัดจำหน่ายทั้งหมด ({suppliers.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <Table className="min-w-160">
              <TableHeader>
                <TableRow>
                  <TableHead>ชื่อ</TableHead>
                  <TableHead>ผู้ติดต่อ</TableHead>
                  <TableHead className="text-right">ใบรับสินค้า</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead className="text-right">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-12 text-center text-sm text-muted-foreground"
                    >
                      ยังไม่มีผู้จัดจำหน่าย
                    </TableCell>
                  </TableRow>
                ) : (
                  suppliers.map((supplier) => (
                    <TableRow key={supplier.id}>
                      <TableCell>
                        <Link
                          href={`/inventory/suppliers/${supplier.id}`}
                          className="font-medium hover:text-primary"
                        >
                          {supplier.name}
                        </Link>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {supplier.phone || supplier.email || "—"}
                        </p>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {supplier.contactName || "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {supplier._count.goodsReceipts}
                      </TableCell>
                      <TableCell>
                        {supplier.deletedAt ? (
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
                            href={`/inventory/suppliers/${supplier.id}`}
                            className={cn(
                              buttonVariants({ variant: "ghost", size: "sm" }),
                            )}
                          >
                            <Pencil aria-hidden />
                            แก้ไข
                          </Link>
                          <InventoryStatusForm
                            kind="supplier"
                            id={supplier.id}
                            active={!supplier.deletedAt}
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
                <CardTitle>เพิ่มผู้จัดจำหน่าย</CardTitle>
                <CardDescription>ข้อมูลติดต่อสำหรับสั่งซื้อ</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <SupplierForm mode="create" />
          </CardContent>
        </Card>
      </div>

      <p className="text-[11px] text-muted-foreground">
        <Store className="mr-1 inline size-3.5" aria-hidden />
        ผู้จัดจำหน่ายที่เก็บถาวรจะไม่ปรากฏในตัวเลือกใบรับสินค้าใหม่
        แต่ประวัติยังคงอยู่
      </p>
    </div>
  );
}
