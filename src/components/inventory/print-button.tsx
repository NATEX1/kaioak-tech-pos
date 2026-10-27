"use client";

import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

export function PrintButton() {
  return (
    <Button type="button" onClick={() => window.print()} className="h-9">
      <Printer aria-hidden />
      พิมพ์ป้าย
    </Button>
  );
}
