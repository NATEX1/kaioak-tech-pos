"use client";

import Link from "next/link";
import { useActionState } from "react";
import { UserPlus } from "lucide-react";

import {
  ActionFeedback,
  FieldError,
} from "@/components/forms/form-feedback";
import { SubmitButton } from "@/components/forms/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
import { inputClassName, selectClassName } from "@/lib/form-styles";
import { cn } from "@/lib/utils";
import { createUserAction } from "@/server/actions/users";

export function CreateUserForm() {
  const [state, formAction] = useActionState(
    createUserAction,
    INITIAL_ACTION_STATE,
  );
  const fieldErrors = state.fieldErrors;
  const values = state.values;

  return (
    <form
      key={state.submissionId ?? 0}
      action={formAction}
      className="space-y-6"
    >
      <ActionFeedback state={state} />

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">ชื่อที่แสดง</Label>
          <Input
            id="name"
            name="name"
            autoComplete="name"
            placeholder="เช่น ช่างสมชาย ใจดี"
            defaultValue={values?.name ?? ""}
            required
            className={inputClassName}
            aria-invalid={Boolean(fieldErrors?.name)}
          />
          <FieldError fieldErrors={fieldErrors} field="name" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">เบอร์โทร (ไม่บังคับ)</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            placeholder="08xxxxxxxx"
            defaultValue={values?.phone ?? ""}
            className={inputClassName}
            aria-invalid={Boolean(fieldErrors?.phone)}
          />
          <FieldError fieldErrors={fieldErrors} field="phone" />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="email">อีเมลสำหรับเข้าสู่ระบบ</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="technician@example.com"
            defaultValue={values?.email ?? ""}
            required
            className={inputClassName}
            aria-invalid={Boolean(fieldErrors?.email)}
          />
          <FieldError fieldErrors={fieldErrors} field="email" />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="role">บทบาท</Label>
          <select
            id="role"
            name="role"
            defaultValue={values?.role ?? "TECHNICIAN"}
            className={cn(selectClassName, "max-w-sm")}
            aria-invalid={Boolean(fieldErrors?.role)}
          >
            <option value="TECHNICIAN">ช่างเทคนิค</option>
            <option value="ADMIN">ผู้ดูแลระบบ</option>
          </select>
          <FieldError fieldErrors={fieldErrors} field="role" />
          <p className="text-xs leading-5 text-muted-foreground">
            ช่างเทคนิคจัดการบิลของตนเอง ส่วนผู้ดูแลระบบจัดการได้ทั้งระบบ
            และอนุมัติบิล
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">รหัสผ่านชั่วคราว</Label>
          <Input
            id="password"
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
          <Label htmlFor="confirmPassword">ยืนยันรหัสผ่าน</Label>
          <Input
            id="confirmPassword"
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
        รหัสผ่านต้องมีอย่างน้อย 12 ตัวอักษร มีตัวอักษรอังกฤษและตัวเลขอย่างน้อย
        หนึ่งตัว และไม่เกิน 72 ไบต์ เมื่อสร้างบัญชีแล้ว
        กรุณาส่งรหัสผ่านชั่วคราวให้ผู้ใช้ผ่านช่องทางที่ปลอดภัย
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <SubmitButton pendingText="กำลังสร้างบัญชี...">
          <UserPlus aria-hidden />
          สร้างบัญชีผู้ใช้
        </SubmitButton>
        <Link
          href="/settings/users"
          className={cn(buttonVariants({ variant: "ghost" }), "h-8")}
        >
          ยกเลิก
        </Link>
      </div>
    </form>
  );
}
