import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  Calculator,
  Pencil,
  Plus,
  Settings2,
} from "lucide-react";

import { CommissionRuleStatusForm } from "@/components/commissions/commission-rule-status-form";
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
  commissionRateLabel,
  commissionRuleTypeLabel,
} from "@/lib/commission-labels";
import { formatThaiDate } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { requireAdmin } from "@/server/auth/session";
import { listCommissionRules } from "@/server/services/commissions";

export const instant = false;

export const metadata: Metadata = {
  title: "กติกาค่าคอมมิชชั่น",
};

function scopeLabel(rule: {
  technician: { name: string } | null;
  billType: { name: string } | null;
  category: { name: string } | null;
}) {
  const scopes = [
    rule.technician ? `ช่าง ${rule.technician.name}` : null,
    rule.billType ? rule.billType.name : null,
    rule.category ? rule.category.name : null,
  ].filter(Boolean);

  return scopes.length > 0 ? scopes.join(" · ") : "ทุกบิล";
}

export default async function CommissionRulesPage() {
  const actor = await requireAdmin();
  const rules = await listCommissionRules({ id: actor.id, role: actor.role });
  const activeCount = rules.filter((rule) => rule.isActive).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
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
              กติกาค่าคอมมิชชั่น
            </h1>
            <Badge variant="outline">
              เปิดใช้ {activeCount.toLocaleString("th-TH")} /{" "}
              {rules.length.toLocaleString("th-TH")} กติกา
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            กำหนดอัตรา ขอบเขต วันที่มีผล และลำดับความสำคัญ กติกาจะถูก snapshot
            ตอนอนุมัติบิล
          </p>
        </div>
        <Link href="/commissions/rules/new" className={cn(buttonVariants(), "h-9")}>
          <Plus aria-hidden />
          เพิ่มกติกา
        </Link>
      </div>

      <div className="rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50 dark:bg-blue-950/30 px-4 py-3 text-xs leading-5 text-blue-900 dark:text-blue-200">
        <p className="flex items-center gap-1.5 font-semibold">
          <Calculator className="size-3.5" aria-hidden />
          ลำดับการเลือกกติกา
        </p>
        <p className="mt-1">
          ระบบเลือกเพียงหนึ่งกติกาต่อบิล โดยเรียงจากความเฉพาะเจาะจง (ช่าง &gt;
          ประเภทบิล &gt; หมวดหมู่) แล้วจึงใช้ลำดับความสำคัญ ตามด้วยวันเริ่มมีผลล่าสุด
          การแก้ไขหรือปิดกติกาจะไม่เปลี่ยน snapshot ของรายการที่เกิดแล้ว
        </p>
      </div>

      <Card>
        <CardHeader className="border-b">
          <div className="flex items-center gap-2">
            <Settings2 className="size-4 text-primary" aria-hidden />
            <div>
              <CardTitle>รายการกติกา</CardTitle>
              <CardDescription>
                ปิดใช้งานเพื่อหยุดใช้กับบิลใหม่ โดยยังเก็บประวัติรายการเดิม
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {rules.length === 0 ? (
            <div className="py-12 text-center">
              <Calculator
                className="mx-auto size-9 text-muted-foreground/50"
                aria-hidden
              />
              <p className="mt-3 text-sm font-medium">ยังไม่มีกติกาคอมมิชชั่น</p>
              <p className="mt-1 text-xs text-muted-foreground">
                สร้างกติกาเพื่อให้บิลที่อนุมัติหลังจากนี้มีรายการค่าคอมมิชชั่น
              </p>
              <Link
                href="/commissions/rules/new"
                className={cn(buttonVariants(), "mt-4 h-8")}
              >
                <Plus aria-hidden />
                สร้างกติกาแรก
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[980px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>กติกา</TableHead>
                    <TableHead>อัตรา</TableHead>
                    <TableHead>ขอบเขต</TableHead>
                    <TableHead>วันที่มีผล</TableHead>
                    <TableHead className="text-center">ลำดับ</TableHead>
                    <TableHead className="text-center">รายการ</TableHead>
                    <TableHead>สถานะ</TableHead>
                    <TableHead className="text-right">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell className="align-top">
                        <Link
                          href={`/commissions/rules/${rule.id}`}
                          className="text-sm font-semibold hover:text-primary hover:underline"
                        >
                          {rule.name}
                        </Link>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {commissionRuleTypeLabel(rule.ruleType)}
                        </p>
                        {rule.description ? (
                          <p className="mt-1 max-w-64 truncate text-[11px] text-muted-foreground">
                            {rule.description}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="align-top font-semibold tabular-nums">
                        {commissionRateLabel(
                          rule.ruleType,
                          rule.value.toString(),
                        )}
                      </TableCell>
                      <TableCell className="align-top text-xs">
                        {scopeLabel(rule)}
                      </TableCell>
                      <TableCell className="align-top text-xs text-muted-foreground">
                        <p>{formatThaiDate(rule.effectiveFrom)}</p>
                        <p>
                          ถึง {rule.effectiveTo ? formatThaiDate(rule.effectiveTo) : "ไม่กำหนด"}
                        </p>
                      </TableCell>
                      <TableCell className="align-top text-center tabular-nums">
                        {rule.priority}
                      </TableCell>
                      <TableCell className="align-top text-center tabular-nums">
                        {rule._count.entries.toLocaleString("th-TH")}
                      </TableCell>
                      <TableCell className="align-top">
                        <Badge
                          variant="outline"
                          className={
                            rule.isActive
                              ? "border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300"
                              : "border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300"
                          }
                        >
                          {rule.isActive ? "เปิดใช้งาน" : "ปิดใช้งาน"}
                        </Badge>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex items-start justify-end gap-1.5">
                          <Link
                            href={`/commissions/rules/${rule.id}`}
                            className={cn(
                              buttonVariants({ variant: "outline", size: "sm" }),
                            )}
                          >
                            <Pencil aria-hidden />
                            แก้ไข
                          </Link>
                          <CommissionRuleStatusForm
                            ruleId={rule.id}
                            active={rule.isActive}
                          />
                        </div>
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
  );
}
