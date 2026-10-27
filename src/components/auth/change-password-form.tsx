"use client";

import { useActionState } from "react";
import { KeyRound } from "lucide-react";

import {
  ActionFeedback,
  FieldError,
} from "@/components/forms/form-feedback";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
import { inputClassName } from "@/lib/form-styles";
import { changeOwnPasswordAction } from "@/server/actions/users";

export function ChangePasswordForm() {
  const [state, formAction] = useActionState(
    changeOwnPasswordAction,
    INITIAL_ACTION_STATE,
  );
  const fieldErrors = state.fieldErrors;

  return (
    <form action={formAction} className="space-y-5">
      <ActionFeedback state={state} />

      <div className="space-y-2">
        <Label htmlFor="current-password">รหัสผ่านปัจจุบัน</Label>
        <Input
          id="current-password"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          className={inputClassName}
          aria-invalid={Boolean(fieldErrors?.currentPassword)}
        />
        <FieldError fieldErrors={fieldErrors} field="currentPassword" />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="new-password">รหัสผ่านใหม่</Label>
          <Input
            id="new-password"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="อย่างน้อย 12 ตัวอักษร"
            required
            className={inputClassName}
            aria-invalid={Boolean(fieldErrors?.password)}
          />
          <FieldError fieldErrors={fieldErrors} field="password" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm-new-password">ยืนยันรหัสผ่านใหม่</Label>
          <Input
            id="confirm-new-password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            placeholder="กรอกรหัสผ่านอีกครั้ง"
            required
            className={inputClassName}
            aria-invalid={Boolean(fieldErrors?.confirmPassword)}
          />
          <FieldError fieldErrors={fieldErrors} field="confirmPassword" />
        </div>
      </div>

      <p className="rounded-lg border bg-muted/40 px-3 py-2 text-xs leading-5 text-muted-foreground">
        เมื่อเปลี่ยนรหัสผ่าน ระบบจะออกจากทุก session ของบัญชีนี้
        และให้เข้าสู่ระบบใหม่ด้วยรหัสผ่านใหม่
      </p>

      <SubmitButton pendingText="กำลังเปลี่ยนรหัสผ่าน...">
        <KeyRound aria-hidden />
        เปลี่ยนรหัสผ่านและออกจากระบบ
      </SubmitButton>
    </form>
  );
}
