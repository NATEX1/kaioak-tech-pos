import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  CircleCheck,
  Clock3,
  LockKeyhole,
  ShieldCheck,
  Wrench,
} from "lucide-react";

import { LoginForm } from "@/components/auth/login-form";
import { BrandMark } from "@/components/brand/brand-mark";
import { ErrorAlert, SuccessAlert } from "@/components/forms/form-feedback";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { safeInternalPath } from "@/lib/safe-redirect";
import { getCurrentUser } from "@/server/auth/session";
import { getShopSettings } from "@/server/services/settings";

export const instant = false;

export const metadata: Metadata = {
  title: "เข้าสู่ระบบ",
};

type LoginSearchParams = {
  next?: string | string[];
  reason?: string | string[];
  error?: string | string[];
  code?: string | string[];
};

function single(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<LoginSearchParams>;
}) {
  const params = await searchParams;
  const nextPath = safeInternalPath(single(params.next));
  const [currentUser, settings] = await Promise.all([
    getCurrentUser(),
    getShopSettings(),
  ]);

  if (currentUser) {
    redirect(nextPath);
  }

  const reason = single(params.reason);
  const error = single(params.error);
  const code = single(params.code);

  return (
    <main className="relative min-h-svh overflow-hidden bg-[#071331] text-slate-50">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,oklch(0.48_0.15_254/0.35),transparent_32%),radial-gradient(circle_at_85%_75%,oklch(0.6_0.12_180/0.2),transparent_30%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#f4cb62]/80 to-transparent"
      />
      <div className="relative mx-auto grid min-h-svh w-full max-w-7xl items-center gap-10 px-5 py-8 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:px-10">
        <section className="hidden max-w-xl space-y-8 lg:block">
          <BrandMark
            shopName={settings.shopName}
            logoUrl={settings.logoUrl}
            size="md"
            subtitle="ระบบขายหน้าร้านและงานซ่อม"
            textClassName="text-slate-50"
            subtitleClassName="text-slate-400"
            priority
          />

          <div className="space-y-4">
            <Badge className="bg-white/10 text-slate-100 ring-1 ring-white/15">
              <ShieldCheck aria-hidden />
              ข้อมูลร้านและลูกค้าอยู่ในที่เดียว
            </Badge>
            <h1 className="text-4xl font-semibold leading-tight tracking-tight text-balance xl:text-5xl">
              ทำงานหน้าร้าน
              <span className="text-blue-300"> อย่างมั่นใจ</span>
              <br />
              ทุกบิลตรวจสอบย้อนกลับได้
            </h1>
            <p className="max-w-lg text-base leading-7 text-slate-300">
              เข้าสู่ระบบด้วยบัญชีที่ผู้ดูแลระบบสร้างให้
              ระบบแยกสิทธิ์ผู้ดูแลและช่างเทคนิค
              พร้อมบันทึกเหตุการณ์ด้านความปลอดภัยทุกครั้ง
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              {
                icon: Clock3,
                title: "ออกจากระบบอัตโนมัติ",
                detail: "เมื่อไม่ใช้งานครบ 30 นาที",
              },
              {
                icon: LockKeyhole,
                title: "รหัสผ่านปลอดภัย",
                detail: "จัดเก็บแบบเข้ารหัส ไม่เก็บข้อความจริง",
              },
              {
                icon: ShieldCheck,
                title: "กันการเดารหัสผ่าน",
                detail: "ผิดเกิน 5 ครั้ง ระบบล็อกชั่วคราว 15 นาที",
              },
              {
                icon: Wrench,
                title: "เห็นข้อมูลตามหน้าที่",
                detail: "ผู้ดูแลเห็นทั้งร้าน ช่างเห็นเฉพาะงานของตน",
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="rounded-xl border border-white/10 bg-white/5 p-3.5 backdrop-blur"
                >
                  <Icon className="size-4 text-blue-300" aria-hidden />
                  <p className="mt-2 text-sm font-medium">{item.title}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">
                    {item.detail}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mx-auto w-full max-w-md">
          <Card className="border border-border/70 bg-card text-card-foreground shadow-2xl shadow-black/30 ring-1 ring-black/10 dark:ring-white/10">
            <CardHeader className="space-y-2 pb-2">
              <div className="flex items-center justify-between gap-3 lg:hidden">
                <BrandMark
                  shopName={settings.shopName}
                  logoUrl={settings.logoUrl}
                  size="sm"
                  subtitle={null}
                  priority
                />
              </div>
              <CardTitle className="pt-2 text-2xl">เข้าสู่ระบบ</CardTitle>
              <CardDescription>
                ใช้บัญชีผู้ดูแลระบบหรือช่างเทคนิคของร้าน
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {reason === "session-expired" ? (
                <ErrorAlert title="เซสชันหมดอายุ">
                  กรุณาเข้าสู่ระบบใหม่อีกครั้ง
                </ErrorAlert>
              ) : null}

              {reason === "account-unavailable" ? (
                <ErrorAlert title="บัญชีไม่พร้อมใช้งาน">
                  บัญชีนี้ถูกปิดใช้งานหรือถูกเปลี่ยนสิทธิ์
                  กรุณาติดต่อผู้ดูแลระบบ
                </ErrorAlert>
              ) : null}

              {reason === "password-changed" ? (
                <SuccessAlert title="เปลี่ยนรหัสผ่านแล้ว">
                  ออกจากระบบทุกอุปกรณ์เรียบร้อย กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่
                </SuccessAlert>
              ) : null}

              {reason === "logged-out" ? (
                <SuccessAlert title="ออกจากระบบแล้ว">
                  ขอบคุณที่ใช้งาน {settings.shopName}
                </SuccessAlert>
              ) : null}

              {error ? (
                <ErrorAlert>
                  {code === "rate_limited"
                    ? "พยายามเข้าสู่ระบบเกินกำหนด กรุณารออีก 15 นาที"
                    : "ไม่สามารถเข้าสู่ระบบได้ กรุณาตรวจสอบข้อมูลอีกครั้ง"}
                </ErrorAlert>
              ) : null}

              <LoginForm nextPath={nextPath} />
            </CardContent>
          </Card>

          <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-xs text-slate-400">
            <CircleCheck className="size-3.5" aria-hidden />
            ข้อมูลการเข้าสู่ระบบถูกบันทึกเพื่อการตรวจสอบ
          </p>
        </section>
      </div>
    </main>
  );
}
