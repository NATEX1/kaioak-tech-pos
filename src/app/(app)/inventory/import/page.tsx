import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowDownToLine,
  FileSpreadsheet,
  Info,
  Upload,
} from "lucide-react";

import { SuccessAlert } from "@/components/forms/form-feedback";
import { ProductImportForm } from "@/components/inventory/product-import-form";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { requireAdmin } from "@/server/auth/session";
import { productCsvHeaders } from "@/server/validators/inventory";

export const instant = false;

export const metadata: Metadata = {
  title: "นำเข้าและส่งออกสินค้า CSV",
};

export default async function ProductImportPage({
  searchParams,
}: {
  searchParams: Promise<{
    created?: string;
    updated?: string;
    total?: string;
  }>;
}) {
  await requireAdmin();
  const query = await searchParams;
  const total = Number(query.total ?? 0);
  const created = Number(query.created ?? 0);
  const updated = Number(query.updated ?? 0);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">
          นำเข้า / ส่งออกสินค้า CSV
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          ใช้สร้างหรือปรับปรุงข้อมูลหลักของสินค้าครั้งละหลายรายการ
          โดยไม่แตะยอดสต๊อก
        </p>
      </div>

      {total > 0 ? (
        <SuccessAlert title="นำเข้าข้อมูลสำเร็จ">
          ทั้งหมด {total.toLocaleString("th-TH")} แถว · สร้างใหม่{" "}
          {created.toLocaleString("th-TH")} · อัปเดต{" "}
          {updated.toLocaleString("th-TH")}
        </SuccessAlert>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader className="border-b">
            <CardTitle>นำเข้าไฟล์</CardTitle>
            <CardDescription>
              ไฟล์ต้องมีหัวคอลัมน์ตรงตามรูปแบบที่กำหนด
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProductImportForm />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="border-b">
              <div className="flex items-center gap-2">
                <ArrowDownToLine className="size-4 text-primary" aria-hidden />
                <CardTitle>ส่งออกข้อมูลปัจจุบัน</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                ดาวน์โหลดสินค้าที่เปิดใช้งานทั้งหมดเป็น CSV
                พร้อมบาร์โค้ดและต้นทุน เพื่อแก้ไขแล้วนำกลับเข้าได้
              </p>
              <Link
                href="/api/inventory/products/export"
                className={cn(buttonVariants({ variant: "outline" }), "h-9")}
              >
                <ArrowDownToLine aria-hidden />
                ดาวน์โหลด CSV
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="size-4 text-primary" aria-hidden />
                <CardTitle>หัวคอลัมน์</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5">
                {productCsvHeaders.map((header) => (
                  <code
                    key={header}
                    className="rounded border bg-muted/40 px-1.5 py-0.5 font-mono text-[10px]"
                  >
                    {header}
                  </code>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <div className="flex items-center gap-2">
                <Info className="size-4 text-primary" aria-hidden />
                <CardTitle>กติกาสำคัญ</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-muted-foreground">
              <p>
                • SKU ต้องไม่ซ้ำและใช้สร้างหรืออัปเดตสินค้า
                (ต้องมีอยู่ในระบบหรือสร้างใหม่ได้)
              </p>
              <p>
                • หมวดหมู่ต้องมีอยู่และเปิดใช้งานแล้ว
                ระบบจะไม่สร้างหมวดหมู่อัตโนมัติ
              </p>
              <p>
                • ต้นทุนเปลี่ยนได้เฉพาะสินค้าที่ยังไม่มีสต๊อก
                หากมีสต๊อกแล้วให้ใช้ใบรับสินค้า
              </p>
              <p>
                • บาร์โค้ดหลายรายการคั่นด้วย | และนำเข้าเป็น Code 128
                ระบบจะเพิ่มบาร์โค้ดที่ไม่ซ้ำ แต่จะไม่ลบบาร์โค้ดเดิมที่ไม่อยู่ในไฟล์
              </p>
              <p>
                • การนำเข้าไม่เปลี่ยนยอดสต๊อกหรือสถานะเก็บถาวรของสินค้า
              </p>
            </CardContent>
          </Card>

          <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-900 dark:text-amber-200">
            <div className="flex gap-2">
              <Upload className="mt-0.5 size-4 shrink-0" aria-hidden />
              <p>
                แนะนำให้ส่งออกก่อนแก้ไขทุกครั้ง และเก็บสำรองไฟล์ไว้ก่อนนำเข้า
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
