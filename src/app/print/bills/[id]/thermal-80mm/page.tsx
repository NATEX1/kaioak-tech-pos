import type { Metadata } from "next";

import { BillPrintPage } from "@/components/printing/bill-print-page";

export const instant = false;

export const metadata: Metadata = {
  title: "พิมพ์สลิป 80 มม.",
};

export default async function BillPrintThermalRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <BillPrintPage billId={id} format="thermal-80mm" />;
}
