"use client";

import { Tabs } from "@base-ui/react/tabs";
import {
  CreditCard,
  MessageSquareText,
  ReceiptText,
  Store,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import {
  useActionState,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

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
import { repairStatusLabel } from "@/lib/bill-labels";
import { inputClassName } from "@/lib/form-styles";
import {
  DEFAULT_MESSAGE_TEMPLATES,
  REPAIR_STATUS_ORDER,
} from "@/lib/messaging";
import { cn } from "@/lib/utils";
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
    promptpayId: string | null;
    bankInfo: string | null;
    lineId: string | null;
    whatsapp: string | null;
    repairWarrantyDays: number;
    quoteValidityDays: number;
    repairTerms: string | null;
    messageTemplates: Record<string, string> | null;
  };
};

type TabValue = "store" | "receipt" | "payment" | "service" | "messages";

const TAB_ITEMS: Array<{
  value: TabValue;
  label: string;
  icon: LucideIcon;
}> = [
  { value: "store", label: "ข้อมูลร้าน", icon: Store },
  { value: "receipt", label: "ใบเสร็จและภาษี", icon: ReceiptText },
  { value: "payment", label: "การชำระเงิน", icon: CreditCard },
  { value: "service", label: "งานซ่อมและใบเสนอราคา", icon: Wrench },
  { value: "messages", label: "ข้อความแจ้งลูกค้า", icon: MessageSquareText },
];

const TAB_FIELDS: Record<TabValue, readonly string[]> = {
  store: [
    "shopName",
    "logoUrl",
    "address",
    "phone",
    "email",
    "lineId",
    "whatsapp",
  ],
  receipt: [
    "taxId",
    "vatRate",
    "vatEnabled",
    "vatIncluded",
    "receiptFooter",
  ],
  payment: ["promptpayId", "bankInfo"],
  service: ["quoteValidityDays", "repairWarrantyDays", "repairTerms"],
  messages: [
    "messageTemplates",
    ...REPAIR_STATUS_ORDER.map((status) => `template_${status}`),
  ],
};

function findErrorTab(
  fieldErrors: Record<string, string[] | undefined> | undefined,
): TabValue | null {
  if (!fieldErrors) {
    return null;
  }

  for (const item of TAB_ITEMS) {
    if (
      TAB_FIELDS[item.value].some(
        (field) => fieldErrors[field]?.length,
      )
    ) {
      return item.value;
    }
  }

  return null;
}

function findFieldTab(fieldName: string): TabValue | null {
  for (const item of TAB_ITEMS) {
    if (TAB_FIELDS[item.value].includes(fieldName)) {
      return item.value;
    }
  }

  return null;
}

function PanelIntro({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1 border-b pb-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="text-xs leading-5 text-muted-foreground">{children}</p>
    </div>
  );
}

