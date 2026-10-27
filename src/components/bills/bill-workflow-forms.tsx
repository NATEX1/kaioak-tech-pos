"use client";

import { useActionState } from "react";
import {
  Ban,
  CheckCircle2,
  CircleAlert,
  CreditCard,
  Send,
  XCircle,
} from "lucide-react";

import {
  ActionFeedback,
  FieldError,
} from "@/components/forms/form-feedback";
import { SubmitButton } from "@/components/forms/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
import { selectClassName } from "@/lib/form-styles";
import {
  approveBillAction,
  payBillAction,
  rejectBillAction,
  submitBillAction,
  voidBillAction,
} from "@/server/actions/bills";

type WorkflowKind = "submit" | "approve" | "reject" | "pay" | "void";

const actions = {
  submit: submitBillAction,
  approve: approveBillAction,
  reject: rejectBillAction,
  pay: payBillAction,
  void: voidBillAction,
};

const config: Record<
  WorkflowKind,
  {
    label: string;
    pendingLabel: string;
    icon: typeof Send;
    variant: "default" | "destructive" | "outline" | "secondary";
  }
> = {
  submit: {
    label: "ส่งขออนุมัติ",
    pendingLabel: "กำลังส่ง...",
    icon: Send,
    variant: "default",
  },
  approve: {
    label: "อนุมัติและตัดสต๊อก",
    pendingLabel: "กำลังอนุมัติ...",
    icon: CheckCircle2,
    variant: "default",
  },
  reject: {
    label: "ตีกลับให้แก้ไข",
    pendingLabel: "กำลังตีกลับ...",
    icon: XCircle,
    variant: "destructive",
  },
  pay: {
    label: "บันทึกชำระเงิน",
    pendingLabel: "กำลังบันทึก...",
    icon: CreditCard,
    variant: "default",
  },
  void: {
    label: "ยืนยันยกเลิกบิล",
    pendingLabel: "กำลังยกเลิก...",
    icon: Ban,
    variant: "destructive",
  },
};

export function BillWorkflowForm({
  kind,
  billId,
  tone = "default",
}: {
  kind: WorkflowKind;
  billId: string;
  tone?: "default" | "destructive";
}) {
  const action = actions[kind];
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);
  const item = config[kind];
  const Icon = item.icon;

  return (
    <form
      action={formAction}
      className="space-y-2"
      onSubmit={(event) => {
        if (
          kind === "void" &&
          !window.confirm(
            "ยืนยันยกเลิกบิลนี้? ระบบจะคืนสต๊อก Serial และกลับรายการค่าคอมมิชชั่นที่เกี่ยวข้อง",
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="billId" value={billId} />
      {kind === "approve" ? (
        <div className="space-y-1.5">
          <label
            htmlFor={`override-${billId}`}
            className="text-xs font-medium text-muted-foreground"
          >
            เหตุผลกรณีไม่พบประวัติหรือหมดประกัน (ถ้าจำเป็น)
          </label>
          <Textarea
            id={`override-${billId}`}
            name="overrideReason"
            maxLength={2000}
            className="min-h-16 text-sm"
            placeholder="ระบุเหตุผลอย่างน้อย 3 ตัวอักษร เพื่ออนุมัติเป็นกรณีพิเศษ"
          />
          <FieldError
            fieldErrors={state.fieldErrors}
            field="overrideReason"
          />
        </div>
      ) : null}

      {kind === "reject" || kind === "void" ? (
        <div className="space-y-1.5">
          <label
            htmlFor={`reason-${kind}-${billId}`}
            className="text-xs font-medium text-muted-foreground"
          >
            เหตุผล *
          </label>
          <Textarea
            id={`reason-${kind}-${billId}`}
            name="reason"
            required
            minLength={3}
            maxLength={1000}
            className="min-h-16 text-sm"
            placeholder={
              kind === "reject"
                ? "เช่น ราคาไม่ถูกต้อง ให้แก้ไขก่อน"
                : "เช่น ลูกค้ายกเลิก เปิดบิลซ้ำ"
            }
          />
          <FieldError fieldErrors={state.fieldErrors} field="reason" />
        </div>
      ) : null}

      {kind === "pay" ? (
        <div className="space-y-1.5">
          <label
            htmlFor={`payment-${billId}`}
            className="text-xs font-medium text-muted-foreground"
          >
            วิธีชำระเงิน *
          </label>
          <select
            id={`payment-${billId}`}
            name="paymentMethod"
            required
            defaultValue="CASH"
            className={selectClassName}
          >
            <option value="CASH">เงินสด</option>
            <option value="TRANSFER">โอนเงิน</option>
            <option value="CARD">บัตร</option>
          </select>
        </div>
      ) : null}

      <ActionFeedback state={state} />
      <SubmitButton
        variant={item.variant}
        className="h-9 w-full"
        pendingText={item.pendingLabel}
      >
        <Icon aria-hidden />
        {item.label}
      </SubmitButton>
      {tone === "destructive" && kind !== "void" ? (
        <p className="flex gap-1.5 text-[11px] leading-4 text-muted-foreground">
          <CircleAlert className="mt-0.5 size-3 shrink-0" aria-hidden />
          การตีกลับจะไม่ตัดสต๊อก และช่างสามารถแก้ไขแล้วส่งใหม่ได้
        </p>
      ) : null}
    </form>
  );
}
