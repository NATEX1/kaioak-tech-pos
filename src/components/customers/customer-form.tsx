"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Save } from "lucide-react";

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
import { inputClassName } from "@/lib/form-styles";
import { cn } from "@/lib/utils";
import {
  createCustomerAction,
  updateCustomerAction,
} from "@/server/actions/customers";

type CustomerInitial = {
  name: string;
  phone: string;
  email: string;
  address: string;
  taxId: string;
  note: string;
};

export function CustomerForm({
  mode,
  customerId,
  initial,
}: {
  mode: "create" | "edit";
  customerId?: string;
  initial?: CustomerInitial;
}) {
  const action =
    mode === "create" ? createCustomerAction : updateCustomerAction;
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);
  const values = state.values;
  const value = (key: keyof CustomerInitial) =>
    values?.[key] ?? initial?.[key] ?? "";
  const cancelHref =
    mode === "edit" && customerId ? `/customers/${customerId}` : "/customers";

  return (
    <form key={state.submissionId ?? 0} action={formAction} className="space-y-4">
      {mode === "edit" && customerId ? (
        <input type="hidden" name="customerId" value={customerId} />
      ) : null}
      <ActionFeedback state={state} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="name">ชื่อลูกค้า *</Label>
          <Input
            id="name"
            name="name"
            required
            maxLength={200}
            defaultValue={value("name")}
            aria-invalid={Boolean(state.fieldErrors?.name)}
            className={inputClassName}
            placeholder="เช่น คุณสมชาย ใจดี หรือชื่อบริษัท"
          />
          <FieldError fieldErrors={state.fieldErrors} field="name" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">เบอร์โทร *</Label>
          <Input
            id="phone"
            name="phone"
            required
            inputMode="tel"
            autoComplete="tel"
            maxLength={32}
            defaultValue={value("phone")}
            aria-invalid={Boolean(state.fieldErrors?.phone)}
            className={inputClassName}
            placeholder="081-234-5678"
          />
          <FieldError fieldErrors={state.fieldErrors} field="phone" />
          <p className="text-[11px] text-muted-foreground">
            รองรับ +66 และจัดเก็บเป็นตัวเลขเพื่อป้องกันลูกค้าซ้ำ
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">อีเมล</Label>
          <Input
            id="email"
            name="email"
            type="email"
            maxLength={254}
            autoComplete="email"
            defaultValue={value("email")}
            aria-invalid={Boolean(state.fieldErrors?.email)}
            className={inputClassName}
            placeholder="name@example.com"
          />
          <FieldError fieldErrors={state.fieldErrors} field="email" />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="address">ที่อยู่</Label>
          <Textarea
            id="address"
            name="address"
            maxLength={2000}
            defaultValue={value("address")}
            className="min-h-20"
            placeholder="ที่อยู่สำหรับออกเอกสารหรือติดต่อ"
          />
          <FieldError fieldErrors={state.fieldErrors} field="address" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="taxId">เลขผู้เสียภาษี</Label>
          <Input
            id="taxId"
            name="taxId"
            inputMode="numeric"
            maxLength={20}
            defaultValue={value("taxId")}
            aria-invalid={Boolean(state.fieldErrors?.taxId)}
            className={inputClassName}
            placeholder="13 หลัก (ถ้ามี)"
          />
          <FieldError fieldErrors={state.fieldErrors} field="taxId" />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="note">หมายเหตุ</Label>
          <Textarea
            id="note"
            name="note"
            maxLength={2000}
            defaultValue={value("note")}
            className="min-h-20"
            placeholder="เช่น ลูกค้าประจำ ชอบติดต่อช่วงบ่าย"
          />
          <FieldError fieldErrors={state.fieldErrors} field="note" />
        </div>
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Link
          href={cancelHref}
          className={cn(buttonVariants({ variant: "outline" }), "h-10")}
        >
          ยกเลิก
        </Link>
        <SubmitButton className="h-10" pendingText="กำลังบันทึก...">
          <Save aria-hidden />
          {mode === "create" ? "สร้างลูกค้า" : "บันทึกข้อมูล"}
        </SubmitButton>
      </div>
    </form>
  );
}
