import { Badge } from "@/components/ui/badge";
import {
  billStatusBadgeClass,
  billStatusLabel,
} from "@/lib/bill-labels";
import type { BillStatus } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";

export function BillStatusBadge({ status }: { status: BillStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn(billStatusBadgeClass(status))}
    >
      {billStatusLabel(status)}
    </Badge>
  );
}
