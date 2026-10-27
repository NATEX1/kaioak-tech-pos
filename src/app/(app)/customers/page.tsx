import type { Metadata } from "next";
import Link from "next/link";
import {
  Archive,
  Contact,
  Eye,
  Mail,
  Pencil,
  Phone,
  Plus,
  Search,
  UserCheck,
  UserPlus,
  X,
} from "lucide-react";

import { SuccessAlert } from "@/components/forms/form-feedback";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { inputClassName, selectClassName } from "@/lib/form-styles";
import { formatThaiDate } from "@/lib/labels";
import { formatThaiPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";
import { requireUser } from "@/server/auth/session";
import {
  getCustomerSummary,
  listCustomersPaginated,
  CUSTOMERS_PAGE_SIZE,
} from "@/server/services/customers";
import {
  customerListStatusSchema,
  type CustomerListStatus,
} from "@/server/validators/customers";

export const instant = false;

export const metadata: Metadata = {
  title: "ลูกค้า",
};

function single(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string | string[];
    status?: string | string[];
    archived?: string | string[];
    page?: string | string[];
  }>;
}) {
  const actor = await requireUser();
  const query = await searchParams;
  const isAdmin = actor.role === "ADMIN";
  const q = single(query.q).trim().slice(0, 100);
  const requestedStatus = customerListStatusSchema.safeParse(
    single(query.status),
  );
  const status: CustomerListStatus = isAdmin
    ? requestedStatus.success
      ? requestedStatus.data
      : "active"
    : "active";
  const page = Math.max(1, parseInt(single(query.page), 10) || 1);

  const [{ items: customers, totalCount, pageSize }, summary] =
    await Promise.all([
      listCustomersPaginated(
        { id: actor.id, role: actor.role },
        { q, status, page, pageSize: CUSTOMERS_PAGE_SIZE },
      ),
      getCustomerSummary({ id: actor.id, role: actor.role }),
    ]);

  const stats = [
    {
      label: "ลูกค้าที่เปิดใช้งาน",
      value: summary.activeCount.toLocaleString("th-TH"),
      detail: "พร้อมใช้ในงานขายและซ่อม",
      icon: UserCheck,
      tone: "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30",
    },
    {
      label: "ลูกค้าใหม่ 30 วัน",
      value: summary.newLast30Days.toLocaleString("th-TH"),
      detail: "นับจากวันที่สร้างรายการ",
      icon: UserPlus,
      tone: "text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/30",
    },
    isAdmin
      ? {
          label: "ลูกค้าที่เก็บถาวร",
          value: (summary.archivedCount ?? 0).toLocaleString("th-TH"),
          detail: "ประวัติยังอยู่และกู้คืนได้",
          icon: Archive,
          tone: "text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/60",
        }
      : {
          label: "ผลลัพธ์ที่พบ",
          value: customers.length.toLocaleString("th-TH"),
          detail: "ตามคำค้นหาปัจจุบัน",
          icon: Contact,
          tone: "text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-950/30",
        },
  ];

  const hasFilter = Boolean(q) || status !== "active";

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">ลูกค้า</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            ค้นหาด้วยชื่อหรือเบอร์โทร ดูโปรไฟล์ และประวัติการซื้อ
          </p>
        </div>
        <Link
          href="/customers/new"
          className={cn(buttonVariants(), "h-10")}
        >
          <Plus aria-hidden />
          เพิ่มลูกค้า
        </Link>
      </div>

      {single(query.archived) ? (
        <SuccessAlert title="เก็บลูกค้าถาวรแล้ว">
          ลูกค้าจะไม่แสดงในรายการปกติ แต่ประวัติบิลและประวัติซื้อทั้งหมดยังอยู่
          และสามารถกู้คืนได้ภายหลัง
        </SuccessAlert>
      ) : null}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} size="sm">
              <CardContent className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    {stat.label}
                  </p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight">
                    {stat.value}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {stat.detail}
                  </p>
                </div>
                <div
                  className={cn(
                    "hidden size-9 shrink-0 items-center justify-center rounded-xl sm:flex",
                    stat.tone,
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base">ค้นหาและกรองลูกค้า</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action="/customers"
            method="get"
            className="flex flex-col gap-2 lg:flex-row"
          >
            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                name="q"
                defaultValue={q}
                maxLength={100}
                placeholder="ชื่อลูกค้า เบอร์โทร หรืออีเมล"
                className={cn(inputClassName, "pl-9")}
                aria-label="ค้นหาลูกค้า"
              />
            </div>
            {isAdmin ? (
              <select
                name="status"
                defaultValue={status}
                className={cn(selectClassName, "lg:w-52")}
                aria-label="สถานะลูกค้า"
              >
                <option value="active">เปิดใช้งาน</option>
                <option value="archived">เก็บถาวร</option>
                <option value="all">ทั้งหมด</option>
              </select>
            ) : null}
            <Button type="submit" variant="outline" className="h-10">
              <Search aria-hidden />
              ค้นหา
            </Button>
            {hasFilter ? (
              <Link
                href="/customers"
                className={cn(
                  buttonVariants({ variant: "ghost" }),
                  "h-10 text-muted-foreground",
                )}
              >
                <X aria-hidden />
                ล้างตัวกรอง
              </Link>
            ) : null}
          </form>
        </CardContent>
      </Card>

      <div className="overflow-hidden rounded-xl border bg-background shadow-xs">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <div>
            <h3 className="font-semibold">
              {q ? "ผลการค้นหา" : "รายชื่อลูกค้า"}
            </h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              พบ {customers.length.toLocaleString("th-TH")} รายการ
              {status === "archived" ? " · เฉพาะที่เก็บถาวร" : null}
              {status === "all" ? " · รวมที่เก็บถาวร" : null}
            </p>
          </div>
          <Badge variant="secondary">
            {q ? `ค้นหา: ${q}` : "ทั้งหมด"}
          </Badge>
        </div>

        <div className="overflow-x-auto">
          <Table className="min-w-190">
            <TableHeader>
              <TableRow>
                <TableHead>ลูกค้า</TableHead>
                <TableHead>ช่องทางติดต่อ</TableHead>
                <TableHead className="text-right">บิล</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead className="text-right">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-14 text-center text-sm text-muted-foreground"
                  >
                    <Contact
                      className="mx-auto mb-2 size-6 text-muted-foreground/60"
                      aria-hidden
                    />
                    {q
                      ? "ไม่พบลูกค้าที่ตรงกับคำค้นหา"
                      : status === "archived"
                        ? "ยังไม่มีลูกค้าที่ถูกเก็บถาวร"
                        : "ยังไม่มีลูกค้า เริ่มเพิ่มลูกค้าคนแรกได้เลย"}
                  </TableCell>
                </TableRow>
              ) : (
                customers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell>
                      <Link
                        href={`/customers/${customer.id}`}
                        className="font-medium hover:text-primary"
                      >
                        {customer.name}
                      </Link>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        เพิ่มเมื่อ {formatThaiDate(customer.createdAt)}
                      </p>
                    </TableCell>
                    <TableCell className="text-sm">
                      <p className="flex items-center gap-1.5">
                        <Phone
                          className="size-3.5 text-muted-foreground"
                          aria-hidden
                        />
                        <a
                          href={`tel:${customer.phone}`}
                          className="tabular-nums hover:text-primary"
                        >
                          {formatThaiPhone(customer.phone)}
                        </a>
                      </p>
                      {customer.email ? (
                        <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <Mail className="size-3" aria-hidden />
                          {customer.email}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {customer._count.bills.toLocaleString("th-TH")}
                    </TableCell>
                    <TableCell>
                      {customer.deletedAt ? (
                        <Badge variant="outline">เก็บถาวร</Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300"
                        >
                          เปิดใช้งาน
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        <Link
                          href={`/customers/${customer.id}`}
                          className={cn(
                            buttonVariants({ variant: "ghost", size: "sm" }),
                          )}
                        >
                          <Eye aria-hidden />
                          ดูโปรไฟล์
                        </Link>
                        {isAdmin ? (
                          <Link
                            href={`/customers/${customer.id}/edit`}
                            className={cn(
                              buttonVariants({
                                variant: "ghost",
                                size: "sm",
                              }),
                            )}
                          >
                            <Pencil aria-hidden />
                            แก้ไข
                          </Link>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Pagination
        page={page}
        totalCount={totalCount}
        pageSize={pageSize}
        basePath="/customers"
      />

      <p className="text-[11px] leading-5 text-muted-foreground">
        {isAdmin
          ? "ผู้ดูแลระบบสามารถแก้ไข เก็บถาวร และกู้คืนข้อมูลลูกค้าได้"
          : "ช่างเทคนิคสามารถค้นหา ดูข้อมูล และเพิ่มลูกค้าใหม่ได้ ส่วนการแก้ไขหรือเก็บถาวรต้องให้ผู้ดูแลระบบดำเนินการ"}
      </p>
    </div>
  );
}
