import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  Contact,
  FileClock,
  ShieldCheck,
  UserRoundPlus,
} from "lucide-react";

import { CustomerForm } from "@/components/customers/customer-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireUser } from "@/server/auth/session";

export const instant = false;

export const metadata: Metadata = {
  title: "เพิ่มลูกค้า",
};

export default async function NewCustomerPage() {
  const actor = await requireUser();

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/customers"
          className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          กลับรายชื่อลูกค้า
        </Link>
        <h2 className="text-xl font-semibold tracking-tight">เพิ่มลูกค้าใหม่</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          เก็บข้อมูลติดต่อสำหรับการขาย งานซ่อม บริการ และการเคลม
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeader className="border-b">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <UserRoundPlus className="size-4" aria-hidden />
              </div>
              <div>
                <CardTitle>ข้อมูลลูกค้า</CardTitle>
                <CardDescription>
                  ชื่อและเบอร์โทรเป็นข้อมูลบังคับ
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <CustomerForm mode="create" />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="border-b">
              <CardTitle className="text-base">สิทธิ์การใช้งาน</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs leading-5 text-muted-foreground">
              <p className="flex gap-2">
                <Contact className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                {actor.role === "ADMIN"
                  ? "คุณสามารถเพิ่ม แก้ไข เก็บถาวร และกู้คืนลูกค้าได้"
                  : "คุณสามารถดูข้อมูลและเพิ่มลูกค้าใหม่ได้ ส่วนการแก้ไขหรือเก็บถาวรเป็นสิทธิ์ของผู้ดูแลระบบ"}
              </p>
              <p className="flex gap-2">
                <ShieldCheck
                  className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-300"
                  aria-hidden
                />
                เบอร์โทรถูก normalize และต้องไม่ซ้ำกับลูกค้าทั้งที่ใช้งานและที่เก็บถาวร
              </p>
              <p className="flex gap-2">
                <FileClock
                  className="mt-0.5 size-4 shrink-0 text-blue-600 dark:text-blue-300"
                  aria-hidden
                />
                เมื่อเริ่มใช้งานบิล ประวัติการซื้อและบริการจะแสดงในโปรไฟล์ลูกค้าโดยอัตโนมัติ
              </p>
            </CardContent>
          </Card>

          <Card size="sm" className="bg-muted/30">
            <CardContent className="text-xs leading-5 text-muted-foreground">
              หลังสร้างแล้ว คุณจะถูกพาไปยังโปรไฟล์ลูกค้า
              เพื่อตรวจสอบข้อมูลและเพิ่มข้อมูลติดต่อส่วนที่เหลือได้
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
