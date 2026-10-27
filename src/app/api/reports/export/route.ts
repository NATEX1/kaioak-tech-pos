import { NextResponse } from "next/server";

import { getCurrentUser } from "@/server/auth/session";
import {
  buildMonthlySalesReportCsv,
  getMonthlySalesReport,
} from "@/server/services/reports";

export async function GET() {
  const actor = await getCurrentUser();

  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (actor.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date();
  const rows = await getMonthlySalesReport(now);
  const csv = buildMonthlySalesReportCsv(rows);

  const dateStr = now.toISOString().slice(0, 10);
  const filename = `sales-report-${dateStr}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
