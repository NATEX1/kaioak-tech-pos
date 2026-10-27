"use client";

import { useActionState } from "react";
import { Power, PowerOff } from "lucide-react";

import { ActionFeedback } from "@/components/forms/form-feedback";
import { SubmitButton } from "@/components/forms/submit-button";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
import { updateUserStatusAction } from "@/server/actions/users";

export function UserStatusForm({
  userId,
  active,
}: {
  userId: string;
  active: boolean;
}) {
  const [state, formAction] = useActionState(
    updateUserStatusAction,
    INITIAL_ACTION_STATE,
  );
  const nextActive = !active;

  return (
    <form
      action={formAction}
      className="space-y-3"
      onSubmit={(event) => {
        if (
          !nextActive &&
          !window.confirm(
            "ยืนยันปิดใช้งานบัญชีนี้? session ทั้งหมดของผู้ใช้จะถูกยกเลิกทันที",
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="active" value={String(nextActive)} />

      <ActionFeedback state={state} />

      <SubmitButton
        variant={nextActive ? "outline" : "destructive"}
        pendingText={nextActive ? "กำลังเปิดใช้งาน..." : "กำลังปิดใช้งาน..."}
      >
        {nextActive ? <Power aria-hidden /> : <PowerOff aria-hidden />}
        {nextActive ? "เปิดใช้งานบัญชีอีกครั้ง" : "ปิดใช้งานบัญชี"}
      </SubmitButton>
    </form>
  );
}
