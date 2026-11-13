"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  ArrowRight,
  CalendarDays,
  CircleAlert,
  Clock3,
  Phone,
  Search,
  UserRound,
  Wrench,
} from "lucide-react";

import { MessageComposer } from "@/components/messaging/message-composer";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { repairStatusLabel } from "@/lib/bill-labels";
import { formatThaiDate } from "@/lib/labels";
import {
  buildRepairStatusMessage,
  type MessageTemplateMap,
} from "@/lib/messaging";
import { formatTHB } from "@/lib/money";
import { cn } from "@/lib/utils";
import { updateRepairStatusAction } from "@/server/actions/repairs";

type RepairStatus =
  | "RECEIVED"
  | "INSPECTING"
  | "WAITING_APPROVAL"
  | "WAITING_PARTS"
  | "REPAIRING"
  | "COMPLETED"
  | "DELIVERED";

export type RepairJobData = {
  id: string;
  billNumber: string;
  title: string;
  billStatus: string;
  grandTotal: string;
  createdAt: string;
  updatedAt: string;
  customer: {
    id: string;
    name: string;
    phone: string;
    lineId: string | null;
    whatsapp: string | null;
  };
  technician: { id: string; name: string };
  repair: {
    deviceBrand: string | null;
    deviceModel: string | null;
    deviceSerial: string | null;
    reportedSymptoms: string;
    diagnosis: string | null;
    resolution: string | null;
    accessories: string | null;
    estimatedCost: string | null;
    depositAmount: string;
    dueAt: string | null;
    warrantyDays: number;
    repairStatus: RepairStatus;
    receivedAt: string | null;
    completedAt: string | null;
    deliveredAt: string | null;
  };
};

const columns: Array<{
  status: RepairStatus;
  label: string;
  accent: string;
  dot: string;
}> = [
  {
    status: "RECEIVED",
    label: "รับเครื่อง",
    accent: "border-sky-200 bg-sky-50/70 dark:border-sky-900/60 dark:bg-sky-950/20",
    dot: "bg-sky-500",
  },
  {
    status: "INSPECTING",
    label: "ตรวจเช็ค",
    accent:
      "border-violet-200 bg-violet-50/70 dark:border-violet-900/60 dark:bg-violet-950/20",
    dot: "bg-violet-500",
  },
  {
    status: "WAITING_APPROVAL",
    label: "รออนุมัติราคา",
    accent:
      "border-amber-200 bg-amber-50/70 dark:border-amber-900/60 dark:bg-amber-950/20",
    dot: "bg-amber-500",
  },
  {
    status: "WAITING_PARTS",
    label: "รออะไหล่",
    accent:
      "border-orange-200 bg-orange-50/70 dark:border-orange-900/60 dark:bg-orange-950/20",
    dot: "bg-orange-500",
  },
  {
    status: "REPAIRING",
    label: "กำลังซ่อม",
    accent:
      "border-blue-200 bg-blue-50/70 dark:border-blue-900/60 dark:bg-blue-950/20",
    dot: "bg-blue-500",
  },
  {
    status: "COMPLETED",
    label: "ซ่อมเสร็จ รอรับ",
    accent:
      "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/60 dark:bg-emerald-950/20",
    dot: "bg-emerald-500",
  },
  {
    status: "DELIVERED",
    label: "ส่งมอบแล้ว",
    accent:
      "border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900/30",
    dot: "bg-slate-400",
  },
];

const statusOptions = columns.map((column) => column.status);

function deviceLabel(job: RepairJobData): string {
  return (
    [job.repair.deviceBrand, job.repair.deviceModel]
      .filter(Boolean)
      .join(" ") || "ไม่ระบุรุ่นเครื่อง"
  );
}

