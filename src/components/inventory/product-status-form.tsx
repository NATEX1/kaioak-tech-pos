"use client";

import { useActionState } from "react";
import { Archive, ArchiveRestore } from "lucide-react";

import { SubmitButton } from "@/components/forms/submit-button";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
import { setProductActiveAction } from "@/server/actions/products";

export function ProductStatusForm({
  productId,
  active,
  stockQty,
}: {
  productId: string;
  active: boolean;
  stockQty: number;
}) {
  const [state, formAction] = useActionState(
    setProductActiveAction,
    INITIAL_ACTION_STATE,
  );
  const blocked = active && stockQty > 0;

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (
          active &&
          !window.confirm(
            "เก็บสินค้านี้ถาวร? สินค้าจะไม่แสดงในรายการปกติ แต่ประวัติจะยังอยู่",
          )
        ) {
          event.preventDefault();
        }
      }}
      className="space-y-2"
    >
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="active" value={active ? "false" : "true"} />
      {state.status === "error" && state.message ? (
        <p className="text-xs text-destructive">{state.message}</p>
      ) : null}
      <SubmitButton
        variant={active ? "outline" : "default"}
        disabled={blocked}
        pendingText="กำลังเปลี่ยนสถานะ..."
      >
        {active ? <Archive aria-hidden /> : <ArchiveRestore aria-hidden />}
        {active ? "เก็บถาวร" : "กู้คืนสินค้า"}
      </SubmitButton>
      {blocked ? (
        <p className="text-[11px] text-muted-foreground">
          ต้องปรับยอดคงเหลือให้เป็น 0 ก่อนเก็บถาวร
        </p>
      ) : null}
    </form>
  );
}
