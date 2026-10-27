import { CircleAlert, CircleCheck } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { ActionState } from "@/lib/action-state";

export function FieldError({
  fieldErrors,
  field,
}: {
  fieldErrors?: Record<string, string[] | undefined>;
  field: string;
}) {
  const message = fieldErrors?.[field]?.[0];

  if (!message) {
    return null;
  }

  return <p className="text-xs text-destructive">{message}</p>;
}

export function ActionFeedback({ state }: { state: ActionState }) {
  if (state.status === "error" && state.message) {
    return (
      <Alert variant="destructive">
        <CircleAlert aria-hidden />
        <AlertTitle>ไม่สำเร็จ</AlertTitle>
        <AlertDescription>{state.message}</AlertDescription>
      </Alert>
    );
  }

  if (state.status === "success" && state.message) {
    return (
      <Alert>
        <CircleCheck aria-hidden className="text-emerald-600 dark:text-emerald-300" />
        <AlertTitle>สำเร็จ</AlertTitle>
        <AlertDescription>{state.message}</AlertDescription>
      </Alert>
    );
  }

  return null;
}

export function SuccessAlert({
  title = "สำเร็จ",
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <Alert>
      <CircleCheck aria-hidden className="text-emerald-600 dark:text-emerald-300" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}

export function ErrorAlert({
  title = "ไม่สำเร็จ",
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <Alert variant="destructive">
      <CircleAlert aria-hidden />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}
