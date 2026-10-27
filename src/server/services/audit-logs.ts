import "server-only";

import { prisma } from "@/lib/db";

export const AUDIT_LOG_PAGE_SIZE = 50;

export type AuditLogRow = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  ipAddress: string | null;
  metadata: unknown;
  before: unknown;
  after: unknown;
  createdAt: Date;
};

export type AuditLogFilters = {
  actorId?: string;
  entityType?: string;
  action?: string;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
};

export async function listAuditLogs(
  filters: AuditLogFilters = {},
): Promise<{ items: AuditLogRow[]; totalCount: number; page: number; pageSize: number }> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(200, Math.max(10, filters.pageSize ?? AUDIT_LOG_PAGE_SIZE));
  const skip = (page - 1) * pageSize;

  const where = {
    ...(filters.actorId ? { actorId: filters.actorId } : {}),
    ...(filters.entityType ? { entityType: filters.entityType } : {}),
    ...(filters.action ? { action: { contains: filters.action, mode: "insensitive" as const } } : {}),
    ...(filters.from || filters.to
      ? {
          createdAt: {
            ...(filters.from ? { gte: filters.from } : {}),
            ...(filters.to ? { lte: filters.to } : {}),
          },
        }
      : {}),
  };

  const [logs, totalCount] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        ipAddress: true,
        metadata: true,
        before: true,
        after: true,
        createdAt: true,
        actor: {
          select: { name: true, email: true },
        },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    items: logs.map((log) => ({
      id: log.id,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      actorName: log.actor?.name ?? null,
      actorEmail: log.actor?.email ?? null,
      ipAddress: log.ipAddress,
      metadata: log.metadata,
      before: log.before,
      after: log.after,
      createdAt: log.createdAt,
    })),
    totalCount,
    page,
    pageSize,
  };
}

/** รายการ entityType ที่มีอยู่จริงในฐานข้อมูล */
export async function listAuditEntityTypes(): Promise<string[]> {
  const rows = await prisma.auditLog.groupBy({
    by: ["entityType"],
    orderBy: { entityType: "asc" },
  });
  return rows.map((r) => r.entityType);
}

/** รายชื่อ actor ที่มี log */
export async function listAuditActors(): Promise<
  Array<{ id: string; name: string; email: string }>
> {
  const rows = await prisma.auditLog.findMany({
    distinct: ["actorId"],
    where: { actorId: { not: null } },
    select: {
      actor: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return rows
    .map((r) => r.actor)
    .filter((a): a is { id: string; name: string; email: string } => a !== null);
}
