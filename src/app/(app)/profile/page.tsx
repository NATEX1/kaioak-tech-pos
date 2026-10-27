import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  Clock3,
  KeyRound,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { RoleBadge } from "@/components/users/user-badges";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatThaiDateTime, roleLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { requireUser } from "@/server/auth/session";

export const instant = false;

export const metadata: Metadata = {
  title: "โปรไฟล์ของฉัน",
};

export default async function ProfilePage() {
  const user = await requireUser();

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
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          โปรไฟล์ของฉัน
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          ข้อมูลบัญชี ความปลอดภัย และการเปลี่ยนรหัสผ่าน
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-primary">
              <UserRound className="size-4" aria-hidden />
              <span className="text-xs font-semibold tracking-wide">
                MY ACCOUNT
              </span>
            </div>
            <CardTitle className="pt-1 text-lg">ข้อมูลบัญชี</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3 border-b pb-3">
              <span className="text-muted-foreground">ชื่อ</span>
              <span className="text-right font-medium">{user.name}</span>
            </div>
            <div className="flex items-center justify-between gap-3 border-b pb-3">
              <span className="text-muted-foreground">อีเมล</span>
              <span className="max-w-56 truncate font-medium">{user.email}</span>
            </div>
            <div className="flex items-center justify-between gap-3 border-b pb-3">
              <span className="text-muted-foreground">บทบาท</span>
              <RoleBadge role={user.role} />
            </div>
            <div className="flex items-start justify-between gap-3 border-b pb-3">
              <span className="text-muted-foreground">เข้าสู่ระบบล่าสุด</span>
              <span className="text-right font-medium">
                {formatThaiDateTime(user.lastLoginAt)}
              </span>
            </div>
            <p className="text-xs leading-5 text-muted-foreground">
              สิทธิ์การใช้งานปัจจุบัน: {roleLabel(user.role)} ·
              ตรวจสอบจากฐานข้อมูลทุกคำขอ
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-primary">
              <KeyRound className="size-4" aria-hidden />
              <span className="text-xs font-semibold tracking-wide">
                CHANGE PASSWORD
              </span>
            </div>
            <CardTitle className="pt-1 text-lg">เปลี่ยนรหัสผ่าน</CardTitle>
            <CardDescription>
              ต้องยืนยันรหัสผ่านปัจจุบัน และระบบจะออกจากทุก session
              หลังเปลี่ยนสำเร็จ
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-primary">
            <ShieldCheck className="size-4" aria-hidden />
            <span className="text-xs font-semibold tracking-wide">
              SESSION POLICY
            </span>
          </div>
          <CardTitle className="pt-1 text-base">นโยบายความปลอดภัย</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          {[
            {
              icon: Clock3,
              title: "ไม่ใช้งาน 30 นาที",
              detail: "ระบบออกจากระบบอัตโนมัติเมื่อไม่มีการใช้งาน",
            },
            {
              icon: ShieldCheck,
              title: "สูงสุด 12 ชั่วโมง",
              detail: "ต้องเข้าสู่ระบบใหม่เมื่อครบกำหนด absolute session",
            },
            {
              icon: KeyRound,
              title: "ยกเลิก session ได้",
              detail: "การเปลี่ยนรหัสผ่านหรือสิทธิ์จะยกเลิก session เดิม",
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="flex gap-3 rounded-xl border bg-muted/25 p-3"
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-background text-primary ring-1">
                  <Icon className="size-4" aria-hidden />
                </div>
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                    {item.detail}
                  </p>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {user.role === "ADMIN" ? (
        <Link
          href="/settings/users"
          className={cn(buttonVariants({ variant: "outline" }), "h-9")}
        >
          ไปหน้าจัดการผู้ใช้
        </Link>
      ) : null}
    </div>
  );
}
