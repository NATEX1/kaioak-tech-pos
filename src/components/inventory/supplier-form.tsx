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
  createSupplierAction,
  updateSupplierAction,
} from "@/server/actions/inventory-settings";

type SupplierInitial = {
  name: string;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  taxId: string;
  note: string;
};

export function SupplierForm({
  mode,
  supplierId,
  initial,
}: {
  mode: "create" | "edit";
  supplierId?: string;
  initial?: SupplierInitial;
}) {
  const action =
    mode === "create" ? createSupplierAction : updateSupplierAction;
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);
  const values = state.values;
  const value = (key: keyof SupplierInitial) =>
    values?.[key] ?? initial?.[key] ?? "";

  return (
    <form key={state.submissionId ?? 0} action={formAction} className="space-y-4">
      {mode === "edit" && supplierId ? (
        <input type="hidden" name="supplierId" value={supplierId} />
      ) : null}
      <ActionFeedback state={state} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="name">ชื่อผู้จัดจำหน่าย *</Label>
          <Input
            id="name"
            name="name"
            required
            maxLength={200}
            defaultValue={value("name")}
            aria-invalid={Boolean(state.fieldErrors?.name)}
            className={inputClassName}
            placeholder="ชื่อบริษัทหรือร้านค้า"
          />
          <FieldError fieldErrors={state.fieldErrors} field="name" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="contactName">ผู้ติดต่อ</Label>
          <Input
            id="contactName"
            name="contactName"
            maxLength={150}
            defaultValue={value("contactName")}
            className={inputClassName}
          />
          <FieldError fieldErrors={state.fieldErrors} field="contactName" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">เบอร์โทร</Label>
          <Input
            id="phone"
            name="phone"
            inputMode="tel"
            maxLength={32}
            defaultValue={value("phone")}
            aria-invalid={Boolean(state.fieldErrors?.phone)}
            className={inputClassName}
            placeholder="02-123-4567"
          />
          <FieldError fieldErrors={state.fieldErrors} field="phone" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">อีเมล</Label>
          <Input
            id="email"
            name="email"
            type="email"
            maxLength={254}
            defaultValue={value("email")}
            aria-invalid={Boolean(state.fieldErrors?.email)}
            className={inputClassName}
          />
          <FieldError fieldErrors={state.fieldErrors} field="email" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="taxId">เลขผู้เสียภาษี</Label>
          <Input
            id="taxId"
            name="taxId"
            maxLength={20}
            defaultValue={value("taxId")}
            className={inputClassName}
          />
          <FieldError fieldErrors={state.fieldErrors} field="taxId" />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="address">ที่อยู่</Label>
          <Textarea
            id="address"
            name="address"
            maxLength={2000}
            defaultValue={value("address")}
            className="min-h-20"
          />
          <FieldError fieldErrors={state.fieldErrors} field="address" />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="note">หมายเหตุ</Label>
          <Textarea
            id="note"
            name="note"
            maxLength={2000}
            defaultValue={value("note")}
            className="min-h-20"
          />
          <FieldError fieldErrors={state.fieldErrors} field="note" />
        </div>
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Link
          href="/inventory/suppliers"
          className={cn(buttonVariants({ variant: "outline" }), "h-10")}
        >
          ยกเลิก
        </Link>
        <SubmitButton className="h-10" pendingText="กำลังบันทึก...">
          <Save aria-hidden />
          {mode === "create" ? "สร้างผู้จัดจำหน่าย" : "บันทึก"}
        </SubmitButton>
      </div>
    </form>
  );
}
