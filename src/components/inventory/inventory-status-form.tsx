"use client";

import { useActionState } from "react";
import { Archive, ArchiveRestore } from "lucide-react";

import { SubmitButton } from "@/components/forms/submit-button";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
import {
  setCategoryActiveAction,
  setSupplierActiveAction,
} from "@/server/actions/inventory-settings";

export function InventoryStatusForm({
  kind,
  id,
  active,
}: {
  kind: "category" | "supplier";
  id: string;
  active: boolean;
}) {
  const action =
    kind === "category" ? setCategoryActiveAction : setSupplierActiveAction;
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);
  const idField = kind === "category" ? "categoryId" : "supplierId";

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (
          active &&
          !window.confirm(
            "เก็บรายการนี้ถาวร? ข้อมูลประวัติจะยังอยู่และกู้คืนได้ภายหลัง",
          )
        ) {
          event.preventDefault();
        }
      }}
      className="space-y-2"
    >
      <input type="hidden" name={idField} value={id} />
      <input type="hidden" name="active" value={active ? "false" : "true"} />
      {state.status === "error" && state.message ? (
        <p className="max-w-64 text-xs text-destructive">{state.message}</p>
      ) : null}
      <SubmitButton
        variant={active ? "outline" : "default"}
        size="sm"
        pendingText="กำลังเปลี่ยนสถานะ..."
      >
        {active ? <Archive aria-hidden /> : <ArchiveRestore aria-hidden />}
        {active ? "เก็บถาวร" : "กู้คืน"}
      </SubmitButton>
    </form>
  );
}