function RepairCard({
  job,
  messageTemplates,
  shopName,
}: {
  job: RepairJobData;
  messageTemplates: MessageTemplateMap | null;
  shopName: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const message = buildRepairStatusMessage({
    status: job.repair.repairStatus,
    templates: messageTemplates,
    variables: {
      customer: job.customer.name,
      shop: shopName,
      bill: job.billNumber,
      device: deviceLabel(job),
      status: repairStatusLabel(job.repair.repairStatus),
      amount: job.repair.estimatedCost
        ? formatTHB(job.repair.estimatedCost)
        : formatTHB(job.grandTotal),
      due: job.repair.dueAt,
      phone: job.customer.phone,
    },
  });

  function changeStatus(next: RepairStatus) {
    if (next === job.repair.repairStatus) return;
    setError(null);
    startTransition(async () => {
      const result = await updateRepairStatusAction(job.id, next);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border bg-background p-3 shadow-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            href={`/bills/${job.id}`}
            className="font-mono text-[11px] font-semibold text-primary hover:underline"
          >
            {job.billNumber}
          </Link>
          <p className="mt-1 line-clamp-2 text-sm font-medium leading-5">
            {deviceLabel(job)}
          </p>
          {job.repair.deviceSerial ? (
            <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
              S/N {job.repair.deviceSerial}
            </p>
          ) : null}
        </div>
        <Badge variant="outline" className="shrink-0 text-[10px]">
          {job.technician.name}
        </Badge>
      </div>

      <div className="mt-2 space-y-1 text-[11px] text-muted-foreground">
        <p className="flex items-center gap-1.5">
          <UserRound className="size-3 shrink-0" aria-hidden />
          <span className="truncate">{job.customer.name}</span>
        </p>
        <p className="flex items-center gap-1.5">
          <Phone className="size-3 shrink-0" aria-hidden />
          {job.customer.phone}
        </p>
        <p className="flex items-start gap-1.5">
          <Wrench className="mt-0.5 size-3 shrink-0" aria-hidden />
          <span className="line-clamp-2">{job.repair.reportedSymptoms}</span>
        </p>
        {job.repair.dueAt ? (
          <p className="flex items-center gap-1.5">
            <CalendarDays className="size-3 shrink-0" aria-hidden />
            กำหนด {formatThaiDate(job.repair.dueAt)}
          </p>
        ) : null}
        <p className="flex items-center gap-1.5">
          <Clock3 className="size-3 shrink-0" aria-hidden />
          อัปเดต {formatThaiDate(job.repair.receivedAt ?? job.updatedAt)}
        </p>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 border-t pt-2">
        <div>
          <p className="text-[10px] text-muted-foreground">ยอดบิล</p>
          <p className="text-sm font-semibold tabular-nums">
            {formatTHB(job.grandTotal)}
          </p>
        </div>
        {job.repair.estimatedCost ? (
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground">ประเมิน</p>
            <p className="text-xs font-medium tabular-nums">
              {formatTHB(job.repair.estimatedCost)}
            </p>
          </div>
        ) : null}
        {job.repair.depositAmount !== "0.00" ? (
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground">มัดจำ</p>
            <p className="text-xs font-medium tabular-nums">
              {formatTHB(job.repair.depositAmount)}
            </p>
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="mt-2 rounded-md bg-rose-50 px-2 py-1.5 text-[11px] leading-4 text-rose-800 dark:bg-rose-950/30 dark:text-rose-200">
          {error}
        </p>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <select
          value={job.repair.repairStatus}
          onChange={(event) => changeStatus(event.target.value as RepairStatus)}
          disabled={isPending}
          className="h-8 min-w-0 flex-1 rounded-lg border bg-background px-2 text-[11px]"
          aria-label={`เปลี่ยนสถานะ ${job.billNumber}`}
        >
          {statusOptions.map((status) => (
            <option key={status} value={status}>
              {repairStatusLabel(status)}
            </option>
          ))}
        </select>
        <MessageComposer
          customerName={job.customer.name}
          phone={job.customer.phone}
          lineId={job.customer.lineId}
          whatsapp={job.customer.whatsapp}
          defaultMessage={message}
          triggerLabel="แจ้ง"
        />
      </div>
      <div className="mt-1.5 flex items-center justify-between">
        <Link
          href={`/bills/${job.id}`}
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "h-7 px-2 text-[11px] text-primary",
          )}
        >
          เปิดบิล
          <ArrowRight aria-hidden />
        </Link>
        <span className="text-[10px] text-muted-foreground">
          {job.repair.warrantyDays > 0
            ? `ประกัน ${job.repair.warrantyDays} วัน`
            : "ไม่รับประกัน"}
        </span>
      </div>
    </div>
  );
}

export function RepairBoard({
  jobs,
  messageTemplates,
  shopName,
}: {
  jobs: RepairJobData[];
  messageTemplates: MessageTemplateMap | null;
  shopName: string;
}) {
  const [query, setQuery] = useState("");
  const [technician, setTechnician] = useState("ALL");

  const technicians = useMemo(() => {
    const map = new Map<string, string>();
    for (const job of jobs) map.set(job.technician.id, job.technician.name);
    return [...map.entries()];
  }, [jobs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return jobs.filter((job) => {
      if (technician !== "ALL" && job.technician.id !== technician) {
        return false;
      }
      if (!q) return true;
      return (
        job.billNumber.toLowerCase().includes(q) ||
        job.customer.name.toLowerCase().includes(q) ||
        job.customer.phone.includes(q) ||
        deviceLabel(job).toLowerCase().includes(q) ||
        (job.repair.deviceSerial ?? "").toLowerCase().includes(q) ||
        job.repair.reportedSymptoms.toLowerCase().includes(q)
      );
    });
  }, [jobs, query, technician]);

  const openCount = filtered.filter(
    (job) => job.repair.repairStatus !== "DELIVERED",
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ค้นหาเลขบิล ลูกค้า เครื่อง หรือ Serial"
              className="pl-9"
            />
          </div>
          {technicians.length > 1 ? (
            <select
              value={technician}
              onChange={(event) => setTechnician(event.target.value)}
              className="h-9 rounded-lg border bg-background px-3 text-sm"
              aria-label="กรองตามช่าง"
            >
              <option value="ALL">ช่างทั้งหมด</option>
              {technicians.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          ) : null}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Badge variant="secondary">{openCount} งานเปิดอยู่</Badge>
          <Link
            href="/bills/new?billTypeCode=REPAIR"
            className={cn(buttonVariants(), "h-9")}
          >
            <Wrench aria-hidden />
            รับเครื่องใหม่
          </Link>
        </div>
      </div>

      {jobs.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            <Wrench className="mx-auto mb-3 size-8 opacity-40" aria-hidden />
            ยังไม่มีงานซ่อมในระบบ
            <p className="mt-1 text-xs">
              เริ่มรับเครื่องใหม่เพื่อให้งานแสดงบนกระดาน
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {columns.map((column) => {
            const items = filtered.filter(
              (job) => job.repair.repairStatus === column.status,
            );
            return (
              <section
                key={column.status}
                className={cn(
                  "flex w-[286px] shrink-0 flex-col rounded-2xl border p-2.5",
                  column.accent,
                )}
              >
                <header className="flex items-center justify-between gap-2 px-1 py-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn("size-2 rounded-full", column.dot)}
                      aria-hidden
                    />
                    <h3 className="text-xs font-semibold">{column.label}</h3>
                  </div>
                  <span className="rounded-full bg-background/80 px-1.5 py-0.5 text-[10px] font-medium tabular-nums">
                    {items.length}
                  </span>
                </header>
                <div className="mt-1 space-y-2">
                  {items.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-current/10 bg-background/40 px-3 py-8 text-center text-[11px] text-muted-foreground">
                      ไม่มีงาน
                    </div>
                  ) : (
                    items.map((job) => (
                      <RepairCard
                        key={job.id}
                        job={job}
                        messageTemplates={messageTemplates}
                        shopName={shopName}
                      />
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {filtered.length === 0 && jobs.length > 0 ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed py-8 text-sm text-muted-foreground">
          <CircleAlert className="size-4" aria-hidden />
          ไม่พบงานที่ตรงกับตัวกรอง
        </div>
      ) : null}
    </div>
  );
}
