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
import { resetUserPasswordAction } from "@/server/actions/users";

export function ResetPasswordForm({ userId }: { userId: string }) {
  const [state, formAction] = useActionState(
    resetUserPasswordAction,
    INITIAL_ACTION_STATE,
  );
  const fieldErrors = state.fieldErrors;

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="userId" value={userId} />

      <ActionFeedback state={state} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="reset-password">รหัสผ่านใหม่</Label>
          <Input
            id="reset-password"
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
          <Label htmlFor="reset-confirm-password">ยืนยันรหัสผ่านใหม่</Label>
          <Input
            id="reset-confirm-password"
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

      <SubmitButton variant="outline" pendingText="กำลังเปลี่ยนรหัสผ่าน...">
        <KeyRound aria-hidden />
        ตั้งรหัสผ่านใหม่
      </SubmitButton>
    </form>
  );
}
