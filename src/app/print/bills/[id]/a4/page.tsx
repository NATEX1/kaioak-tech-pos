import type { Metadata } from "next";

import { BillPrintPage } from "@/components/printing/bill-print-page";

export const instant = false;

export const metadata: Metadata = {
  title: "พิมพ์เอกสาร A4",
};

export default async function BillPrintA4Route({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <BillPrintPage billId={id} format="a4" />;
}
