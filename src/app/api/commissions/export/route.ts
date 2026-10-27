import { NextResponse } from "next/server";

import type {
  CommissionEntryKind,
  CommissionEntryStatus,
} from "@/generated/prisma/enums";
import {
  commissionDateInputValue,
  parseBangkokCommissionDate,
} from "@/lib/commission-labels";
import { getCurrentUser } from "@/server/auth/session";
import {
  buildCommissionCsv,
  type CommissionEntryFilters,
} from "@/server/services/commissions";

const ENTRY_STATUSES: CommissionEntryStatus[] = [
  "PENDING",
  "PAID",
  "REVERSED",
];
const ENTRY_KINDS: CommissionEntryKind[] = ["EARNING", "REVERSAL"];

function entryStatus(value: string | null) {
  return ENTRY_STATUSES.includes(value as CommissionEntryStatus)
    ? (value as CommissionEntryStatus)
    : undefined;
}

function entryKind(value: string | null) {
  return ENTRY_KINDS.includes(value as CommissionEntryKind)
    ? (value as CommissionEntryKind)
    : undefined;
}

export async function GET(request: Request) {
  const actor = await getCurrentUser();

  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (actor.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const search = new URL(request.url).searchParams;
  const fromValue = search.get("from")?.trim();
  const toValue = search.get("to")?.trim();
  const filters: CommissionEntryFilters = {
    technicianId: search.get("technicianId")?.trim().slice(0, 64) || undefined,
    status: entryStatus(search.get("status")),
    kind: entryKind(search.get("kind")),
    billId: search.get("billId")?.trim().slice(0, 64) || undefined,
    from: fromValue
      ? (parseBangkokCommissionDate(fromValue) ?? undefined)
      : undefined,
    to: toValue
      ? (parseBangkokCommissionDate(toValue, true) ?? undefined)
      : undefined,
  };
  const { csv } = await buildCommissionCsv(
    { id: actor.id, role: actor.role },
    filters,
  );
  const fileDate = commissionDateInputValue().replaceAll("-", "");

  return new NextResponse(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="compos-commissions-${fileDate}.csv"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex",
    },
  });
}
