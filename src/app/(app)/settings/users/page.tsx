import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Plus, UserCog, UsersRound, Wrench } from "lucide-react";

import { RoleBadge, UserStatusBadge } from "@/components/users/user-badges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatThaiDateTime, userInitial } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { requireAdmin } from "@/server/auth/session";
import { listUsers } from "@/server/services/users";

export const instant = false;

export const metadata: Metadata = {
  title: "จัดการผู้ใช้",
};

export default async function UsersPage() {
  const actor = await requireAdmin();
  const users = await listUsers({ id: actor.id, role: actor.role });

  const activeCount = users.filter((user) => user.isActive).length;
  const adminCount = users.filter(
    (user) => user.role === "ADMIN" && user.isActive,
  ).length;
  const technicianCount = users.filter(
    (user) => user.role === "TECHNICIAN" && user.isActive,
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <Link
            href="/"
            className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            กลับหน้าภาพรวม
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            จัดการผู้ใช้
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            สร้างบัญชี กำหนดบทบาท รีเซ็ตรหัสผ่าน และระงับการใช้งาน
          </p>
        </div>
        <Link
          href="/settings/users/new"
          className={cn(buttonVariants(), "h-9 self-start sm:self-auto")}
        >
          <Plus aria-hidden />
          เพิ่มผู้ใช้
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          { label: "เปิดใช้งาน", value: activeCount, icon: UsersRound },
          { label: "ผู้ดูแลระบบ", value: adminCount, icon: UserCog },
          { label: "ช่างเทคนิค", value: technicianCount, icon: Wrench },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.label} size="sm">
              <CardContent className="flex items-center gap-3">
                <div className="hidden size-9 items-center justify-center rounded-lg bg-primary/10 text-primary sm:flex">
                  <Icon className="size-4" aria-hidden />
                </div>
                <div>
                  <p className="text-xl font-semibold leading-none">
                    {item.value}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.label}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="py-0">
        <CardHeader className="border-b py-4">
          <CardTitle>บัญชีทั้งหมด ({users.length})</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <ul className="divide-y lg:hidden">
            {users.map((user) => (
              <li key={user.id} className="px-4 py-5">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
                    {userInitial(user.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {user.name}
                      {user.id === actor.id ? (
                        <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                          (คุณ)
                        </span>
                      ) : null}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {user.email}
                    </p>
                  </div>
                  <Link
                    href={`/settings/users/${user.id}`}
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                      "h-7 shrink-0",
                    )}
                  >
                    ดู / แก้ไข
                  </Link>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <RoleBadge role={user.role} />
                  <UserStatusBadge active={user.isActive} />
                </div>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto lg:block">
            <Table className="min-w-190">
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">ผู้ใช้</TableHead>
                  <TableHead>บทบาท</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead>เข้าสู่ระบบล่าสุด</TableHead>
                  <TableHead>สร้างเมื่อ</TableHead>
                  <TableHead className="pr-4 text-right">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="pl-4">
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
                          {userInitial(user.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="max-w-56 truncate font-medium">
                            {user.name}
                            {user.id === actor.id ? (
                              <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                                (คุณ)
                              </span>
                            ) : null}
                          </p>
                          <p className="max-w-64 truncate text-xs text-muted-foreground">
                            {user.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <RoleBadge role={user.role} />
                    </TableCell>
                    <TableCell>
                      <UserStatusBadge active={user.isActive} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatThaiDateTime(user.lastLoginAt)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatThaiDateTime(user.createdAt)}
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      <Link
                        href={`/settings/users/${user.id}`}
                        className={cn(
                          buttonVariants({ variant: "outline", size: "sm" }),
                          "h-7",
                        )}
                      >
                        ดู / แก้ไข
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs leading-5 text-muted-foreground">
        การปิดใช้งานหรือเปลี่ยนบทบาทจะมีผลกับ session เดิมทันที
        และทุกการเปลี่ยนแปลงจะถูกบันทึกใน audit log
      </p>
    </div>
  );
}
