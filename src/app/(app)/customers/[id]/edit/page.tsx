import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ReceiptText, ShieldCheck } from "lucide-react";

import { CustomerForm } from "@/components/customers/customer-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatThaiDateTime } from "@/lib/labels";
import { formatThaiPhone } from "@/lib/phone";
import { requireAdmin } from "@/server/auth/session";
import { getCustomerById } from "@/server/services/customers";

export const instant = false;

export const metadata: Metadata = {
  title: "แก้ไขลูกค้า",
};

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requireAdmin();
  const { id } = await params;
  const customer = await getCustomerById(
    { id: actor.id, role: actor.role },
    id,
  );

  if (!customer) {
    notFound();
  }

  return (
    <div className="space-y-5">
      <div>
        <Link
          href={`/customers/${customer.id}`}
          className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          กลับโปรไฟล์ลูกค้า
        </Link>
        <h2 className="text-xl font-semibold tracking-tight">
          แก้ไข · {customer.name}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatThaiPhone(customer.phone)} · แก้ไขล่าสุด{" "}
          {formatThaiDateTime(customer.updatedAt)}
        </p>
      </div>

      {customer.deletedAt ? (
        <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm leading-6 text-amber-900 dark:text-amber-200">
          ลูกค้ารายนี้อยู่ในสถานะเก็บถาวร
          การแก้ไขข้อมูลไม่ทำให้กลับมาใช้งานอัตโนมัติ
          ต้องกดกู้คืนจากโปรไฟล์ลูกค้า
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeader className="border-b">
            <CardTitle>ข้อมูลลูกค้า</CardTitle>
            <CardDescription>
              การแก้ไขจะถูกบันทึกใน Audit Log พร้อมผู้ดำเนินการ
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CustomerForm
              mode="edit"
              customerId={customer.id}
              initial={{
                name: customer.name,
                phone: formatThaiPhone(customer.phone),
                email: customer.email ?? "",
                address: customer.address ?? "",
                taxId: customer.taxId ?? "",
                note: customer.note ?? "",
              }}
            />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="border-b">
              <div className="flex items-center gap-2">
                <ReceiptText className="size-4 text-primary" aria-hidden />
                <CardTitle className="text-base">ประวัติที่เกี่ยวข้อง</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p className="font-medium">
                {customer._count.bills.toLocaleString("th-TH")} บิลทั้งหมด
              </p>
              <p className="text-xs leading-5 text-muted-foreground">
                ประวัติจะไม่หายเมื่อแก้ไขข้อมูลหรือเก็บลูกค้าถาวร
              </p>
            </CardContent>
          </Card>

          <Card size="sm" className="bg-muted/30">
            <CardContent className="flex gap-2 text-xs leading-5 text-muted-foreground">
              <ShieldCheck
                className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-300"
                aria-hidden
              />
              เบอร์โทรถูกจัดเก็บแบบ normalize และ unique
              เพื่อป้องกันข้อมูลลูกค้าซ้ำซ้อน
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
