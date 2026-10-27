import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Clock3,
  KeyRound,
  Phone,
  ShieldAlert,
  UserRound,
} from "lucide-react";

import { ErrorAlert, SuccessAlert } from "@/components/forms/form-feedback";
import { EditUserForm } from "@/components/users/edit-user-form";
import { ResetPasswordForm } from "@/components/users/reset-password-form";
import { RoleBadge, UserStatusBadge } from "@/components/users/user-badges";
import { UserStatusForm } from "@/components/users/user-status-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatThaiDateTime } from "@/lib/labels";
import { requireAdmin } from "@/server/auth/session";
import { getUserById } from "@/server/services/users";
import { userIdSchema } from "@/server/validators/users";

export const instant = false;

export const metadata: Metadata = {
  title: "รายละเอียดผู้ใช้",
};

type UserPageSearchParams = {
  created?: string | string[];
  updated?: string | string[];
  "password-reset"?: string | string[];
  status?: string | string[];
};

export default async function UserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<UserPageSearchParams>;
}) {
  const actor = await requireAdmin();
  const { id } = await params;
  const parsedId = userIdSchema.safeParse(id);

  if (!parsedId.success) {
    notFound();
  }

  const user = await getUserById(
    { id: actor.id, role: actor.role },
    parsedId.data,
  );

  if (!user) {
    notFound();
  }

  const query = await searchParams;
  const isSelf = actor.id === user.id;

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

        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <RoleBadge role={user.role} />
              <UserStatusBadge active={user.isActive} />
              {isSelf ? (
                <span className="text-xs font-medium text-muted-foreground">
                  บัญชีที่กำลังใช้งาน
                </span>
              ) : null}
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
              {user.name}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>
      </div>

      {query.created ? (
        <SuccessAlert title="สร้างบัญชีผู้ใช้แล้ว">
          กรุณาส่งรหัสผ่านชั่วคราวให้ผู้ใช้ผ่านช่องทางที่ปลอดภัย
          และแนะนำให้เปลี่ยนรหัสผ่านเมื่อเข้าใช้งานครั้งแรก
        </SuccessAlert>
      ) : null}

      {query.updated ? (
        <SuccessAlert title="บันทึกข้อมูลแล้ว">
          ข้อมูลบัญชีถูกอัปเดตเรียบร้อย
        </SuccessAlert>
      ) : null}

      {query["password-reset"] ? (
        <SuccessAlert title="ตั้งรหัสผ่านใหม่แล้ว">
          session เดิมของผู้ใช้นี้ถูกยกเลิกทั้งหมด
          กรุณาส่งรหัสผ่านใหม่ผ่านช่องทางที่ปลอดภัย
        </SuccessAlert>
      ) : null}

      {query.status === "active" ? (
        <SuccessAlert title="เปิดใช้งานบัญชีแล้ว">
          ผู้ใช้สามารถเข้าสู่ระบบได้ด้วยรหัสผ่านเดิม
        </SuccessAlert>
      ) : null}

      {query.status === "inactive" ? (
        <SuccessAlert title="ปิดใช้งานบัญชีแล้ว">
          session ทั้งหมดของผู้ใช้ถูกยกเลิกและไม่สามารถเข้าสู่ระบบได้
        </SuccessAlert>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[1.4fr_0.6fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-primary">
              <UserRound className="size-4" aria-hidden />
              <span className="text-xs font-semibold tracking-wide">
                ACCOUNT DETAILS
              </span>
            </div>
            <CardTitle className="pt-1 text-lg">แก้ไขข้อมูลบัญชี</CardTitle>
            <CardDescription>
              เปลี่ยนชื่อ เบอร์โทร และบทบาทของผู้ใช้
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EditUserForm
              user={{
                id: user.id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
              }}
              isSelf={isSelf}
            />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">สรุปบัญชี</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3 border-b pb-3">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Phone className="size-3.5" aria-hidden />
                  เบอร์โทร
                </span>
                <span className="font-medium">{user.phone ?? "—"}</span>
              </div>
              <div className="flex items-start justify-between gap-3 border-b pb-3">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock3 className="size-3.5" aria-hidden />
                  เข้าสู่ระบบล่าสุด
                </span>
                <span className="text-right font-medium">
                  {formatThaiDateTime(user.lastLoginAt)}
                </span>
              </div>
              <div className="flex items-start justify-between gap-3 border-b pb-3">
                <span className="text-muted-foreground">สร้างบัญชีเมื่อ</span>
                <span className="text-right font-medium">
                  {formatThaiDateTime(user.createdAt)}
                </span>
              </div>
              {user.deactivatedAt ? (
                <div className="flex items-start justify-between gap-3 border-b pb-3">
                  <span className="text-muted-foreground">ปิดใช้งานเมื่อ</span>
                  <span className="text-right font-medium">
                    {formatThaiDateTime(user.deactivatedAt)}
                  </span>
                </div>
              ) : null}
              <p className="text-xs leading-5 text-muted-foreground">
                การเปลี่ยนบทบาท ปิดใช้งาน หรือรีเซ็ตรหัสผ่าน
                จะเพิ่ม token version และยกเลิก session เดิมทันที
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 text-primary">
                <ShieldAlert className="size-4" aria-hidden />
                <span className="text-xs font-semibold tracking-wide">
                  ACCOUNT STATUS
                </span>
              </div>
              <CardTitle className="pt-1 text-base">สถานะการใช้งาน</CardTitle>
            </CardHeader>
            <CardContent>
              {isSelf ? (
                <p className="rounded-lg border bg-muted/40 p-3 text-xs leading-5 text-muted-foreground">
                  คุณไม่สามารถปิดใช้งานบัญชีที่กำลังใช้งานอยู่ได้
                  เพื่อป้องกันการล็อกตัวเองออกจากระบบ
                </p>
              ) : (
                <>
                  <p className="mb-3 text-xs leading-5 text-muted-foreground">
                    {user.isActive
                      ? "ปิดใช้งานเพื่อระงับการเข้าสู่ระบบ โดยข้อมูลบัญชีและประวัติยังคงอยู่"
                      : "เปิดใช้งานอีกครั้งเพื่อให้ผู้ใช้เข้าสู่ระบบได้ด้วยรหัสผ่านเดิม"}
                  </p>
                  <UserStatusForm userId={user.id} active={user.isActive} />
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-primary">
            <KeyRound className="size-4" aria-hidden />
            <span className="text-xs font-semibold tracking-wide">
              PASSWORD RECOVERY
            </span>
          </div>
          <CardTitle className="pt-1 text-lg">ตั้งรหัสผ่านใหม่</CardTitle>
          <CardDescription>
            ใช้เมื่อผู้ใช้ลืมรหัสผ่านหรือต้องการรีเซ็ตเพื่อความปลอดภัย
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isSelf ? (
            <ErrorAlert title="ใช้หน้าโปรไฟล์">
              กรุณาเปลี่ยนรหัสผ่านของบัญชีตนเองจากหน้าโปรไฟล์
              ซึ่งต้องยืนยันรหัสผ่านปัจจุบัน
            </ErrorAlert>
          ) : (
            <div className="space-y-3">
              <ResetPasswordForm userId={user.id} />
              <p className="text-xs leading-5 text-muted-foreground">
                เมื่อตั้งรหัสผ่านใหม่แล้ว session ทั้งหมดของผู้ใช้นี้จะถูกยกเลิก
                และรหัสผ่านเดิมใช้ไม่ได้ทันที
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
