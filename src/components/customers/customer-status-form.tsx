"use client";

import { useActionState } from "react";
import { Archive, ArchiveRestore } from "lucide-react";

import { SubmitButton } from "@/components/forms/submit-button";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
import { setCustomerActiveAction } from "@/server/actions/customers";

export function CustomerStatusForm({
  customerId,
  active,
}: {
  customerId: string;
  active: boolean;
}) {
  const [state, formAction] = useActionState(
    setCustomerActiveAction,
    INITIAL_ACTION_STATE,
  );

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (
          active &&
          !window.confirm(
            "เก็บลูกค้านี้ถาวร? ลูกค้าจะไม่แสดงในรายการปกติ แต่ประวัติบิลและประวัติซื้อจะยังอยู่",
          )
        ) {
          event.preventDefault();
        }
      }}
      className="space-y-2"
    >
      <input type="hidden" name="customerId" value={customerId} />
      <input type="hidden" name="active" value={active ? "false" : "true"} />
      {state.status === "error" && state.message ? (
        <p className="text-xs text-destructive">{state.message}</p>
      ) : null}
      <SubmitButton
        variant={active ? "outline" : "default"}
        size="sm"
        pendingText="กำลังเปลี่ยนสถานะ..."
        className="w-full"
      >
        {active ? <Archive aria-hidden /> : <ArchiveRestore aria-hidden />}
        {active ? "เก็บลูกค้าถาวร" : "กู้คืนลูกค้า"}
      </SubmitButton>
    </form>
  );
}
