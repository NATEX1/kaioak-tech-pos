"use client";

import { useActionState, useState } from "react";
import { Store } from "lucide-react";

import { BrandLogo } from "@/components/brand/brand-mark";
import {
  ActionFeedback,
  FieldError,
} from "@/components/forms/form-feedback";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
import { inputClassName } from "@/lib/form-styles";
import { updateShopSettingsAction } from "@/server/actions/settings";

type ShopSettingsFormProps = {
  settings: {
    shopName: string;
    address: string | null;
    phone: string | null;
    email: string | null;
    taxId: string | null;
    vatEnabled: boolean;
    vatRate: string;
    vatIncluded: boolean;
    receiptFooter: string | null;
    logoUrl: string | null;
  };
};

export function ShopSettingsForm({ settings }: ShopSettingsFormProps) {
  const [state, formAction] = useActionState(
    updateShopSettingsAction,
    INITIAL_ACTION_STATE,
  );
  const [logoPreview, setLogoPreview] = useState(
    state.values?.logoUrl ?? settings.logoUrl ?? "",
  );

  return (
    <form
      key={state.submissionId ?? 0}
      action={formAction}
      className="space-y-6"
    >
      <ActionFeedback state={state} />

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="shopName">ชื่อร้าน *</Label>
          <Input
            id="shopName"
            name="shopName"
            required
            maxLength={120}
            defaultValue={state.values?.shopName ?? settings.shopName}
            className={inputClassName}
            aria-invalid={Boolean(state.fieldErrors?.shopName)}
          />
          <FieldError fieldErrors={state.fieldErrors} field="shopName" />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="logoUrl">โลโก้ร้าน</Label>
          <div className="flex items-start gap-3">
            <BrandLogo
              src={logoPreview}
              alt="ตัวอย่างโลโก้ร้าน"
              size="md"
              className="mt-1"
            />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Input
                id="logoUrl"
                name="logoUrl"
                maxLength={500}
                defaultValue={state.values?.logoUrl ?? settings.logoUrl ?? ""}
                onChange={(event) => setLogoPreview(event.target.value)}
                placeholder="/brand/kaioak-tech-mark.svg"
                className={inputClassName}
                aria-invalid={Boolean(state.fieldErrors?.logoUrl)}
              />
              <p className="text-xs leading-5 text-muted-foreground">
                ระบุพาธไฟล์ในโฟลเดอร์ public เช่น
                /brand/kaioak-tech-mark.svg — เว้นว่างเพื่อใช้โลโก้เริ่มต้น
              </p>
            </div>
          </div>
          <FieldError fieldErrors={state.fieldErrors} field="logoUrl" />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="address">ที่อยู่</Label>
          <Textarea
            id="address"
            name="address"
            rows={3}
            maxLength={600}
            defaultValue={state.values?.address ?? settings.address ?? ""}
            placeholder="ที่อยู่ที่ต้องการแสดงบนใบเสร็จและใบส่งของ"
            aria-invalid={Boolean(state.fieldErrors?.address)}
          />
          <FieldError fieldErrors={state.fieldErrors} field="address" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">เบอร์โทรร้าน</Label>
          <Input
            id="phone"
            name="phone"
            maxLength={32}
            defaultValue={state.values?.phone ?? settings.phone ?? ""}
            className={inputClassName}
            aria-invalid={Boolean(state.fieldErrors?.phone)}
          />
          <FieldError fieldErrors={state.fieldErrors} field="phone" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">อีเมลร้าน</Label>
          <Input
            id="email"
            name="email"
            type="email"
            maxLength={254}
            defaultValue={state.values?.email ?? settings.email ?? ""}
            className={inputClassName}
            aria-invalid={Boolean(state.fieldErrors?.email)}
          />
          <FieldError fieldErrors={state.fieldErrors} field="email" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="taxId">เลขประจำตัวผู้เสียภาษี</Label>
          <Input
            id="taxId"
            name="taxId"
            inputMode="numeric"
            maxLength={13}
            defaultValue={state.values?.taxId ?? settings.taxId ?? ""}
            placeholder="13 หลัก (ไม่บังคับ)"
            className={inputClassName}
            aria-invalid={Boolean(state.fieldErrors?.taxId)}
          />
          <FieldError fieldErrors={state.fieldErrors} field="taxId" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="vatRate">อัตรา VAT (%)</Label>
          <Input
            id="vatRate"
            name="vatRate"
            type="number"
            inputMode="decimal"
            min={0}
            max={100}
            step="0.01"
            required
            defaultValue={state.values?.vatRate ?? settings.vatRate}
            className={inputClassName}
            aria-invalid={Boolean(state.fieldErrors?.vatRate)}
          />
          <FieldError fieldErrors={state.fieldErrors} field="vatRate" />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="receiptFooter">ข้อความท้ายใบเสร็จ</Label>
          <Textarea
            id="receiptFooter"
            name="receiptFooter"
            rows={2}
            maxLength={1_000}
            defaultValue={
              state.values?.receiptFooter ?? settings.receiptFooter ?? ""
            }
            placeholder="เช่น ขอบคุณที่ใช้บริการ / รับประกันตามเงื่อนไขร้าน"
            aria-invalid={Boolean(state.fieldErrors?.receiptFooter)}
          />
          <FieldError fieldErrors={state.fieldErrors} field="receiptFooter" />
        </div>
      </div>

      <div className="space-y-4 rounded-xl border bg-muted/30 p-4">
        <div className="flex items-start gap-3">
          <input
            id="vatEnabled"
            name="vatEnabled"
            type="checkbox"
            defaultChecked={
              state.values?.vatEnabled
                ? state.values.vatEnabled === "true"
                : settings.vatEnabled
            }
            className="mt-0.5 size-4 rounded border-input accent-primary"
          />
          <div>
            <Label htmlFor="vatEnabled" className="cursor-pointer">
              เปิดใช้ VAT กับบิลใหม่
            </Label>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              บิลที่สร้างแล้วจะยังใช้ค่า VAT snapshot เดิม
              การเปลี่ยนค่านี้มีผลกับบิลที่สร้างใหม่เท่านั้น
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <input
            id="vatIncluded"
            name="vatIncluded"
            type="checkbox"
            defaultChecked={
              state.values?.vatIncluded
                ? state.values.vatIncluded === "true"
                : settings.vatIncluded
            }
            className="mt-0.5 size-4 rounded border-input accent-primary"
          />
          <div>
            <Label htmlFor="vatIncluded" className="cursor-pointer">
              ราคาขายรวม VAT แล้ว
            </Label>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              ร้านนี้ใช้ราคารวม VAT ตามค่าเริ่มต้น
              ระบบจะแยกยอดก่อน VAT และ VAT ให้เมื่อเปิดใช้งาน
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Store className="size-3.5" aria-hidden />
          ข้อมูลนี้ใช้บนใบเสร็จ A4 และสลิป 80 มม.
        </p>
        <SubmitButton pendingText="กำลังบันทึก...">
          บันทึกข้อมูลร้าน
        </SubmitButton>
      </div>
    </form>
  );
}
