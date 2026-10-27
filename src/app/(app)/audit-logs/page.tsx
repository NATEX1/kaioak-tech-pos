import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CircleAlert,
  ClipboardList,
  Filter,
  Search,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pagination } from "@/components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  parseAuditDateInput,
  isInvalidAuditDateRange,
} from "@/lib/audit-dates";
import { auditActionLabel, auditActionTone } from "@/lib/audit-labels";
import { formatThaiDateTime } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { requireUser } from "@/server/auth/session";
import {
  listAuditLogs,
  listAuditEntityTypes,
  listAuditActors,
  AUDIT_LOG_PAGE_SIZE,
} from "@/server/services/audit-logs";

export const instant = false;

export const metadata: Metadata = {
  title: "Audit Log",
};

function auditDetailJson(log: {
  metadata: unknown;
  before: unknown;
  after: unknown;
}): string | null {
  if (!log.metadata && !log.before && !log.after) {
    return null;
  }

  try {
    return JSON.stringify(
      {
        metadata: log.metadata,
        before: log.before,
        after: log.after,
      },
      null,
      2,
    );
  } catch {
    return "ไม่สามารถแสดงรายละเอียดได้";
  }
}

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{
    actorId?: string;
    entityType?: string;
    action?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}) {
  const user = await requireUser();

  if (user.role !== "ADMIN") {
    notFound();
  }

  const query = await searchParams;
  const page = Math.max(1, parseInt(query.page ?? "1", 10) || 1);
  const actorId = query.actorId?.trim() || undefined;
  const entityType = query.entityType?.trim() || undefined;
  const action = query.action?.trim() || undefined;
  const from = parseAuditDateInput(query.from, "start") ?? undefined;
  const to = parseAuditDateInput(query.to, "end") ?? undefined;
  const invalidDateRange = isInvalidAuditDateRange(query.from, query.to);

  const [result, entityTypes, actors] = await Promise.all([
    invalidDateRange
      ? Promise.resolve({
          items: [],
          totalCount: 0,
          page: 1,
          pageSize: AUDIT_LOG_PAGE_SIZE,
        })
      : listAuditLogs({
          actorId,
          entityType,
          action,
          from,
          to,
          page,
          pageSize: AUDIT_LOG_PAGE_SIZE,
        }),
    listAuditEntityTypes(),
    listAuditActors(),
  ]);

  const hasFilters = Boolean(
    actorId || entityType || action || query.from || query.to,
  );
  const preserveParams: Record<string, string | undefined> = {
    ...(actorId ? { actorId } : {}),
    ...(entityType ? { entityType } : {}),
    ...(action ? { action } : {}),
    ...(query.from ? { from: query.from } : {}),
    ...(query.to ? { to: query.to } : {}),
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              Audit Log
            </h1>
            <Badge variant="outline">
              {result.totalCount.toLocaleString("th-TH")} รายการ
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            ประวัติการกระทำทั้งหมดในระบบ — Admin เท่านั้น
          </p>
        </div>
        <Link
          href="/"
          className={cn(buttonVariants({ variant: "outline" }), "h-9 shrink-0")}
        >
          <ArrowLeft className="size-4" aria-hidden />
          กลับภาพรวม
        </Link>
      </div>

      {invalidDateRange ? (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 px-4 py-3 text-sm text-rose-800 dark:text-rose-200">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div>
            <p className="font-medium">ช่วงวันที่ไม่ถูกต้อง</p>
            <p className="mt-0.5 text-xs">
              กรุณาระบุวันที่ในรูปแบบ YYYY-MM-DD และวันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด
            </p>
          </div>
        </div>
      ) : null}

      {/* Filter form */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Filter className="size-4 text-muted-foreground" aria-hidden />
            <CardTitle className="text-base">กรองรายการ</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <form method="GET" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <div className="space-y-1.5">
              <Label htmlFor="audit-actor">ผู้กระทำ</Label>
              <select
                id="audit-actor"
                name="actorId"
                defaultValue={actorId ?? ""}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">ทั้งหมด</option>
                {actors.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.email})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="audit-entity-type">ประเภทข้อมูล</Label>
              <select
                id="audit-entity-type"
                name="entityType"
                defaultValue={entityType ?? ""}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">ทั้งหมด</option>
                {entityTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="audit-action">ค้นหา Action</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" aria-hidden />
                <Input
                  id="audit-action"
                  name="action"
                  defaultValue={action ?? ""}
                  placeholder="เช่น BILL_APPROVED"
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="audit-from">ตั้งแต่วันที่</Label>
              <Input
                id="audit-from"
                name="from"
                type="date"
                defaultValue={query.from ?? ""}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="audit-to">ถึงวันที่</Label>
              <Input
                id="audit-to"
                name="to"
                type="date"
                defaultValue={query.to ?? ""}
              />
            </div>

            <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-1">
              <button
                type="submit"
                className={cn(buttonVariants(), "h-9")}
              >
                <Filter className="size-4" aria-hidden />
                กรอง
              </button>
              {hasFilters && (
                <Link
                  href="/audit-logs"
                  className={cn(buttonVariants({ variant: "outline" }), "h-9")}
                >
                  ล้างตัวกรอง
                </Link>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            <div className="flex items-center gap-2">
              <ClipboardList className="size-4" aria-hidden />
              รายการ Audit Log
            </div>
          </CardTitle>
          <CardDescription>
            {hasFilters
              ? `พบ ${result.totalCount.toLocaleString("th-TH")} รายการตามเงื่อนไข`
              : `ทั้งหมด ${result.totalCount.toLocaleString("th-TH")} รายการ`}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {result.items.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              <ClipboardList className="mx-auto mb-2 size-6 text-muted-foreground/60" aria-hidden />
              ยังไม่มี log ที่ตรงกับเงื่อนไข
            </div>
          ) : (
            <>
              <ul className="divide-y lg:hidden">
                {result.items.map((log) => {
                  const detail = auditDetailJson(log);

                  return (
                    <li key={log.id} className="px-4 py-5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <Badge
                            variant="outline"
                            className={cn(
                              "font-mono text-[10px]",
                              auditActionTone(log.action),
                            )}
                          >
                            {log.action}
                          </Badge>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {auditActionLabel(log.action)}
                          </p>
                        </div>
                        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                          {formatThaiDateTime(log.createdAt)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-medium">
                        {log.actorName ?? "ระบบ"}
                        {log.actorEmail ? (
                          <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
                            {log.actorEmail}
                          </span>
                        ) : null}
                      </p>
                      <div className="mt-1.5">
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {log.entityType}
                        </Badge>
                      </div>
                      {detail ? (
                        <details className="mt-3">
                          <summary className="cursor-pointer text-xs font-medium text-primary">
                            ดูรายละเอียด
                          </summary>
                          <pre className="mt-2 max-h-72 overflow-auto rounded-md border bg-muted/40 p-2 text-[10px] leading-relaxed whitespace-pre-wrap break-all">
                            {detail}
                          </pre>
                        </details>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              <div className="hidden overflow-x-auto lg:block">
                <Table className="min-w-250">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="px-4">วันเวลา</TableHead>
                      <TableHead className="px-4">ผู้กระทำ</TableHead>
                      <TableHead className="px-4">Action</TableHead>
                      <TableHead className="px-4">ประเภท</TableHead>
                      <TableHead className="px-4">Entity ID</TableHead>
                      <TableHead className="px-4">IP Address</TableHead>
                      <TableHead className="px-4">รายละเอียด</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.items.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="px-4 align-top text-xs tabular-nums">
                          {formatThaiDateTime(log.createdAt)}
                        </TableCell>
                        <TableCell className="px-4 align-top">
                          {log.actorName ? (
                            <>
                              <p className="text-sm font-medium">{log.actorName}</p>
                              <p className="text-[11px] text-muted-foreground">
                                {log.actorEmail}
                              </p>
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground">ระบบ</span>
                          )}
                        </TableCell>
                        <TableCell className="px-4 align-top">
                          <Badge
                            variant="outline"
                            className={cn("font-mono text-[10px]", auditActionTone(log.action))}
                          >
                            {log.action}
                          </Badge>
                          <p className="mt-1 text-[10px] text-muted-foreground">
                            {auditActionLabel(log.action)}
                          </p>
                        </TableCell>
                        <TableCell className="px-4 align-top text-xs">
                          <Badge variant="outline" className="font-mono text-[10px]">
                            {log.entityType}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-4 align-top">
                          {log.entityId ? (
                            <span className="font-mono text-[10px] text-muted-foreground">
                              {log.entityId.slice(0, 16)}…
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="px-4 align-top font-mono text-[11px] text-muted-foreground">
                          {log.ipAddress ?? "—"}
                        </TableCell>
                        <TableCell className="px-4 align-top">
                          {(() => {
                            const detail = auditDetailJson(log);
                            if (!detail) {
                              return (
                                <span className="text-xs text-muted-foreground">
                                  —
                                </span>
                              );
                            }

                            return (
                              <details className="max-w-md">
                                <summary className="cursor-pointer text-xs font-medium text-primary">
                                  ดูรายละเอียด
                                </summary>
                                <pre className="mt-2 max-h-72 overflow-auto rounded-md border bg-muted/40 p-2 text-[10px] leading-relaxed whitespace-pre-wrap break-all">
                                  {detail}
                                </pre>
                              </details>
                            );
                          })()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Pagination
                page={result.page}
                pageSize={result.pageSize}
                totalCount={result.totalCount}
                basePath="/audit-logs"
                preserveParams={preserveParams}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
