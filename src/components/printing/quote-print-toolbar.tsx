"use client";

import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

export function QuotePrintToolbar({
  quoteId,
  quoteNumber,
}: {
  quoteId: string;
  quoteNumber: string;
}) {
  return (
    <div className="mx-auto flex max-w-[210mm] flex-wrap items-center justify-between gap-2 print:hidden">
      <Link
        href={`/quotes/${quoteId}`}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border bg-background px-3 text-sm font-medium hover:bg-muted"
      >
        <ArrowLeft className="size-4" aria-hidden />
        กลับ
      </Link>
      <div className="flex items-center gap-2">
        <span className="font-mono text-sm text-muted-foreground">
          {quoteNumber}
        </span>
        <Button type="button" onClick={() => window.print()}>
          <Printer aria-hidden />
          พิมพ์ / บันทึก PDF
        </Button>
      </div>
    </div>
  );
}
