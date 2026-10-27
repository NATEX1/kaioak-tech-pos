"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";

import {
  ActionFeedback,
  FieldError,
} from "@/components/forms/form-feedback";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Role } from "@/generated/prisma/enums";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
import { inputClassName, selectClassName } from "@/lib/form-styles";
import { cn } from "@/lib/utils";
import { updateUserAction } from "@/server/actions/users";

type EditableUser = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
};

export function EditUserForm({
  user,
  isSelf,
}: {
  user: EditableUser;
  isSelf: boolean;
}) {
  const [state, formAction] = useActionState(
    updateUserAction,
    INITIAL_ACTION_STATE,
  );
  const fieldErrors = state.fieldErrors;
  const values = state.values;

  return (
    <form
      key={state.submissionId ?? 0}
      action={formAction}
      className="space-y-5"
    >
      <input type="hidden" name="userId" value={user.id} />
      {isSelf ? <input type="hidden" name="role" value={user.role} /> : null}

      <ActionFeedback state={state} />

      <div className="space-y-2">
        <Label htmlFor="edit-email">อีเมล</Label>
        <Input
          id="edit-email"
          type="email"
          value={user.email}
          disabled
          className={inputClassName}
        />
        <p className="text-xs text-muted-foreground">
          อีเมลใช้ระบุตัวตนและไม่สามารถแก้ไขได้ในหน้านี้
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="edit-name">ชื่อที่แสดง</Label>
          <Input
            id="edit-name"
            name="name"
            defaultValue={values?.name ?? user.name}
            autoComplete="name"
            required
            className={inputClassName}
            aria-invalid={Boolean(fieldErrors?.name)}
          />
          <FieldError fieldErrors={fieldErrors} field="name" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="edit-phone">เบอร์โทร (ไม่บังคับ)</Label>
          <Input
            id="edit-phone"
            name="phone"
            type="tel"
            defaultValue={values?.phone ?? user.phone ?? ""}
            autoComplete="tel"
            className={inputClassName}
            aria-invalid={Boolean(fieldErrors?.phone)}
          />
          <FieldError fieldErrors={fieldErrors} field="phone" />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="edit-role">บทบาท</Label>
          <select
            id="edit-role"
            name={isSelf ? undefined : "role"}
            defaultValue={values?.role ?? user.role}
            disabled={isSelf}
            className={cn(selectClassName, "max-w-sm")}
            aria-invalid={Boolean(fieldErrors?.role)}
          >
            <option value="TECHNICIAN">ช่างเทคนิค</option>
            <option value="ADMIN">ผู้ดูแลระบบ</option>
          </select>
          <FieldError fieldErrors={fieldErrors} field="role" />
          {isSelf ? (
            <p className="text-xs text-muted-foreground">
              ไม่สามารถเปลี่ยนบทบาทของบัญชีที่กำลังใช้งานอยู่ได้
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              การเปลี่ยนบทบาทจะยกเลิก session เดิมของผู้ใช้นี้ทันที
            </p>
          )}
        </div>
      </div>

      <SubmitButton pendingText="กำลังบันทึก...">
        <Save aria-hidden />
        บันทึกข้อมูล
      </SubmitButton>
    </form>
  );
}
