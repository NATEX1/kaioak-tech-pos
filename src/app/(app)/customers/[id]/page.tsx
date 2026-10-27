import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Contact,
  FileClock,
  FilePlus2,
  Mail,
  MapPin,
  NotebookPen,
  PackageCheck,
  Pencil,
  Phone,
  ReceiptText,
  ShieldCheck,
  Stamp,
  UserRoundCog,
} from "lucide-react";

import { CustomerStatusForm } from "@/components/customers/customer-status-form";
import { SuccessAlert } from "@/components/forms/form-feedback";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  billStatusBadgeClass,
  billStatusLabel,
} from "@/lib/bill-labels";
import { formatThaiDate, formatThaiDateTime } from "@/lib/labels";
import { formatTHB } from "@/lib/money";
import { formatThaiPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";
import { requireUser } from "@/server/auth/session";
import {
  getCustomerBills,
  getCustomerById,
  getCustomerPurchaseSummary,
} from "@/server/services/customers";
import { getCustomerPurchasedProducts } from "@/server/services/warranty";

export const instant = false;

export const metadata: Metadata = {
  title: "โปรไฟล์ลูกค้า",
};

function formatTaxId(value: string): string {
  const digits = value.replace(/\D/g, "");

  if (digits.length !== 13) {
    return value;
  }

  return `${digits.slice(0, 1)}-${digits.slice(1, 5)}-${digits.slice(5, 10)}-${digits.slice(10, 12)}-${digits.slice(12)}`;
}

export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    created?: string;
    updated?: string;
    restored?: string;
  }>;
}) {
  const actor = await requireUser();
  const { id } = await params;
  const [customer, query] = await Promise.all([
    getCustomerById({ id: actor.id, role: actor.role }, id),
    searchParams,
  ]);

  if (!customer) {
    notFound();
  }

  const actorRef = { id: actor.id, role: actor.role };
  const [bills, summary, purchasedItems] = await Promise.all([
    getCustomerBills(actorRef, customer.id),
    getCustomerPurchaseSummary(actorRef, customer.id),
    getCustomerPurchasedProducts(actorRef, customer.id),
  ]);
  const isAdmin = actor.role === "ADMIN";
  const isArchived = Boolean(customer.deletedAt);

  return (
    <div className="space-y-5">
      <div>
        <Link
          href={isArchived ? "/customers?status=archived" : "/customers"}
          className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          กลับรายชื่อลูกค้า
        </Link>
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold tracking-tight">
                {customer.name}
              </h2>
              {isArchived ? (
                <Badge variant="outline">เก็บถาวร</Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300"
                >
                  เปิดใช้งาน
                </Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatThaiPhone(customer.phone)} · เป็นลูกค้าเมื่อ{" "}
              {formatThaiDate(customer.createdAt)} · บิลทั้งหมด{" "}
              {customer._count.bills.toLocaleString("th-TH")} รายการ
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!isArchived ? (
              <Link
                href={`/bills/new?customerId=${customer.id}`}
                className={cn(buttonVariants(), "h-9")}
              >
                <FilePlus2 aria-hidden />
                เปิดบิลใหม่
              </Link>
            ) : null}
            {isAdmin ? (
              <Link
                href={`/customers/${customer.id}/edit`}
                className={cn(buttonVariants({ variant: "outline" }), "h-9")}
              >
                <Pencil aria-hidden />
                แก้ไขข้อมูล
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      {query.created ? (
        <SuccessAlert title="สร้างลูกค้าแล้ว">
          ข้อมูลลูกค้าถูกบันทึกและพร้อมใช้ในงานขายหรือซ่อม
        </SuccessAlert>
      ) : null}
      {query.updated ? (
        <SuccessAlert title="บันทึกแล้ว">ข้อมูลลูกค้าอัปเดตแล้ว</SuccessAlert>
      ) : null}
      {query.restored ? (
        <SuccessAlert title="กู้คืนลูกค้าแล้ว">
          ลูกค้ากลับมาแสดงในรายการปกติและพร้อมใช้งานอีกครั้ง
        </SuccessAlert>
      ) : null}

      {isArchived ? (
        <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm leading-6 text-amber-900 dark:text-amber-200">
          ลูกค้ารายนี้ถูกเก็บถาวร จะไม่แสดงในรายการปกติและไม่สามารถเลือกในบิลใหม่ได้
          แต่ประวัติบิลและประวัติซื้อทั้งหมดยังคงอยู่
        </div>
      ) : null}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card size="sm">
          <CardContent>
            <p className="text-xs font-medium text-muted-foreground">
              ยอดซื้อสะสม
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">
              {formatTHB(summary.totalAmount)}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              บิลที่อนุมัติหรือชำระแล้ว · ไม่รวมบิลยกเลิก
            </p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent>
            <p className="text-xs font-medium text-muted-foreground">
              ประวัติที่เสร็จสิ้น
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">
              {summary.billCount.toLocaleString("th-TH")}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              อนุมัติหรือชำระแล้ว
            </p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent>
            <p className="text-xs font-medium text-muted-foreground">
              ซื้อล่าสุด
            </p>
            <p className="mt-2 text-lg font-semibold tracking-tight">
              {summary.lastPurchaseAt
                ? formatThaiDate(summary.lastPurchaseAt)
                : "ยังไม่มีประวัติ"}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              จากบิลที่อนุมัติหรือชำระแล้ว
            </p>
          </CardContent>
        </Card>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <Card>
            <CardHeader className="border-b">
              <div className="flex items-center gap-2">
                <Contact className="size-4 text-primary" aria-hidden />
                <div>
                  <CardTitle>ข้อมูลติดต่อ</CardTitle>
                  <CardDescription>
                    ใช้สำหรับติดต่อและออกเอกสาร
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-[11px] font-medium text-muted-foreground">
                  เบอร์โทร
                </p>
                <a
                  href={`tel:${customer.phone}`}
                  className="mt-1 flex items-center gap-2 text-sm font-medium hover:text-primary"
                >
                  <Phone className="size-4 text-muted-foreground" aria-hidden />
                  {formatThaiPhone(customer.phone)}
                </a>
              </div>
              <div>
                <p className="text-[11px] font-medium text-muted-foreground">
                  อีเมล
                </p>
                {customer.email ? (
                  <a
                    href={`mailto:${customer.email}`}
                    className="mt-1 flex items-center gap-2 text-sm font-medium break-all hover:text-primary"
                  >
                    <Mail
                      className="size-4 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                    {customer.email}
                  </a>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">—</p>
                )}
              </div>
              <div className="sm:col-span-2">
                <p className="text-[11px] font-medium text-muted-foreground">
                  ที่อยู่
                </p>
                {customer.address ? (
                  <p className="mt-1 flex gap-2 whitespace-pre-wrap text-sm leading-6">
                    <MapPin
                      className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                    {customer.address}
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">—</p>
                )}
              </div>
              <div>
                <p className="text-[11px] font-medium text-muted-foreground">
                  เลขผู้เสียภาษี
                </p>
                {customer.taxId ? (
                  <p className="mt-1 flex items-center gap-2 text-sm font-medium tabular-nums">
                    <Stamp
                      className="size-4 text-muted-foreground"
                      aria-hidden
                    />
                    {formatTaxId(customer.taxId)}
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">—</p>
                )}
              </div>
              <div>
                <p className="text-[11px] font-medium text-muted-foreground">
                  สร้างเมื่อ
                </p>
                <p className="mt-1 flex items-center gap-2 text-sm">
                  <CalendarDays
                    className="size-4 text-muted-foreground"
                    aria-hidden
                  />
                  {formatThaiDateTime(customer.createdAt)}
                </p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-[11px] font-medium text-muted-foreground">
                  หมายเหตุ
                </p>
                {customer.note ? (
                  <p className="mt-1 flex gap-2 whitespace-pre-wrap text-sm leading-6">
                    <NotebookPen
                      className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                    {customer.note}
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">—</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <div className="flex items-center gap-2">
                <ReceiptText className="size-4 text-primary" aria-hidden />
                <div>
                  <CardTitle>ประวัติการซื้อและบริการ</CardTitle>
                  <CardDescription>
                    แสดงบิลที่อนุมัติ ชำระแล้ว หรือยกเลิก ล่าสุด 20 รายการ
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-0">
              {bills.length === 0 ? (
                <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                  <FileClock
                    className="mx-auto mb-2 size-6 text-muted-foreground/60"
                    aria-hidden
                  />
                  ยังไม่มีประวัติการซื้อ
                  <p className="mt-1 text-xs">
                    ประวัติจะแสดงเมื่อบิลได้รับการอนุมัติหรือชำระเงิน
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table className="min-w-150">
                    <TableHeader>
                      <TableRow>
                        <TableHead>เลขที่ / ประเภท</TableHead>
                        <TableHead>วันที่</TableHead>
                        <TableHead>ช่างผู้รับผิดชอบ</TableHead>
                        <TableHead>สถานะ</TableHead>
                        <TableHead className="text-right">ยอดรวม</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bills.map((bill) => (
                        <TableRow key={bill.id}>
                          <TableCell>
                            <Link
                              href={`/bills/${bill.id}`}
                              className="font-mono text-xs font-semibold text-primary hover:underline"
                            >
                              {bill.billNumber}
                            </Link>
                            <p className="mt-0.5 text-[11px] text-muted-foreground">
                              {bill.billType.name} · {bill.title}
                            </p>
                          </TableCell>
                          <TableCell className="text-xs">
                            {formatThaiDate(
                              bill.paidAt ?? bill.approvedAt ?? bill.createdAt,
                            )}
                          </TableCell>
                          <TableCell className="text-xs">
                            {bill.technician.name}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={billStatusBadgeClass(bill.status)}
                            >
                              {billStatusLabel(bill.status)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums">
                            {formatTHB(bill.grandTotal.toString())}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Purchased Items & Warranty Section */}
          <Card>
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PackageCheck className="size-4 text-primary" aria-hidden />
                  <div>
                    <CardTitle>รายการสินค้าที่เคยซื้อ & ประกัน</CardTitle>
                    <CardDescription>
                      รายการสินค้าและ Serial Number จากบิลที่อนุมัติแล้ว พร้อมสถานะประกัน
                    </CardDescription>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground font-mono">
                  {purchasedItems.length} รายการ
                </span>
              </div>
            </CardHeader>
            <CardContent className="px-0">
              {purchasedItems.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                  ยังไม่มีรายการสินค้าที่บันทึกการขายสำเร็จ
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table className="min-w-150">
                    <TableHeader>
                      <TableRow>
                        <TableHead>สินค้า</TableHead>
                        <TableHead>Serial Number</TableHead>
                        <TableHead>วันที่ซื้อ / บิล</TableHead>
                        <TableHead>สิ้นสุดประกัน</TableHead>
                        <TableHead>สถานะประกัน</TableHead>
                        <TableHead className="text-right">การจัดการ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {purchasedItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <span className="font-medium text-xs">
                              {item.productName}
                            </span>
                            {item.productSku && (
                              <p className="font-mono text-[11px] text-muted-foreground">
                                {item.productSku}
                              </p>
                            )}
                          </TableCell>
                          <TableCell>
                            {item.serialNumbers.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {item.serialNumbers.map((sn) => (
                                  <Link
                                    key={sn}
                                    href={`/warranty?serial=${encodeURIComponent(sn)}`}
                                    className="inline-flex items-center gap-1 font-mono text-[11px] bg-muted/60 hover:bg-primary/10 hover:text-primary px-1.5 py-0.5 rounded border transition-colors"
                                    title="คลิกเพื่อตรวจสอบประกัน Serial นี้"
                                  >
                                    {sn}
                                  </Link>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                — (ไม่ระบุ Serial)
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">
                            {formatThaiDate(item.purchasedAt)}
                            <p className="mt-0.5">
                              <Link
                                href={`/bills/${item.billId}`}
                                className="font-mono text-[11px] text-primary hover:underline"
                              >
                                {item.billNumber}
                              </Link>
                            </p>
                          </TableCell>
                          <TableCell className="text-xs">
                            {item.warrantyEndsAt
                              ? formatThaiDate(item.warrantyEndsAt)
                              : "ไม่มีประกัน"}
                          </TableCell>
                          <TableCell>
                            {item.warrantyStatus === "IN_WARRANTY" && (
                              <Badge
                                variant="outline"
                                className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:text-emerald-300 dark:border-emerald-900 dark:bg-emerald-950/30"
                              >
                                อยู่ในประกัน ({item.daysRemaining} วัน)
                              </Badge>
                            )}
                            {item.warrantyStatus === "OUT_OF_WARRANTY" && (
                              <Badge
                                variant="outline"
                                className="border-amber-200 bg-amber-50 text-amber-700 dark:text-amber-300 dark:border-amber-900 dark:bg-amber-950/30"
                              >
                                หมดประกันแล้ว
                              </Badge>
                            )}
                            {item.warrantyStatus === "NO_WARRANTY" && (
                              <span className="text-xs text-muted-foreground">
                                ไม่มีประกัน
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {item.productId && (
                              <Link
                                href={`/bills/new?billTypeCode=WARRANTY_CLAIM&customerId=${customer.id}&productId=${item.productId}${item.serialNumbers[0] ? `&serialNumber=${encodeURIComponent(item.serialNumbers[0])}` : ""}`}
                                className={cn(
                                  buttonVariants({
                                    variant: "ghost",
                                    size: "sm",
                                  }),
                                  "h-8 text-xs text-primary hover:text-primary",
                                )}
                              >
                                เปิดเคลม
                              </Link>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {isAdmin ? (
            <Card>
              <CardHeader className="border-b">
                <div className="flex items-center gap-2">
                  <UserRoundCog className="size-4 text-primary" aria-hidden />
                  <CardTitle>จัดการลูกค้า</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <Link
                  href={`/customers/${customer.id}/edit`}
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    "h-9 w-full",
                  )}
                >
                  <Pencil aria-hidden />
                  แก้ไขข้อมูลลูกค้า
                </Link>
                <CustomerStatusForm
                  customerId={customer.id}
                  active={!isArchived}
                />
                <p className="text-[11px] leading-5 text-muted-foreground">
                  การเก็บถาวรไม่ลบประวัติบิล ประกัน หรือ audit log
                  และสามารถกู้คืนได้ภายหลัง
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="border-b">
                <div className="flex items-center gap-2">
                  <ShieldCheck
                    className="size-4 text-emerald-600 dark:text-emerald-300"
                    aria-hidden
                  />
                  <CardTitle>สิทธิ์ของช่างเทคนิค</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-xs leading-5 text-muted-foreground">
                <p>คุณสามารถค้นหา ดูโปรไฟล์ และเพิ่มลูกค้าใหม่ได้</p>
                <p>
                  หากต้องการแก้ไขข้อมูลหรือเก็บลูกค้าถาวร
                  กรุณาติดต่อผู้ดูแลระบบ
                </p>
              </CardContent>
            </Card>
          )}

          <Card size="sm" className="bg-muted/30">
            <CardContent className="space-y-2 text-xs leading-5 text-muted-foreground">
              <p className="font-medium text-foreground">ข้อมูลลูกค้าถูกป้องกัน</p>
              <p>
                เบอร์โทรต้องไม่ซ้ำทั้งระบบ และการแก้ไขทุกครั้งถูกบันทึกใน Audit
                Log พร้อมผู้ดำเนินการ
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
