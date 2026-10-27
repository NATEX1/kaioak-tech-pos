import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Calculator } from "lucide-react";

import { CommissionRuleForm } from "@/components/commissions/commission-rule-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireAdmin } from "@/server/auth/session";
import { listCommissionRuleOptions } from "@/server/services/commissions";

export const instant = false;

export const metadata: Metadata = {
  title: "เพิ่มกติกาค่าคอมมิชชั่น",
};

export default async function NewCommissionRulePage() {
  const actor = await requireAdmin();
  const options = await listCommissionRuleOptions({
    id: actor.id,
    role: actor.role,
  });

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
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          เพิ่มกติกาค่าคอมมิชชั่น
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          สร้างกติกาใหม่สำหรับบิลที่อนุมัติหลังจากนี้
        </p>
      </div>

      <Card>
        <CardHeader className="border-b">
          <div className="flex items-center gap-2">
            <Calculator className="size-4 text-primary" aria-hidden />
            <div>
              <CardTitle>รายละเอียดกติกา</CardTitle>
              <CardDescription>
                ค่าที่บันทึกจะถูกใช้คำนวณและเก็บ snapshot ไว้กับรายการคอมมิชชั่น
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <CommissionRuleForm
            mode="create"
            technicians={options.technicians}
            billTypes={options.billTypes}
            categories={options.categories}
          />
        </CardContent>
      </Card>
    </div>
  );
}
