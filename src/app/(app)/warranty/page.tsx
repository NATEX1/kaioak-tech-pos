import type { Metadata } from "next";

import { WarrantyLookupView } from "@/components/warranty/warranty-lookup-view";
import { requireUser } from "@/server/auth/session";
import { lookupWarrantyBySerial } from "@/server/services/warranty";

export const instant = false;

export const metadata: Metadata = {
  title: "ตรวจสอบประกันและประวัติการซื้อ",
  description: "ตรวจสอบระยะเวลารับประกัน ค้นหาย้อนกลับจาก Serial Number หรือบาร์โค้ด",
};

export default async function WarrantyPage({
  searchParams,
}: {
  searchParams: Promise<{ serial?: string }>;
}) {
  const user = await requireUser();
  const { serial } = await searchParams;

  let initialResult = null;
  if (serial?.trim()) {
    initialResult = await lookupWarrantyBySerial(
      { id: user.id, role: user.role },
      serial.trim(),
    );
  }

  return (
    <WarrantyLookupView
      // Remount when the URL points at another serial so the input and result
      // follow the link instead of keeping the previously viewed unit.
      key={serial?.trim() ?? ""}
      initialSerial={serial?.trim() ?? ""}
      initialResult={initialResult}
      isAdmin={user.role === "ADMIN"}
    />
  );
}
