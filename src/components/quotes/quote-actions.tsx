"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  CheckCircle2,
  FileCheck2,
  Loader2,
  Printer,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  convertQuoteToBillAction,
  setQuoteStatusAction,
} from "@/server/actions/pos";

export function QuoteActions({
  quoteId,
  status,
  convertedBillId,
}: {
  quoteId: string;
  status: string;
  convertedBillId: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function convert() {
    setError(null);
    startTransition(async () => {
      const result = await convertQuoteToBillAction(quoteId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const billId = String(result.data.billId ?? "");
      if (billId) {
        router.push(`/bills/${billId}`);
      } else {
        router.refresh();
      }
    });
  }

  function changeStatus(next: "ACCEPTED" | "CANCELLED" | "EXPIRED") {
    setError(null);
    startTransition(async () => {
      const result = await setQuoteStatusAction(quoteId, next);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  if (convertedBillId) {
    return (
      <div className="flex flex-wrap gap-2">
        <a
          href={`/print/quotes/${quoteId}/a4`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border bg-background px-3 text-sm font-medium hover:bg-muted"
        >
          <Printer className="size-4" aria-hidden />
          พิมพ์
        </a>
        <a
          href={`/bills/${convertedBillId}`}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <FileCheck2 className="size-4" aria-hidden />
          เปิดบิลที่แปลงแล้ว
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <a
          href={`/print/quotes/${quoteId}/a4`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border bg-background px-3 text-sm font-medium hover:bg-muted"
        >
          <Printer className="size-4" aria-hidden />
          พิมพ์
        </a>

        {status === "SENT" ? (
          <Button
            type="button"
            variant="outline"
            className="h-9"
            onClick={() => changeStatus("ACCEPTED")}
            disabled={isPending}
          >
            <CheckCircle2 aria-hidden />
            ลูกค้าตอบรับ
          </Button>
        ) : null}

        <Button
          type="button"
          className="h-9"
          onClick={convert}
          disabled={isPending || status === "CANCELLED" || status === "EXPIRED"}
        >
          {isPending ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : (
            <FileCheck2 aria-hidden />
          )}
          เปิดบิลจากใบเสนอราคา
        </Button>

        {status !== "CANCELLED" ? (
          <Button
            type="button"
            variant="outline"
            className="h-9 text-muted-foreground"
            onClick={() => changeStatus("CANCELLED")}
            disabled={isPending}
          >
            <XCircle aria-hidden />
            ยกเลิก
          </Button>
        ) : null}
      </div>
      {error ? (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:bg-rose-950/30 dark:text-rose-200">
          {error}
        </p>
      ) : null}
    </div>
  );
}
