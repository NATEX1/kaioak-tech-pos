"use client";

import { useActionState, useMemo, useState } from "react";
import { Calculator, CheckCircle2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
import { inputClassName } from "@/lib/form-styles";
import { Decimal, formatTHB } from "@/lib/money";
import { cn } from "@/lib/utils";
import { saveDayClosingAction } from "@/server/actions/day-closing";

export function DayClosingForm({
  dateKey,
  expectedCash,
  saved,
}: {
  dateKey: string;
  expectedCash: string;
  saved: {
    countedCash: string;
    difference: string;
    note: string | null;
  } | null;
}) {
  const [state, formAction, isPending] = useActionState(
    saveDayClosingAction,
    INITIAL_ACTION_STATE,
  );
  const [counted, setCounted] = useState(
    state.values?.countedCash ?? saved?.countedCash ?? expectedCash,
  );

  const difference = useMemo(() => {
    try {
      return new Decimal(counted || "0").minus(expectedCash);
    } catch {
      return new Decimal(0);
    }
  }, [counted, expectedCash]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="dateKey" value={dateKey} />

      <div className="rounded-xl border bg-muted/20 p-4">
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Calculator className="size-4" aria-hidden />
            เงินสดที่ควรมี
          </span>
          <span className="text-lg font-semibold tabular-nums">
            {formatTHB(expectedCash)}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="countedCash">เงินสดที่นับได้จริง *</Label>
        <Input
          id="countedCash"
          name="countedCash"
          value={counted}
          onChange={(event) => setCounted(event.target.value)}
          inputMode="decimal"
          className={cn(inputClassName, "h-12 text-right text-xl font-semibold tabular-nums")}
          aria-invalid={Boolean(state.fieldErrors?.countedCash)}
        />
        {state.fieldErrors?.countedCash ? (
          <p className="text-xs text-destructive">
            {state.fieldErrors.countedCash[0]}
          </p>
        ) : null}
      </div>

      <div
        className={cn(
          "flex items-center justify-between gap-2 rounded-xl border px-4 py-3 text-sm",
          difference.isZero()
            ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200"
            : difference.isNegative()
              ? "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200"
              : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200",
        )}
      >
        <span>ผลต่าง</span>
        <span className="text-lg font-semibold tabular-nums">
          {difference.greaterThan(0) ? "+" : ""}
          {formatTHB(difference)}
        </span>
      </div>

      <div className="space-y-2">
        <Label htmlFor="closing-note">หมายเหตุการปิดยอด</Label>
        <Textarea
          id="closing-note"
          name="note"
          rows={3}
          maxLength={2_000}
          defaultValue={state.values?.note ?? saved?.note ?? ""}
          placeholder="เช่น เงินทอนเริ่มต้น 2,000 บาท / มีรายจ่ายเงินสด"
        />
      </div>

      {state.status === "error" ? (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:bg-rose-950/30 dark:text-rose-200">
          {state.message}
        </p>
      ) : null}
      {state.status === "success" ? (
        <p className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
          <CheckCircle2 className="size-4" aria-hidden />
          {state.message}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={isPending}>
        <Save aria-hidden />
        {isPending ? "กำลังบันทึก..." : "บันทึกปิดยอดประจำวัน"}
      </Button>
    </form>
  );
}
