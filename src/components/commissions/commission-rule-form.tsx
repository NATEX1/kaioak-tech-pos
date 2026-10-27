"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Calculator, Save } from "lucide-react";

import {
  ActionFeedback,
  FieldError,
} from "@/components/forms/form-feedback";
import { SubmitButton } from "@/components/forms/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
import { commissionDateInputValue } from "@/lib/commission-labels";
import { inputClassName, selectClassName } from "@/lib/form-styles";
import { cn } from "@/lib/utils";
import {
  createCommissionRuleAction,
  updateCommissionRuleAction,
} from "@/server/actions/commissions";

type TechnicianOption = {
  id: string;
  name: string;
  isActive: boolean;
};

type BillTypeOption = {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
};

type CategoryOption = {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  deletedAt: Date | null;
};

export type CommissionRuleInitial = {
  id?: string;
  name: string;
  description: string;
  ruleType: "PERCENT_REVENUE" | "PERCENT_PROFIT" | "FIXED_PER_BILL";
  value: string;
  technicianId: string;
  billTypeId: string;
  categoryId: string;
  priority: string;
  effectiveFrom: string;
  effectiveTo: string;
  isActive: boolean;
};

export function CommissionRuleForm({
  mode,
  ruleId,
  initial,
  technicians,
  billTypes,
  categories,
}: {
  mode: "create" | "edit";
  ruleId?: string;
  initial?: CommissionRuleInitial;
  technicians: TechnicianOption[];
  billTypes: BillTypeOption[];
  categories: CategoryOption[];
}) {
  const action =
    mode === "create" ? createCommissionRuleAction : updateCommissionRuleAction;
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);
  const values = state.values;
  const value = (key: string, fallback = "") => values?.[key] ?? fallback;
  const active =
    values?.isActive !== undefined
      ? values.isActive === "true"
      : (initial?.isActive ?? true);

  return (
    <form
      key={state.submissionId ?? 0}
      action={formAction}
      className="space-y-5"
    >
      {mode === "edit" && ruleId ? (
        <input type="hidden" name="ruleId" value={ruleId} />
      ) : null}
      <ActionFeedback state={state} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="name">ชื่อกติกา *</Label>
          <Input
            id="name"
            name="name"
            required
            minLength={2}
            maxLength={120}
            defaultValue={value("name", initial?.name ?? "")}
            aria-invalid={Boolean(state.fieldErrors?.name)}
            className={inputClassName}
            placeholder="เช่น ค่าคอมพื้นฐาน 2% จากยอดขาย"
          />
          <FieldError fieldErrors={state.fieldErrors} field="name" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ruleType">ประเภทการคำนวณ *</Label>
          <select
            id="ruleType"
            name="ruleType"
            required
            defaultValue={value("ruleType", initial?.ruleType ?? "PERCENT_REVENUE")}
            className={selectClassName}
            aria-invalid={Boolean(state.fieldErrors?.ruleType)}
          >
            <option value="PERCENT_REVENUE">เปอร์เซ็นต์จากยอดขายก่อน VAT</option>
            <option value="PERCENT_PROFIT">เปอร์เซ็นต์จากกำไรหลังต้นทุน</option>
            <option value="FIXED_PER_BILL">จำนวนคงที่ต่อบิล</option>
          </select>
          <FieldError fieldErrors={state.fieldErrors} field="ruleType" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="value">อัตรา / จำนวน *</Label>
          <Input
            id="value"
            name="value"
            inputMode="decimal"
            required
            defaultValue={value("value", initial?.value ?? "")}
            aria-invalid={Boolean(state.fieldErrors?.value)}
            className={inputClassName}
            placeholder="เช่น 2.0000 หรือ 150.00"
          />
          <FieldError fieldErrors={state.fieldErrors} field="value" />
          <p className="text-[11px] text-muted-foreground">
            เปอร์เซ็นต์กรอก 0–100; จำนวนคงที่กรอกเป็นบาท สูงสุด 4 ตำแหน่งทศนิยม
          </p>
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="description">คำอธิบาย</Label>
          <Textarea
            id="description"
            name="description"
            maxLength={2000}
            defaultValue={value("description", initial?.description ?? "")}
            className="min-h-20"
            placeholder="รายละเอียดเพิ่มเติมเกี่ยวกับกติกานี้"
          />
          <FieldError fieldErrors={state.fieldErrors} field="description" />
        </div>
      </div>

      <div className="rounded-xl border bg-muted/20 p-4">
        <div className="flex items-center gap-2">
          <Calculator className="size-4 text-primary" aria-hidden />
          <div>
            <p className="text-sm font-medium">ขอบเขตการใช้งาน</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              เว้นว่างไว้เพื่อให้กติกาครอบคลุมทุกค่า ระบบเลือกกติกาที่เฉพาะเจาะจงที่สุดเพียงข้อเดียวต่อบิล
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="technicianId">ช่างเทคนิค</Label>
            <select
              id="technicianId"
              name="technicianId"
              defaultValue={value("technicianId", initial?.technicianId ?? "")}
              className={selectClassName}
            >
              <option value="">ทุกช่าง</option>
              {technicians.map((technician) => (
                <option key={technician.id} value={technician.id}>
                  {technician.name}
                  {technician.isActive ? "" : " (ปิดใช้งาน)"}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="billTypeId">ประเภทบิล</Label>
            <select
              id="billTypeId"
              name="billTypeId"
              defaultValue={value("billTypeId", initial?.billTypeId ?? "")}
              className={selectClassName}
            >
              <option value="">ทุกประเภทบิล</option>
              {billTypes.map((billType) => (
                <option key={billType.id} value={billType.id}>
                  {billType.name} · {billType.code}
                  {billType.isActive ? "" : " (ปิดใช้งาน)"}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="categoryId">หมวดหมู่สินค้า</Label>
            <select
              id="categoryId"
              name="categoryId"
              defaultValue={value("categoryId", initial?.categoryId ?? "")}
              className={selectClassName}
            >
              <option value="">ทุกหมวดหมู่</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name} · {category.code}
                  {category.deletedAt || !category.isActive
                    ? " (ปิดใช้งาน)"
                    : ""}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
          หมวดหมู่จะจับจากสินค้าในบิล; กติกาที่ระบุช่างมีน้ำหนักเฉพาะเจาะจงสูงสุด
          รองลงมาคือประเภทบิลและหมวดหมู่ จากนั้นจึงใช้ลำดับความสำคัญ
          <span className="mt-1 block font-medium text-foreground">
            หมายเหตุ: กติกาที่ระบุหมวดหมู่จะใช้ยอดสุทธิของทั้งบิล
            เมื่อบิลมีสินค้าในหมวดนั้นอย่างน้อยหนึ่งรายการ
          </span>
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="priority">ลำดับความสำคัญ</Label>
          <Input
            id="priority"
            name="priority"
            type="number"
            min={0}
            max={9999}
            step={1}
            defaultValue={value("priority", initial?.priority ?? "0")}
            aria-invalid={Boolean(state.fieldErrors?.priority)}
            className={inputClassName}
          />
          <FieldError fieldErrors={state.fieldErrors} field="priority" />
          <p className="text-[11px] text-muted-foreground">
            ตัวเลขมากกว่าจะชนะเมื่อความเฉพาะเจาะจงเท่ากัน
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="effectiveFrom">วันเริ่มมีผล *</Label>
          <Input
            id="effectiveFrom"
            name="effectiveFrom"
            type="date"
            required
            defaultValue={value(
              "effectiveFrom",
              initial?.effectiveFrom ?? commissionDateInputValue(),
            )}
            aria-invalid={Boolean(state.fieldErrors?.effectiveFrom)}
            className={inputClassName}
          />
          <FieldError fieldErrors={state.fieldErrors} field="effectiveFrom" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="effectiveTo">วันสิ้นสุด (ไม่บังคับ)</Label>
          <Input
            id="effectiveTo"
            name="effectiveTo"
            type="date"
            defaultValue={value("effectiveTo", initial?.effectiveTo ?? "")}
            aria-invalid={Boolean(state.fieldErrors?.effectiveTo)}
            className={inputClassName}
          />
          <FieldError fieldErrors={state.fieldErrors} field="effectiveTo" />
        </div>
      </div>

      <label className="flex items-start gap-2 rounded-lg border bg-background p-3 text-sm">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={active}
          className="mt-0.5 size-4 rounded border-input accent-primary"
        />
        <span>
          <span className="font-medium">เปิดใช้งานกติกานี้</span>
          <span className="mt-0.5 block text-[11px] text-muted-foreground">
            กติกาที่ปิดอยู่จะไม่ถูกเลือกตอนอนุมัติบิล แต่ประวัติรายการเดิมยังอยู่
          </span>
        </span>
      </label>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Link
          href={
            mode === "edit" && ruleId
              ? `/commissions/rules/${ruleId}`
              : "/commissions/rules"
          }
          className={cn(buttonVariants({ variant: "outline" }), "h-10")}
        >
          ยกเลิก
        </Link>
        <SubmitButton className="h-10" pendingText="กำลังบันทึก...">
          <Save aria-hidden />
          {mode === "create" ? "สร้างกติกา" : "บันทึกการแก้ไข"}
        </SubmitButton>
      </div>
    </form>
  );
}
