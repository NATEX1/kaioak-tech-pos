"use client";

import { useActionState } from "react";
import { CircleAlert, FileSpreadsheet, Upload } from "lucide-react";

import { ActionFeedback, FieldError } from "@/components/forms/form-feedback";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
import { inputClassName } from "@/lib/form-styles";
import { cn } from "@/lib/utils";
import { importProductsAction } from "@/server/actions/products";

export function ProductImportForm() {
  const [state, formAction] = useActionState(
    importProductsAction,
    INITIAL_ACTION_STATE,
  );

  return (
    <form
      key={state.submissionId ?? 0}
      action={formAction}
      className="space-y-4"
    >
      <ActionFeedback state={state} />

      {state.details && state.details.length > 0 ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <p className="flex items-center gap-2 text-sm font-medium text-destructive">
            <CircleAlert className="size-4" aria-hidden />
            รายละเอียดที่ต้องแก้
          </p>
          <ul className="mt-2 space-y-1 text-xs text-destructive">
            {state.details.map((detail) => (
              <li key={detail}>• {detail}</li>
            ))}
          </ul>
          {state.details.length >= 20 ? (
            <p className="mt-2 text-[11px] text-destructive/80">
              แสดงข้อผิดพลาดสูงสุด 20 รายการ กรุณาแก้แล้วนำเข้าอีกครั้ง
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="file">ไฟล์ CSV *</Label>
        <Input
          id="file"
          name="file"
          type="file"
          accept=".csv,text/csv"
          required
          className={cn(inputClassName, "h-auto py-2")}
          aria-invalid={Boolean(state.fieldErrors?.file)}
        />
        <FieldError fieldErrors={state.fieldErrors} field="file" />
        <p className="text-[11px] text-muted-foreground">
          รองรับไม่เกิน 2 MB และไม่เกิน 500 แถวต่อครั้ง
        </p>
      </div>

      <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
        <div className="flex gap-2">
          <FileSpreadsheet className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            ระบบจะตรวจทุกแถวก่อนบันทึก หากมีแถวใดผิดจะไม่บันทึกทั้งไฟล์
            (all-or-nothing) และจะไม่เปลี่ยนยอดสต๊อกหรือต้นทุนของสินค้าที่มีสต๊อกอยู่
          </p>
        </div>
      </div>

      <SubmitButton pendingText="กำลังนำเข้า...">
        <Upload aria-hidden />
        นำเข้าข้อมูลสินค้า
      </SubmitButton>
    </form>
  );
}
