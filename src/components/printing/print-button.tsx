"use client";

import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

export function PrintButton({
  label = "พิมพ์เอกสาร",
}: {
  label?: string;
}) {
  async function handlePrint() {
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }

    window.print();
  }

  return (
    <Button type="button" onClick={handlePrint} className="h-9">
      <Printer aria-hidden />
      {label}
    </Button>
  );
}
