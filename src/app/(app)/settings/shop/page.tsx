import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  FileText,
  Printer,
  ReceiptText,
  ShieldCheck,
  Store,
} from "lucide-react";

import { SuccessAlert } from "@/components/forms/form-feedback";
import { ShopSettingsForm } from "@/components/settings/shop-settings-form";
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
import { getShopSettings } from "@/server/services/settings";

export const instant = false;

export const metadata: Metadata = {
  title: "ข้อมูลร้านและการพิมพ์",
};

export default async function ShopSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ updated?: string }>;
}) {
  await requireAdmin();
  const [settings, query] = await Promise.all([
    getShopSettings(),
    searchParams,
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/"
          className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          กลับหน้าภาพรวม
        </Link>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              ข้อมูลร้านและการพิมพ์
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              ข้อมูลหัวใบเสร็จ ข้อความท้ายใบเสร็จ และค่า VAT สำหรับบิลใหม่
            </p>
          </div>
          <Link
            href="/settings/users"
            className={cn(buttonVariants({ variant: "outline" }), "h-9")}
          >
            จัดการผู้ใช้
          </Link>
        </div>
      </div>

      {query.updated ? (
        <SuccessAlert title="บันทึกข้อมูลร้านแล้ว">
          ใบเสร็จและเอกสารที่พิมพ์ใหม่จะใช้ข้อมูลล่าสุดนี้
          โดยบิลเดิมยังคง snapshot ยอดเงินและ VAT เดิมไว้
        </SuccessAlert>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <Card>
          <CardHeader className="border-b">
            <div className="flex items-center gap-2 text-primary">
              <Store className="size-4" aria-hidden />
              <div>
                <CardTitle>ข้อมูลร้าน</CardTitle>
                <CardDescription>
                  ชื่อร้าน โลโก้ และข้อมูลติดต่อที่แสดงบนหัวเอกสาร
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ShopSettingsForm
              settings={{
                shopName: settings.shopName,
                address: settings.address,
                phone: settings.phone,
                email: settings.email,
                taxId: settings.taxId,
                vatEnabled: settings.vatEnabled,
                vatRate: settings.vatRate.toFixed(2),
                vatIncluded: settings.vatIncluded,
                receiptFooter: settings.receiptFooter,
                logoUrl: settings.logoUrl,
              }}
            />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 text-primary">
                <Printer className="size-4" aria-hidden />
                <span className="text-xs font-semibold tracking-wide">
                  PRINT OUTPUT
                </span>
              </div>
              <CardTitle className="pt-1 text-base">รูปแบบเอกสาร</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
              <div className="flex gap-2">
                <FileText className="mt-0.5 size-4 shrink-0" aria-hidden />
                <p>
                  <span className="font-medium text-foreground">A4</span> —
                  ใบเสร็จ/ใบส่งของแบบเต็มหน้า มีช่องลงนามและรายละเอียดลูกค้า
                </p>
              </div>
              <div className="flex gap-2">
                <ReceiptText
                  className="mt-0.5 size-4 shrink-0"
                  aria-hidden
                />
                <p>
                  <span className="font-medium text-foreground">80 มม.</span> —
                  สลิปสำหรับเครื่องพิมพ์ใบเสร็จ ความกว้างกระดาษ 80 มม.
                </p>
              </div>
              <p className="rounded-lg bg-muted/50 p-3 text-xs leading-5">
                เปิดหน้าพิมพ์ได้จากรายละเอียดบิลทุกใบ
                แล้วเลือกแท็บ A4 หรือ 80 มม. ก่อนสั่งพิมพ์
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 text-primary">
                <ShieldCheck className="size-4" aria-hidden />
                <span className="text-xs font-semibold tracking-wide">
                  DATA POLICY
                </span>
              </div>
              <CardTitle className="pt-1 text-base">ผลกระทบต่อข้อมูล</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs leading-5 text-muted-foreground">
              <p>
                การเปลี่ยน VAT มีผลกับบิลใหม่เท่านั้น
                บิลเดิมเก็บ snapshot ค่า VAT ไว้แล้ว
              </p>
              <p>
                ทุกการแก้ไขถูกบันทึกใน audit log พร้อมผู้ดำเนินการและเวลา
              </p>
              <p>
                อัปเดตล่าสุด {formatThaiDateTime(settings.updatedAt)}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
