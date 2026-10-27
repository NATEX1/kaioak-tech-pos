import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  HandCoins,
  UsersRound,
} from "lucide-react";

import { CommissionPayoutForm } from "@/components/commissions/commission-payout-form";
import { CommissionPayoutStatusBadge } from "@/components/commissions/commission-status-badges";
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
import { formatThaiDate, formatThaiDateTime } from "@/lib/labels";
import { Decimal, formatTHB } from "@/lib/money";
import { cn } from "@/lib/utils";
import { requireAdmin } from "@/server/auth/session";
import {
  listCommissionPayouts,
  listOutstandingCommissionBalances,
} from "@/server/services/commissions";

export const instant = false;

export const metadata: Metadata = {
  title: "รอบจ่ายค่าคอมมิชชั่น",
};

export default async function CommissionPayoutsPage() {
  const actor = await requireAdmin();
  const actorRef = { id: actor.id, role: actor.role };
  const [payouts, technicians] = await Promise.all([
    listCommissionPayouts(actorRef),
    listOutstandingCommissionBalances(actorRef),
  ]);
  const outstandingTotal = technicians.reduce(
    (sum, technician) => sum.plus(technician.outstanding),
    new Decimal(0),
  );

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/commissions"
          className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          กลับหน้าค่าคอมมิชชั่น
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            รอบจ่ายค่าคอมมิชชั่น
          </h1>
          <Badge variant="outline">
            {payouts.length.toLocaleString("th-TH")} รอบล่าสุด
          </Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          รวมรายการที่ยังรอจ่ายทั้งหมดถึงวันสิ้นสุดรอบ แล้วปิดเป็นจ่ายแล้วรายช่าง
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card size="sm">
          <CardContent>
            <p className="text-xs font-medium text-muted-foreground">
              ยอดค้างจ่ายรวม
            </p>
            <p
              className={cn(
                "mt-1.5 text-xl font-semibold tabular-nums",
                outstandingTotal.isNegative() && "text-rose-700 dark:text-rose-300",
              )}
            >
              {formatTHB(outstandingTotal)}
            </p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent>
            <p className="text-xs font-medium text-muted-foreground">
              ช่างที่เปิดใช้งาน
            </p>
            <p className="mt-1.5 text-xl font-semibold tabular-nums">
              {technicians.length.toLocaleString("th-TH")} คน
            </p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent>
            <p className="text-xs font-medium text-muted-foreground">
              ช่างมียอดค้างจ่าย
            </p>
            <p className="mt-1.5 text-xl font-semibold tabular-nums">
              {
                technicians.filter(
                  (technician) => Number(technician.outstanding) !== 0,
                ).length
              }{" "}
              คน
            </p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent>
            <p className="text-xs font-medium text-muted-foreground">
              รอบจ่ายที่บันทึกแล้ว
            </p>
            <p className="mt-1.5 text-xl font-semibold tabular-nums">
              {payouts.length.toLocaleString("th-TH")}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader className="border-b">
            <div className="flex items-center gap-2">
              <CalendarDays className="size-4 text-primary" aria-hidden />
              <div>
                <CardTitle>ประวัติรอบจ่าย</CardTitle>
                <CardDescription>
                  แสดงรายการล่าสุดสูงสุด 100 รอบ
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {payouts.length === 0 ? (
              <div className="py-12 text-center">
                <HandCoins
                  className="mx-auto size-9 text-muted-foreground/50"
                  aria-hidden
                />
                <p className="mt-3 text-sm font-medium">ยังไม่มีรอบจ่าย</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  สร้างรอบจ่ายจากแบบฟอร์มด้านขวาเมื่อมีรายการรอจ่าย
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table className="min-w-[860px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>เลขที่รอบจ่าย</TableHead>
                      <TableHead>ช่างเทคนิค</TableHead>
                      <TableHead>ช่วงรอบ</TableHead>
                      <TableHead className="text-center">รายการ</TableHead>
                      <TableHead className="text-right">ยอดจ่าย</TableHead>
                      <TableHead>วันที่จ่าย</TableHead>
                      <TableHead className="text-right" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payouts.map((payout) => (
                      <TableRow key={payout.id}>
                        <TableCell>
                          <Link
                            href={`/commissions/payouts/${payout.id}`}
                            className="font-mono text-xs font-semibold text-primary hover:underline"
                          >
                            {payout.payoutNo}
                          </Link>
                          <div className="mt-1">
                            <CommissionPayoutStatusBadge status={payout.status} />
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          <p className="font-medium">{payout.technician.name}</p>
                          <p className="mt-0.5 text-muted-foreground">
                            ผู้จ่าย {payout.paidBy?.name ?? "—"}
                          </p>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatThaiDate(payout.periodStart)} –{" "}
                          {formatThaiDate(payout.periodEnd)}
                        </TableCell>
                        <TableCell className="text-center text-xs tabular-nums">
                          {payout._count.items.toLocaleString("th-TH")}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          {formatTHB(payout.totalAmount.toString())}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatThaiDateTime(payout.paidAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Link
                            href={`/commissions/payouts/${payout.id}`}
                            className={cn(
                              buttonVariants({ variant: "outline", size: "sm" }),
                            )}
                          >
                            ดู
                            <ArrowRight aria-hidden />
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="h-fit xl:sticky xl:top-5">
          <CardHeader className="border-b">
            <div className="flex items-center gap-2">
              <UsersRound className="size-4 text-primary" aria-hidden />
              <div>
                <CardTitle>สร้างรอบจ่าย</CardTitle>
                <CardDescription>
                  เลือกช่างและช่วงรอบ ระบบจะรวมยอดค้างทั้งหมดถึงวันสิ้นสุด
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <CommissionPayoutForm technicians={technicians} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
