"use client";

import { useActionState, useState } from "react";
import { HandCoins, Info } from "lucide-react";

import {
  ActionFeedback,
  FieldError,
} from "@/components/forms/form-feedback";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
import {
  commissionDateInputValue,
  firstDayOfCurrentMonthInputValue,
} from "@/lib/commission-labels";
import { inputClassName, selectClassName } from "@/lib/form-styles";
import { formatTHB } from "@/lib/money";
import { cn } from "@/lib/utils";
import { createCommissionPayoutAction } from "@/server/actions/commissions";

export type OutstandingTechnician = {
  id: string;
  name: string;
  email: string;
  outstanding: string;
};

export function CommissionPayoutForm({
  technicians,
}: {
  technicians: OutstandingTechnician[];
}) {
  const [state, formAction] = useActionState(
    createCommissionPayoutAction,
    INITIAL_ACTION_STATE,
  );
  const values = state.values;
  const value = (key: string, fallback = "") => values?.[key] ?? fallback;
  const [selectedId, setSelectedId] = useState(value("technicianId"));
  const selected = technicians.find((item) => item.id === selectedId);

  return (
    <form
      key={state.submissionId ?? 0}
      action={formAction}
      className="space-y-4"
    >
      <ActionFeedback state={state} />

      <div className="space-y-2">
        <Label htmlFor="technicianId">ช่างเทคนิค *</Label>
        <select
          id="technicianId"
          name="technicianId"
          required
          value={selectedId}
          onChange={(event) => setSelectedId(event.target.value)}
          className={selectClassName}
          aria-invalid={Boolean(state.fieldErrors?.technicianId)}
        >
          <option value="">เลือกช่างเทคนิค</option>
          {technicians.map((technician) => (
            <option key={technician.id} value={technician.id}>
              {technician.name} — {formatTHB(technician.outstanding)}
            </option>
          ))}
        </select>
        <FieldError fieldErrors={state.fieldErrors} field="technicianId" />
      </div>

      {selected ? (
        <div
          className={cn(
            "rounded-lg border px-3 py-2 text-sm",
            Number(selected.outstanding) < 0
              ? "border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-200"
              : "border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200",
          )}
        >
          <p className="text-[11px] font-medium">ยอดค้างจ่ายปัจจุบัน</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums">
            {formatTHB(selected.outstanding)}
          </p>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="periodStart">วันเริ่มรอบ *</Label>
          <Input
            id="periodStart"
            name="periodStart"
            type="date"
            required
            defaultValue={value(
              "periodStart",
              firstDayOfCurrentMonthInputValue(),
            )}
            aria-invalid={Boolean(state.fieldErrors?.periodStart)}
            className={inputClassName}
          />
          <FieldError fieldErrors={state.fieldErrors} field="periodStart" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="periodEnd">วันสิ้นสุดรอบ *</Label>
          <Input
            id="periodEnd"
            name="periodEnd"
            type="date"
            required
            defaultValue={value("periodEnd", commissionDateInputValue())}
            aria-invalid={Boolean(state.fieldErrors?.periodEnd)}
            className={inputClassName}
          />
          <FieldError fieldErrors={state.fieldErrors} field="periodEnd" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="note">หมายเหตุ</Label>
        <Textarea
          id="note"
          name="note"
          maxLength={2000}
          defaultValue={value("note")}
          className="min-h-16"
          placeholder="เช่น รอบจ่ายปลายเดือน หรือเลขที่โอน"
        />
      </div>

      <div className="flex gap-2 rounded-lg border bg-muted/30 p-3 text-[11px] leading-5 text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <p>
          ระบบจะรวมรายการที่ยังรอจ่ายทั้งหมดถึงวันสิ้นสุดรอบ
          รวมยอดกลับรายการติดลบจากบิลที่ถูกยกเลิก
          และปิดรายการเหล่านั้นเป็นจ่ายแล้วในคราวเดียว
        </p>
      </div>

      <SubmitButton className="h-10 w-full" pendingText="กำลังสร้างรอบจ่าย...">
        <HandCoins aria-hidden />
        สร้างรอบจ่ายและบันทึกว่าจ่ายแล้ว
      </SubmitButton>
    </form>
  );
}
