"use client";

import { useActionState } from "react";
import { Power, PowerOff } from "lucide-react";

import { ActionFeedback } from "@/components/forms/form-feedback";
import { SubmitButton } from "@/components/forms/submit-button";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
import { setCommissionRuleActiveAction } from "@/server/actions/commissions";

export function CommissionRuleStatusForm({
  ruleId,
  active,
}: {
  ruleId: string;
  active: boolean;
}) {
  const [state, formAction] = useActionState(
    setCommissionRuleActiveAction,
    INITIAL_ACTION_STATE,
  );

  return (
    <form
      action={formAction}
      className="space-y-2"
      onSubmit={(event) => {
        if (
          active &&
          !window.confirm(
            "ปิดใช้งานกติกานี้? บิลที่จะอนุมัติหลังจากนี้จะไม่ใช้กติกานี้",
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="ruleId" value={ruleId} />
      <input type="hidden" name="active" value={active ? "false" : "true"} />
      {state.status === "error" ? (
        <ActionFeedback state={state} />
      ) : null}
      <SubmitButton
        variant={active ? "outline" : "default"}
        size="sm"
        pendingText="กำลังเปลี่ยนสถานะ..."
      >
        {active ? <PowerOff aria-hidden /> : <Power aria-hidden />}
        {active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
      </SubmitButton>
    </form>
  );
}
