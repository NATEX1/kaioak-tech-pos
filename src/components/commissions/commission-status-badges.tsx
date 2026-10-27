import type {
  CommissionEntryKind,
  CommissionEntryStatus,
  CommissionPayoutStatus,
} from "@/generated/prisma/enums";

import { Badge } from "@/components/ui/badge";
import {
  commissionEntryKindLabel,
  commissionEntryStatusClass,
  commissionEntryStatusLabel,
  commissionPayoutStatusLabel,
} from "@/lib/commission-labels";

export function CommissionEntryStatusBadge({
  status,
}: {
  status: CommissionEntryStatus;
}) {
  return (
    <Badge variant="outline" className={commissionEntryStatusClass(status)}>
      {commissionEntryStatusLabel(status)}
    </Badge>
  );
}

export function CommissionEntryKindBadge({
  kind,
}: {
  kind: CommissionEntryKind;
}) {
  return (
    <Badge variant={kind === "REVERSAL" ? "destructive" : "secondary"}>
      {commissionEntryKindLabel(kind)}
    </Badge>
  );
}

export function CommissionPayoutStatusBadge({
  status,
}: {
  status: CommissionPayoutStatus;
}) {
  return (
    <Badge
      variant="outline"
      className={
        status === "PAID"
          ? "border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300"
          : "border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200"
      }
    >
      {commissionPayoutStatusLabel(status)}
    </Badge>
  );
}
