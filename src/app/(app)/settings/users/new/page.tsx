import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, KeyRound, ShieldCheck, UsersRound } from "lucide-react";

import { CreateUserForm } from "@/components/users/create-user-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireAdmin } from "@/server/auth/session";

export const instant = false;

export const metadata: Metadata = {
  title: "เพิ่มผู้ใช้",
};

export default async function NewUserPage() {
  await requireAdmin();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/settings/users"
          className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          กลับรายชื่อผู้ใช้
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          เพิ่มผู้ใช้ใหม่
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          กำหนดบทบาทและรหัสผ่านชั่วคราวสำหรับเข้าสู่ระบบครั้งแรก
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.4fr_0.6fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-primary">
              <UsersRound className="size-4" aria-hidden />
              <span className="text-xs font-semibold tracking-wide">
                NEW ACCOUNT
              </span>
            </div>
            <CardTitle className="pt-1 text-lg">ข้อมูลบัญชี</CardTitle>
            <CardDescription>
              อีเมลต้องไม่ซ้ำกับบัญชีที่มีอยู่ และจะถูกแปลงเป็นตัวพิมพ์เล็ก
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateUserForm />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 text-primary">
                <ShieldCheck className="size-4" aria-hidden />
                <span className="text-xs font-semibold tracking-wide">
                  ACCESS POLICY
                </span>
              </div>
              <CardTitle className="pt-1 text-base">สิทธิ์ตามบทบาท</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
              <div>
                <p className="font-medium text-foreground">ผู้ดูแลระบบ</p>
                <p>จัดการผู้ใช้ สินค้า บิล รายงาน และอนุมัติ/ยกเลิกบิล</p>
              </div>
              <div>
                <p className="font-medium text-foreground">ช่างเทคนิค</p>
                <p>สร้างและแก้ไขบิลของตนเองในสถานะ draft</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 text-primary">
                <KeyRound className="size-4" aria-hidden />
                <span className="text-xs font-semibold tracking-wide">
                  PASSWORD
                </span>
              </div>
              <CardTitle className="pt-1 text-base">การส่งมอบรหัสผ่าน</CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-6 text-muted-foreground">
              ระบบยังไม่ส่งอีเมลอัตโนมัติ ผู้ดูแลต้องส่งรหัสผ่านชั่วคราวให้ผู้ใช้
              ผ่านช่องทางที่ปลอดภัย และแนะนำให้เปลี่ยนรหัสผ่านหลังเข้าใช้งาน
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
