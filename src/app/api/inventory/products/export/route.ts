import { NextResponse } from "next/server";

import { inventoryDateInputValue } from "@/lib/inventory-labels";
import { getCurrentUser } from "@/server/auth/session";
import { buildProductCsv } from "@/server/services/product-import";

export async function GET() {
  const actor = await getCurrentUser();

  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (actor.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { csv } = await buildProductCsv({
    id: actor.id,
    role: actor.role,
  });
  const fileDate = inventoryDateInputValue().replaceAll("-", "");

  return new NextResponse(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="compos-products-${fileDate}.csv"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex",
    },
  });
}
