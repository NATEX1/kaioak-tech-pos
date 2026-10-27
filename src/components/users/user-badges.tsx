import type { Role } from "@/generated/prisma/enums";
import { Badge } from "@/components/ui/badge";
import { roleLabel } from "@/lib/labels";

export function RoleBadge({ role }: { role: Role }) {
  return (
    <Badge variant={role === "ADMIN" ? "default" : "secondary"}>
      {roleLabel(role)}
    </Badge>
  );
}

export function UserStatusBadge({ active }: { active: boolean }) {
  return (
    <Badge
      variant="outline"
      className={
        active
          ? "border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300"
          : "border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300"
      }
    >
      <span
        className={
          active
            ? "size-1.5 rounded-full bg-emerald-500"
            : "size-1.5 rounded-full bg-slate-400"
        }
      />
      {active ? "เปิดใช้งาน" : "ปิดใช้งาน"}
    </Badge>
  );
}
