import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PackageSearch } from "lucide-react";

import { InventoryNav } from "@/components/inventory/inventory-nav";
import { requireUser } from "@/server/auth/session";

export const instant = false;

export const metadata: Metadata = {
  title: "สินค้าและสต๊อก",
};

export default async function InventoryLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 print:hidden">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <PackageSearch className="size-5" aria-hidden />
        </div>
        <div>
          <p className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground">
            INVENTORY
          </p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            สินค้าและสต๊อก
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            ค้นหาด้วยบาร์โค้ด รับสินค้าเข้า และตรวจสอบยอดคงเหลือจากหลักฐานทุกครั้ง
          </p>
        </div>
      </div>

      <div className="print:hidden">
        <InventoryNav isAdmin={isAdmin} />
      </div>

      <div>{children}</div>
    </div>
  );
}
