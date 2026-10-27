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
  createCategoryAction,
  updateCategoryAction,
} from "@/server/actions/inventory-settings";

export function CategoryForm({
  mode,
  categoryId,
  initial,
}: {
  mode: "create" | "edit";
  categoryId?: string;
  initial?: { code: string; name: string; description: string };
}) {
  const action =
    mode === "create" ? createCategoryAction : updateCategoryAction;
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);
  const values = state.values;
  const value = (key: string, fallback = "") => values?.[key] ?? fallback;

  return (
    <form key={state.submissionId ?? 0} action={formAction} className="space-y-4">
      {mode === "edit" && categoryId ? (
        <input type="hidden" name="categoryId" value={categoryId} />
      ) : null}
      <ActionFeedback state={state} />

      {mode === "create" ? (
        <div className="space-y-2">
          <Label htmlFor="code">รหัสหมวดหมู่ *</Label>
          <Input
            id="code"
            name="code"
            required
            maxLength={20}
            defaultValue={value("code")}
            aria-invalid={Boolean(state.fieldErrors?.code)}
            className={cn(inputClassName, "font-mono uppercase")}
            placeholder="เช่น CPU"
          />
          <FieldError fieldErrors={state.fieldErrors} field="code" />
          <p className="text-[11px] text-muted-foreground">
            ใช้ A-Z และตัวเลข ใช้เป็น Prefix ของ SKU อัตโนมัติ
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">รหัสหมวดหมู่</p>
          <p className="font-mono text-sm font-semibold">{initial?.code}</p>
          <p className="text-[11px] text-muted-foreground">
            รหัสไม่สามารถแก้ไขได้ หลังสร้างแล้ว
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="name">ชื่อหมวดหมู่ *</Label>
        <Input
          id="name"
          name="name"
          required
          maxLength={100}
          defaultValue={value("name", initial?.name ?? "")}
          aria-invalid={Boolean(state.fieldErrors?.name)}
          className={inputClassName}
          placeholder="เช่น ซีพียู"
        />
        <FieldError fieldErrors={state.fieldErrors} field="name" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">คำอธิบาย</Label>
        <Textarea
          id="description"
          name="description"
          maxLength={2000}
          defaultValue={value(
            "description",
            initial?.description ?? "",
          )}
          className="min-h-20"
        />
        <FieldError fieldErrors={state.fieldErrors} field="description" />
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Link
          href="/inventory/categories"
          className={cn(buttonVariants({ variant: "outline" }), "h-10")}
        >
          ยกเลิก
        </Link>
        <SubmitButton className="h-10" pendingText="กำลังบันทึก...">
          <Save aria-hidden />
          {mode === "create" ? "สร้างหมวดหมู่" : "บันทึก"}
        </SubmitButton>
      </div>
    </form>
  );
}
