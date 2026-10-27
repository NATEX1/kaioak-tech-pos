"use client";

import { useActionState, useState } from "react";
import { LogIn } from "lucide-react";

import {
  ActionFeedback,
  FieldError,
} from "@/components/forms/form-feedback";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
import { inputClassName } from "@/lib/form-styles";
import { loginAction } from "@/server/actions/auth";

export function LoginForm({ nextPath }: { nextPath: string }) {
  const [state, formAction] = useActionState(loginAction, INITIAL_ACTION_STATE);
  const [email, setEmail] = useState("");
  const fieldErrors = state.fieldErrors;

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="next" value={nextPath} />

      <ActionFeedback state={state} />

      <div className="space-y-2">
        <Label htmlFor="email">อีเมล</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          inputMode="email"
          placeholder="name@example.com"
          required
          autoFocus
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className={inputClassName}
          aria-invalid={Boolean(fieldErrors?.email)}
        />
        <FieldError fieldErrors={fieldErrors} field="email" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">รหัสผ่าน</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="กรอกรหัสผ่าน"
          required
          className={inputClassName}
          aria-invalid={Boolean(fieldErrors?.password)}
        />
        <FieldError fieldErrors={fieldErrors} field="password" />
      </div>

      <SubmitButton
        size="lg"
        className="h-11 w-full"
        pendingText="กำลังเข้าสู่ระบบ..."
      >
        <LogIn aria-hidden />
        เข้าสู่ระบบ
      </SubmitButton>

      <p className="text-center text-xs leading-5 text-muted-foreground">
        ระบบจะออกจากระบบอัตโนมัติเมื่อไม่มีการใช้งาน 30 นาที
        <br />
        และอย่างช้าที่สุด 12 ชั่วโมงหลังเข้าสู่ระบบ
      </p>
    </form>
  );
}
