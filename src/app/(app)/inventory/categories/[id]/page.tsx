import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, PackageSearch } from "lucide-react";

import { SuccessAlert } from "@/components/forms/form-feedback";
import { CategoryForm } from "@/components/inventory/category-form";
import { InventoryStatusForm } from "@/components/inventory/inventory-status-form";
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
import { getCategoryById } from "@/server/services/categories";

export const instant = false;

export const metadata: Metadata = {
  title: "แก้ไขหมวดหมู่",
};

export default async function CategoryDetailPage({
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
  const [category, query] = await Promise.all([
    getCategoryById({ id: actor.id, role: actor.role }, id),
    searchParams,
  ]);

  if (!category) {
    notFound();
  }

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/inventory/categories"
          className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          กลับหมวดหมู่
        </Link>
        <h2 className="text-xl font-semibold tracking-tight">
          {category.code} · {category.name}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          สร้างเมื่อ {formatThaiDateTime(category.createdAt)} · สินค้าใช้งาน{" "}
          {category._count.products} รายการ
        </p>
      </div>

      {query.created ? (
        <SuccessAlert title="สร้างหมวดหมู่แล้ว">
          สามารถใช้หมวดหมู่นี้สร้าง SKU อัตโนมัติได้ทันที
        </SuccessAlert>
      ) : null}
      {query.updated ? (
        <SuccessAlert title="บันทึกแล้ว">ข้อมูลหมวดหมู่อัปเดตแล้ว</SuccessAlert>
      ) : null}
      {query.restored ? (
        <SuccessAlert title="กู้คืนหมวดหมู่แล้ว">
          หมวดหมู่นี้กลับมาใช้งานได้อีกครั้ง
        </SuccessAlert>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeader className="border-b">
            <CardTitle>แก้ไขหมวดหมู่</CardTitle>
            <CardDescription>รหัสหมวดหมู่ไม่สามารถแก้ไขได้</CardDescription>
          </CardHeader>
          <CardContent>
            <CategoryForm
              mode="edit"
              categoryId={category.id}
              initial={{
                code: category.code,
                name: category.name,
                description: category.description ?? "",
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
                kind="category"
                id={category.id}
                active={!category.deletedAt}
              />
              <Link
                href={`/inventory/products?category=${category.id}`}
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "h-9 w-full",
                )}
              >
                <PackageSearch aria-hidden />
                ดูสินค้าในหมวดนี้
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
