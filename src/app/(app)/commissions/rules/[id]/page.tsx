import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Calculator, History } from "lucide-react";

import { CommissionRuleForm } from "@/components/commissions/commission-rule-form";
import { CommissionRuleStatusForm } from "@/components/commissions/commission-rule-status-form";
import { SuccessAlert } from "@/components/forms/form-feedback";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  commissionRateLabel,
  commissionRuleTypeLabel,
  commissionDateInputValue,
} from "@/lib/commission-labels";
import { formatThaiDate, formatThaiDateTime } from "@/lib/labels";
import { requireAdmin } from "@/server/auth/session";
import {
  getCommissionRuleById,
  listCommissionRuleOptions,
} from "@/server/services/commissions";

export const instant = false;

export const metadata: Metadata = {
  title: "แก้ไขกติกาค่าคอมมิชชั่น",
};

export default async function EditCommissionRulePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    created?: string;
    updated?: string;
    activated?: string;
    deactivated?: string;
  }>;
}) {
  const actor = await requireAdmin();
  const { id } = await params;
  const query = await searchParams;
  const [rule, options] = await Promise.all([
    getCommissionRuleById({ id: actor.id, role: actor.role }, id),
    listCommissionRuleOptions({ id: actor.id, role: actor.role }),
  ]);

  if (!rule) {
    notFound();
  }

  const initial = {
    id: rule.id,
    name: rule.name,
    description: rule.description ?? "",
    ruleType: rule.ruleType,
    value: rule.value.toFixed(4),
    technicianId: rule.technicianId ?? "",
    billTypeId: rule.billTypeId ?? "",
    categoryId: rule.categoryId ?? "",
    priority: String(rule.priority),
    effectiveFrom: commissionDateInputValue(rule.effectiveFrom),
    effectiveTo: rule.effectiveTo
      ? commissionDateInputValue(rule.effectiveTo)
      : "",
    isActive: rule.isActive,
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <Link
          href="/commissions/rules"
          className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          กลับรายการกติกา
        </Link>
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                {rule.name}
              </h1>
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
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {commissionRuleTypeLabel(rule.ruleType)} ·{" "}
              {commissionRateLabel(rule.ruleType, rule.value.toString())}
            </p>
          </div>
          <CommissionRuleStatusForm ruleId={rule.id} active={rule.isActive} />
        </div>
      </div>

      {query.created ? (
        <SuccessAlert title="สร้างกติกาแล้ว">
          กติกานี้จะถูกใช้กับบิลที่จะอนุมัติหลังจากนี้ตามวันที่มีผล
        </SuccessAlert>
      ) : null}
      {query.updated ? (
        <SuccessAlert title="บันทึกการแก้ไขแล้ว">
          การแก้ไขมีผลกับบิลใหม่เท่านั้น รายการที่ snapshot ไว้แล้วไม่เปลี่ยน
        </SuccessAlert>
      ) : null}
      {query.activated ? (
        <SuccessAlert title="เปิดใช้งานกติกาแล้ว">
          ระบบจะพิจารณากติกานี้เมื่ออนุมัติบิลครั้งถัดไป
        </SuccessAlert>
      ) : null}
      {query.deactivated ? (
        <SuccessAlert title="ปิดใช้งานกติกาแล้ว">
          บิลใหม่จะไม่ใช้กติกานี้ แต่ประวัติรายการเดิมยังอยู่ครบ
        </SuccessAlert>
      ) : null}

      <Card size="sm">
        <CardContent className="grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-muted-foreground">วันที่มีผล</p>
            <p className="mt-1 font-medium">
              {formatThaiDate(rule.effectiveFrom)} –{" "}
              {rule.effectiveTo ? formatThaiDate(rule.effectiveTo) : "ไม่กำหนด"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">ลำดับความสำคัญ</p>
            <p className="mt-1 font-medium tabular-nums">{rule.priority}</p>
          </div>
          <div>
            <p className="text-muted-foreground">รายการที่อ้างอิง</p>
            <p className="mt-1 font-medium tabular-nums">
              {rule._count.entries.toLocaleString("th-TH")} รายการ
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">แก้ไขล่าสุด</p>
            <p className="mt-1 font-medium">{formatThaiDateTime(rule.updatedAt)}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <div className="flex items-center gap-2">
            <Calculator className="size-4 text-primary" aria-hidden />
            <div>
              <CardTitle>รายละเอียดกติกา</CardTitle>
              <CardDescription>
                แก้ไขอัตรา ขอบเขต หรือช่วงวันที่มีผล
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <CommissionRuleForm
            mode="edit"
            ruleId={rule.id}
            initial={initial}
            technicians={options.technicians}
            billTypes={options.billTypes}
            categories={options.categories}
          />
        </CardContent>
      </Card>

      <div className="flex gap-2 rounded-xl border bg-muted/30 p-4 text-xs leading-5 text-muted-foreground">
        <History className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>
          รายการคอมมิชชั่นที่เกิดแล้วเก็บ snapshot ของกติกาและต้นทุนไว้
          การแก้ไขหรือปิดกติกานี้จึงไม่กระทบยอดเก่า
          และประวัติการแก้ไขถูกบันทึกใน audit log
        </p>
      </div>
    </div>
  );
}