export function ShopSettingsForm({ settings }: ShopSettingsFormProps) {
  const [state, formAction] = useActionState(
    updateShopSettingsAction,
    INITIAL_ACTION_STATE,
  );
  const [activeTab, setActiveTab] = useState<TabValue>("store");
  const [logoPreview, setLogoPreview] = useState(
    state.values?.logoUrl ?? settings.logoUrl ?? "",
  );

  useEffect(() => {
    if (state.status !== "error") {
      return;
    }

    const nextTab = findErrorTab(state.fieldErrors);
    if (nextTab) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveTab(nextTab);
    }
  }, [state.status, state.fieldErrors, state.submissionId]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;

    if (form.checkValidity()) {
      return;
    }

    event.preventDefault();
    const invalid = form.querySelector<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >(":invalid");

    if (!invalid) {
      return;
    }

    const nextTab = findFieldTab(invalid.name);
    if (nextTab) {
      setActiveTab(nextTab);
    }

    window.requestAnimationFrame(() => {
      invalid.focus();
      invalid.reportValidity();
    });
  }

  return (
    <form
      key={state.submissionId ?? 0}
      action={formAction}
      noValidate
      onSubmit={handleSubmit}
      className="space-y-6"
    >
      <ActionFeedback state={state} />

      <Tabs.Root
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as TabValue)}
        className="space-y-5"
      >
        <div className="relative -mx-4 border-b sm:mx-0">
          <div className="overflow-x-auto px-4 sm:px-0">
            <Tabs.List
              aria-label="หมวดการตั้งค่าร้าน"
              className="flex min-w-max gap-1"
            >
              {TAB_ITEMS.map(({ value, label, icon: Icon }) => (
                <Tabs.Tab
                  key={value}
                  type="button"
                  value={value}
                  className={cn(
                    "inline-flex h-10 items-center gap-2 border-b-2 border-transparent px-3 text-sm font-medium text-muted-foreground transition-colors",
                    "hover:bg-muted/50 hover:text-foreground",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                    "data-[active]:border-primary data-[active]:bg-primary/5 data-[active]:text-primary",
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                  {label}
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </div>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-card to-transparent sm:hidden"
          />
        </div>

        <Tabs.Panel value="store" keepMounted className="space-y-5">
          <PanelIntro title="ข้อมูลร้านและช่องทางติดต่อ">
            ชื่อร้าน โลโก้ ที่อยู่ และช่องทางที่ลูกค้าติดต่อร้านได้
          </PanelIntro>

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
                    defaultValue={
                      state.values?.logoUrl ?? settings.logoUrl ?? ""
                    }
                    onChange={(event) => setLogoPreview(event.target.value)}
                    placeholder="/brand/klyx-lab-logo.webp"
                    className={inputClassName}
                    aria-invalid={Boolean(state.fieldErrors?.logoUrl)}
                  />
                  <p className="text-xs leading-5 text-muted-foreground">
                    ระบุพาธไฟล์ในโฟลเดอร์ public เช่น
                    /brand/klyx-lab-logo.webp — เว้นว่างเพื่อใช้โลโก้เริ่มต้น
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
              <Label htmlFor="lineId">LINE ID ร้าน</Label>
              <Input
                id="lineId"
                name="lineId"
                maxLength={100}
                defaultValue={state.values?.lineId ?? settings.lineId ?? ""}
                placeholder="@klyxlab"
                className={inputClassName}
                aria-invalid={Boolean(state.fieldErrors?.lineId)}
              />
              <FieldError fieldErrors={state.fieldErrors} field="lineId" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp ร้าน</Label>
              <Input
                id="whatsapp"
                name="whatsapp"
                inputMode="tel"
                maxLength={32}
                defaultValue={state.values?.whatsapp ?? settings.whatsapp ?? ""}
                className={inputClassName}
                aria-invalid={Boolean(state.fieldErrors?.whatsapp)}
              />
              <FieldError fieldErrors={state.fieldErrors} field="whatsapp" />
            </div>
          </div>
        </Tabs.Panel>

        <Tabs.Panel value="receipt" keepMounted className="space-y-5">
          <PanelIntro title="ใบเสร็จ ภาษี และข้อความท้าย">
            ข้อมูลที่ใช้บนหัวและท้ายเอกสาร รวมถึงการคำนวณ VAT ของบิลใหม่
          </PanelIntro>

          <div className="grid gap-5 sm:grid-cols-2">
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

            <div className="space-y-4 rounded-xl border bg-muted/30 p-4 sm:col-span-2">
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
              <FieldError
                fieldErrors={state.fieldErrors}
                field="receiptFooter"
              />
            </div>
          </div>
        </Tabs.Panel>

        <Tabs.Panel value="payment" keepMounted className="space-y-5">
          <PanelIntro title="การรับชำระเงิน">
            ตั้งค่าพร้อมเพย์สำหรับสร้าง QR และข้อมูลบัญชีสำหรับแสดงตอนโอนเงิน
          </PanelIntro>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="promptpayId">พร้อมเพย์ (เบอร์/เลขบัตร)</Label>
              <Input
                id="promptpayId"
                name="promptpayId"
                maxLength={32}
                defaultValue={
                  state.values?.promptpayId ?? settings.promptpayId ?? ""
                }
                placeholder="0812345678 หรือ 13 หลัก"
                className={inputClassName}
                aria-invalid={Boolean(state.fieldErrors?.promptpayId)}
              />
              <FieldError
                fieldErrors={state.fieldErrors}
                field="promptpayId"
              />
              <p className="text-xs leading-5 text-muted-foreground">
                ใช้สร้าง QR พร้อมเพย์ในหน้าขายและหน้าบิล
                รองรับเบอร์มือถือ 10 หลัก เลขบัตรประชาชน 13 หลัก
                และ e-Wallet 15 หลัก
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bankInfo">ข้อมูลบัญชีธนาคาร</Label>
              <Textarea
                id="bankInfo"
                name="bankInfo"
                rows={4}
                maxLength={1_000}
                defaultValue={state.values?.bankInfo ?? settings.bankInfo ?? ""}
                placeholder="เช่น ธนาคารกสิกรไทย เลขที่ 123-4-56789-0 ชื่อบัญชี ร้าน..."
                aria-invalid={Boolean(state.fieldErrors?.bankInfo)}
              />
              <FieldError fieldErrors={state.fieldErrors} field="bankInfo" />
              <p className="text-xs leading-5 text-muted-foreground">
                ข้อมูลนี้แสดงในหน้าขายเมื่อเลือกชำระแบบโอนเงิน
                ไม่ได้ใช้สร้าง PromptPay QR
              </p>
            </div>
          </div>
        </Tabs.Panel>

        <Tabs.Panel value="service" keepMounted className="space-y-5">
          <PanelIntro title="งานซ่อมและใบเสนอราคา">
            กำหนดอายุใบเสนอราคา ระยะประกันเริ่มต้น
            และเงื่อนไขที่แสดงบนเอกสารงานซ่อม
          </PanelIntro>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="quoteValidityDays">อายุใบเสนอราคา (วัน)</Label>
              <Input
                id="quoteValidityDays"
                name="quoteValidityDays"
                type="number"
                min={1}
                max={365}
                defaultValue={
                  state.values?.quoteValidityDays ??
                  String(settings.quoteValidityDays)
                }
                className={inputClassName}
                aria-invalid={Boolean(
                  state.fieldErrors?.quoteValidityDays,
                )}
              />
              <FieldError
                fieldErrors={state.fieldErrors}
                field="quoteValidityDays"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="repairWarrantyDays">
                ประกันงานซ่อมเริ่มต้น (วัน)
              </Label>
              <Input
                id="repairWarrantyDays"
                name="repairWarrantyDays"
                type="number"
                min={0}
                max={3650}
                defaultValue={
                  state.values?.repairWarrantyDays ??
                  String(settings.repairWarrantyDays)
                }
                className={inputClassName}
                aria-invalid={Boolean(
                  state.fieldErrors?.repairWarrantyDays,
                )}
              />
              <FieldError
                fieldErrors={state.fieldErrors}
                field="repairWarrantyDays"
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="repairTerms">เงื่อนไขงานซ่อม</Label>
              <Textarea
                id="repairTerms"
                name="repairTerms"
                rows={4}
                maxLength={2_000}
                defaultValue={
                  state.values?.repairTerms ?? settings.repairTerms ?? ""
                }
                placeholder="เงื่อนไขที่แสดงบนใบรับซ่อม เช่น ข้อมูลในเครื่องอาจสูญหาย..."
                aria-invalid={Boolean(state.fieldErrors?.repairTerms)}
              />
              <FieldError
                fieldErrors={state.fieldErrors}
                field="repairTerms"
              />
            </div>
          </div>
        </Tabs.Panel>

        <Tabs.Panel value="messages" keepMounted className="space-y-5">
          <PanelIntro title="ข้อความแจ้งลูกค้า">
            ใช้แทนตัวแปร {"{customer}"}, {"{shop}"}, {"{bill}"},{" "}
            {"{device}"}, {"{status}"}, {"{amount}"}, {"{due}"} และ{" "}
            {"{phone}"} — เว้นว่างเพื่อใช้ข้อความเริ่มต้น
          </PanelIntro>

          <div className="grid gap-4">
            {REPAIR_STATUS_ORDER.map((status) => (
              <div key={status} className="space-y-1.5">
                <Label htmlFor={`template_${status}`}>
                  {repairStatusLabel(status)}
                </Label>
                <Textarea
                  id={`template_${status}`}
                  name={`template_${status}`}
                  rows={3}
                  maxLength={2_000}
                  defaultValue={
                    state.values?.[`template_${status}`] ??
                    settings.messageTemplates?.[status] ??
                    DEFAULT_MESSAGE_TEMPLATES[status]
                  }
                  className="min-h-20 text-sm"
                />
              </div>
            ))}
          </div>
        </Tabs.Panel>
      </Tabs.Root>

      <div className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Store className="size-3.5" aria-hidden />
          การแก้ไขทุกแท็บจะถูกบันทึกพร้อมกัน
        </p>
        <SubmitButton pendingText="กำลังบันทึก...">
          บันทึกข้อมูลร้าน
        </SubmitButton>
      </div>
    </form>
  );
}
