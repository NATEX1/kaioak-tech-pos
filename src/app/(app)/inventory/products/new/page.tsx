import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { ProductForm } from "@/components/inventory/product-form";
import { listActiveCategories } from "@/server/services/categories";
import { listActiveSuppliers } from "@/server/services/suppliers";
import { requireAdmin } from "@/server/auth/session";

export const instant = false;

export const metadata: Metadata = {
  title: "เพิ่มสินค้า",
};

export default async function NewProductPage() {
  await requireAdmin();
  const [categories, suppliers] = await Promise.all([
    listActiveCategories(),
    listActiveSuppliers(),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/inventory/products"
          className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          กลับรายการสินค้า
        </Link>
        <h2 className="text-xl font-semibold tracking-tight">เพิ่มสินค้าใหม่</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          กำหนดข้อมูลหลัก ราคา และบาร์โค้ดเริ่มต้น จากนั้นรับสินค้าเข้าผ่านใบรับ
        </p>
      </div>

      {categories.length === 0 ? (
        <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm text-amber-900 dark:text-amber-200">
          ยังไม่มีหมวดหมู่ที่เปิดใช้งาน กรุณา{" "}
          <Link
            href="/inventory/categories"
            className="font-semibold underline underline-offset-2"
          >
            สร้างหมวดหมู่
          </Link>{" "}
          ก่อนเพิ่มสินค้า
        </div>
      ) : null}

      <ProductForm
        mode="create"
        categories={categories}
        suppliers={suppliers}
      />
    </div>
  );
}
