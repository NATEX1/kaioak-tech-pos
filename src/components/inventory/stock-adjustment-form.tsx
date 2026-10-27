"use client";

import { useActionState, useState } from "react";
import { Save } from "lucide-react";

import { ActionFeedback } from "@/components/forms/form-feedback";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
import { inputClassName, selectClassName } from "@/lib/form-styles";
import { adjustStockAction } from "@/server/actions/stock";

type StockAdjustmentFormProps = {
  productId: string;
  trackSerial: boolean;
  stockQty: number;
  costPrice: string;
};

export function StockAdjustmentForm({
  productId,
  trackSerial,
  stockQty,
  costPrice,
}: StockAdjustmentFormProps) {
  const [state, formAction] = useActionState(
    adjustStockAction,
    INITIAL_ACTION_STATE,
  );
  const values = state.values;
  const [serialText, setSerialText] = useState(values?.serialNumbers ?? "");

  const serialCount = serialText
    .split(/[\n,]+/)
    .map((value) => value.trim())
    .filter(Boolean).length;

  return (
    <form key={state.submissionId ?? 0} action={formAction} className="space-y-4">
      <input type="hidden" name="productId" value={productId} />
      <ActionFeedback state={state} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="direction">ประเภทการปรับ</Label>
          <select
            id="direction"
            name="direction"
            defaultValue={values?.direction ?? "IN"}
            className={selectClassName}
          >
            <option value="IN">รับเข้า / เพิ่มยอด</option>
            <option value="OUT">ตัดออก / ลดยอด</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="quantity">จำนวน *</Label>
          <Input
            id="quantity"
            name="quantity"
            type="number"
            min={1}
            max={10000}
            step={1}
            required
            defaultValue={values?.quantity ?? "1"}
            className={inputClassName}
            aria-invalid={Boolean(state.fieldErrors?.quantity)}
          />
          <p className="text-[11px] text-destructive">
            {state.fieldErrors?.quantity?.[0]}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="unitCost">
          ต้นทุนต่อหน่วย (บาท)
          <span className="ml-1 font-normal text-muted-foreground">
            ใช้เมื่อรับเข้า
          </span>
        </Label>
        <Input
          id="unitCost"
          name="unitCost"
          inputMode="decimal"
          defaultValue={values?.unitCost ?? costPrice}
          className={inputClassName}
          aria-invalid={Boolean(state.fieldErrors?.unitCost)}
          placeholder={costPrice}
        />
        <p className="text-[11px] text-destructive">
          {state.fieldErrors?.unitCost?.[0]}
        </p>
        <p className="text-[11px] text-muted-foreground">
          เมื่อรับเข้าจะคำนวณต้นทุนเฉลี่ยใหม่จากยอดคงเหลือ {stockQty} ชิ้น
        </p>
      </div>

      {trackSerial ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="serialNumbers">
              Serial Number (หนึ่งบรรทัดต่อหนึ่งเครื่อง) *
            </Label>
            <span className="text-[11px] text-muted-foreground">
              {serialCount} รายการ
            </span>
          </div>
          <Textarea
            id="serialNumbers"
            name="serialNumbers"
            value={serialText}
            onChange={(event) => setSerialText(event.target.value)}
            className="min-h-28 font-mono text-xs"
            placeholder={
              "SN-000001\nSN-000002\n\nสแกนหรือพิมพ์ Serial แล้วขึ้นบรรทัดใหม่"
            }
            aria-invalid={Boolean(state.fieldErrors?.serialNumbers)}
          />
          <p className="text-[11px] text-destructive">
            {state.fieldErrors?.serialNumbers?.[0]}
          </p>
          <p className="text-[11px] text-muted-foreground">
            จำนวน Serial ต้องตรงกับจำนวนที่ปรับ สำหรับการตัดออก
            ระบบจะเปลี่ยนสถานะ Serial เป็น “ตัดจำหน่าย”
          </p>
        </div>
      ) : (
        <p className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
          สินค้านี้ไม่ได้ติดตาม Serial จึงไม่ต้องระบุเลขเครื่อง
        </p>
      )}

      <div className="space-y-2">
        <Label htmlFor="reason">เหตุผล *</Label>
        <Textarea
          id="reason"
          name="reason"
          required
          minLength={3}
          maxLength={500}
          defaultValue={values?.reason ?? ""}
          className="min-h-20"
          placeholder="เช่น นับสต๊อกแล้วพบส่วนต่าง / ของชำรุด / คืนจากลูกค้า"
          aria-invalid={Boolean(state.fieldErrors?.reason)}
        />
        <p className="text-[11px] text-destructive">
          {state.fieldErrors?.reason?.[0]}
        </p>
      </div>

      <SubmitButton pendingText="กำลังปรับสต๊อก...">
        <Save aria-hidden />
        บันทึกการปรับสต๊อก
      </SubmitButton>
    </form>
  );
}
