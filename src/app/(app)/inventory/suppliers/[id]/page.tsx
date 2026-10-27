import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ClipboardList } from "lucide-react";

import { SuccessAlert } from "@/components/forms/form-feedback";
import { InventoryStatusForm } from "@/components/inventory/inventory-status-form";
import { SupplierForm } from "@/components/inventory/supplier-form";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatThaiDateTime } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { requireAdmin } from "@/server/auth/session";
import { getSupplierById } from "@/server/services/suppliers";

export const instant = false;

export const metadata: Metadata = {
  title: "แก้ไขผู้จัดจำหน่าย",
};

export default async function SupplierDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    created?: string;
    updated?: string;
    restored?: string;
  }>;
}) {
  const actor = await requireAdmin();
  const { id } = await params;
  const [supplier, query] = await Promise.all([
    getSupplierById({ id: actor.id, role: actor.role }, id),
    searchParams,
  ]);

  if (!supplier) {
    notFound();
  }

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/inventory/suppliers"
          className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          กลับผู้จัดจำหน่าย
        </Link>
        <h2 className="text-xl font-semibold tracking-tight">{supplier.name}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          สร้างเมื่อ {formatThaiDateTime(supplier.createdAt)} · ใบรับสินค้า{" "}
          {supplier._count.goodsReceipts} ใบ · สินค้าอ้างอิง{" "}
          {supplier._count.products} รายการ
        </p>
      </div>

      {query.created ? (
        <SuccessAlert title="สร้างผู้จัดจำหน่ายแล้ว">
          สามารถเลือกผู้จัดจำหน่ายนี้ในใบรับสินค้าได้ทันที
        </SuccessAlert>
      ) : null}
      {query.updated ? (
        <SuccessAlert title="บันทึกแล้ว">ข้อมูลผู้จัดจำหน่ายอัปเดตแล้ว</SuccessAlert>
      ) : null}
      {query.restored ? (
        <SuccessAlert title="กู้คืนผู้จัดจำหน่ายแล้ว">
          กลับมาเลือกใช้ในใบรับสินค้าได้อีกครั้ง
        </SuccessAlert>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeader className="border-b">
            <CardTitle>แก้ไขข้อมูลผู้จัดจำหน่าย</CardTitle>
            <CardDescription>ข้อมูลติดต่อและเลขผู้เสียภาษี</CardDescription>
          </CardHeader>
          <CardContent>
            <SupplierForm
              mode="edit"
              supplierId={supplier.id}
              initial={{
                name: supplier.name,
                contactName: supplier.contactName ?? "",
                phone: supplier.phone ?? "",
                email: supplier.email ?? "",
                address: supplier.address ?? "",
                taxId: supplier.taxId ?? "",
                note: supplier.note ?? "",
              }}
            />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="border-b">
              <CardTitle>สถานะ</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <InventoryStatusForm
                kind="supplier"
                id={supplier.id}
                active={!supplier.deletedAt}
              />
              <Link
                href="/inventory/receipts"
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "h-9 w-full",
                )}
              >
                <ClipboardList aria-hidden />
                ดูประวัติใบรับสินค้า
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
