"use client";

import { useActionState } from "react";
import { Barcode, Star, Trash2 } from "lucide-react";

import { FieldError } from "@/components/forms/form-feedback";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
import { inputClassName, selectClassName } from "@/lib/form-styles";
import { cn } from "@/lib/utils";
import {
  addBarcodeAction,
  removeBarcodeAction,
  setPrimaryBarcodeAction,
} from "@/server/actions/products";

export function AddBarcodeForm({ productId }: { productId: string }) {
  const [state, formAction] = useActionState(
    addBarcodeAction,
    INITIAL_ACTION_STATE,
  );
  const values = state.values;

  return (
    <form
      key={state.submissionId ?? 0}
      action={formAction}
      className="space-y-3 rounded-lg border bg-muted/20 p-3"
    >
      <input type="hidden" name="productId" value={productId} />
      <div className="flex items-center gap-2 text-sm font-medium">
        <Barcode className="size-4 text-primary" aria-hidden />
        เพิ่มบาร์โค้ด
      </div>
      {state.status === "error" && state.message ? (
        <p className="text-xs text-destructive">{state.message}</p>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_140px_auto]">
        <div className="space-y-1.5">
          <Label htmlFor="barcode" className="sr-only">
            บาร์โค้ด
          </Label>
          <Input
            id="barcode"
            name="barcode"
            required
            maxLength={64}
            defaultValue={values?.barcode ?? ""}
            aria-invalid={Boolean(state.fieldErrors?.barcode)}
            className={cn(inputClassName, "font-mono")}
            placeholder="สแกนหรือพิมพ์บาร์โค้ด"
          />
          <FieldError fieldErrors={state.fieldErrors} field="barcode" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="barcodeType" className="sr-only">
            ชนิดบาร์โค้ด
          </Label>
          <select
            id="barcodeType"
            name="type"
            defaultValue={values?.type ?? "CODE128"}
            className={selectClassName}
            aria-label="ชนิดบาร์โค้ด"
          >
            <option value="CODE128">Code 128</option>
            <option value="EAN13">EAN-13</option>
          </select>
        </div>
        <div className="flex items-center gap-3">
          <label className="inline-flex h-10 items-center gap-2 whitespace-nowrap text-xs">
            <input
              type="checkbox"
              name="isPrimary"
              defaultChecked={values?.isPrimary === "true"}
              className="size-4 accent-primary"
            />
            ตั้งเป็นหลัก
          </label>
          <SubmitButton size="sm" pendingText="กำลังเพิ่ม...">
            เพิ่ม
          </SubmitButton>
        </div>
      </div>
    </form>
  );
}

export function RemoveBarcodeForm({
  productId,
  barcodeId,
  barcode,
}: {
  productId: string;
  barcodeId: string;
  barcode: string;
}) {
  const [state, formAction] = useActionState(
    removeBarcodeAction,
    INITIAL_ACTION_STATE,
  );

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!window.confirm(`ลบบาร์โค้ด ${barcode} ?`)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="barcodeId" value={barcodeId} />
      {state.status === "error" && state.message ? (
        <p className="max-w-48 text-right text-[10px] text-destructive">
          {state.message}
        </p>
      ) : null}
      <SubmitButton
        variant="ghost"
        size="icon-sm"
        aria-label={`ลบบาร์โค้ด ${barcode}`}
        pendingText=""
      >
        <Trash2 aria-hidden />
      </SubmitButton>
    </form>
  );
}

export function SetPrimaryBarcodeForm({
  productId,
  barcodeId,
}: {
  productId: string;
  barcodeId: string;
}) {
  const [state, formAction] = useActionState(
    setPrimaryBarcodeAction,
    INITIAL_ACTION_STATE,
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="barcodeId" value={barcodeId} />
      {state.status === "error" && state.message ? (
        <p className="max-w-48 text-right text-[10px] text-destructive">
          {state.message}
        </p>
      ) : null}
      <SubmitButton
        variant="outline"
        size="sm"
        pendingText="..."
        title="ตั้งเป็นบาร์โค้ดหลัก"
      >
        <Star aria-hidden />
        ตั้งเป็นหลัก
      </SubmitButton>
    </form>
  );
}
