import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { QuoteStatus, Role } from "@/generated/prisma/enums";

import { prisma } from "@/lib/db";

export type QuoteActor = {
  id: string;
  role: Role;
};

const quoteListSelect = {
  id: true,
  quoteNumber: true,
  status: true,
  validUntil: true,
  grandTotal: true,
  createdAt: true,
  customer: { select: { id: true, name: true, phone: true } },
  createdBy: { select: { id: true, name: true } },
  convertedBill: { select: { id: true, billNumber: true } },
  _count: { select: { items: true } },
} satisfies Prisma.QuoteSelect;

const quoteDetailSelect = {
  id: true,
  quoteNumber: true,
  status: true,
  validUntil: true,
  note: true,
  subtotal: true,
  discountType: true,
  discountValue: true,
  discountAmount: true,
  netAmountBeforeVat: true,
  vatEnabled: true,
  vatIncluded: true,
  vatRate: true,
  vatAmount: true,
  grandTotal: true,
  acceptedAt: true,
  cancelledAt: true,
  createdAt: true,
  updatedAt: true,
  customer: {
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      address: true,
      taxId: true,
      lineId: true,
      whatsapp: true,
    },
  },
  createdBy: { select: { id: true, name: true } },
  convertedBill: { select: { id: true, billNumber: true, status: true } },
  items: {
    orderBy: { sortOrder: "asc" as const },
    select: {
      id: true,
      productId: true,
      description: true,
      quantity: true,
      unitPrice: true,
      discountType: true,
      discountValue: true,
      discountAmount: true,
      lineTotal: true,
      product: { select: { sku: true, name: true } },
    },
  },
} satisfies Prisma.QuoteSelect;

export type QuoteListItem = Prisma.QuoteGetPayload<{
  select: typeof quoteListSelect;
}>;

export type QuoteDetail = Prisma.QuoteGetPayload<{
  select: typeof quoteDetailSelect;
}> & {
  effectiveStatus: QuoteStatus;
};

export async function listQuotes(
  actor: QuoteActor,
  options: { q?: string; status?: QuoteStatus; page?: number; pageSize?: number } = {},
) {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, options.pageSize ?? 50));
  const q = options.q?.trim().slice(0, 100) ?? "";
  const statusFilter: Prisma.QuoteWhereInput =
    options.status === "EXPIRED"
      ? { status: "SENT", validUntil: { lt: new Date() } }
      : options.status
        ? { status: options.status }
        : {};
  const where: Prisma.QuoteWhereInput = {
    ...(actor.role === "ADMIN" ? {} : { createdById: actor.id }),
    ...statusFilter,
    ...(q
      ? {
          OR: [
            { quoteNumber: { contains: q, mode: "insensitive" } },
            { customer: { name: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [items, totalCount] = await Promise.all([
    prisma.quote.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: quoteListSelect,
    }),
    prisma.quote.count({ where }),
  ]);

  return { items, totalCount, page, pageSize };
}

export async function getQuoteById(
  actor: QuoteActor,
  quoteId: string,
): Promise<QuoteDetail | null> {
  const quote = await prisma.quote.findFirst({
    where: {
      id: quoteId,
      ...(actor.role === "ADMIN" ? {} : { createdById: actor.id }),
    },
    select: quoteDetailSelect,
  });

  if (!quote) {
    return null;
  }

  return {
    ...quote,
    effectiveStatus:
      quote.status === "SENT" && quote.validUntil.getTime() < Date.now()
        ? "EXPIRED"
        : quote.status,
  };
}

export async function getQuoteSummary(actor: QuoteActor) {
  const scope = actor.role === "ADMIN" ? {} : { createdById: actor.id };
  const now = new Date();

  const [sentCount, acceptedCount, expiredCount, sentAmount] =
    await Promise.all([
      prisma.quote.count({
        where: { ...scope, status: "SENT", validUntil: { gte: now } },
      }),
      prisma.quote.count({
        where: { ...scope, status: "ACCEPTED" },
      }),
      prisma.quote.count({
        where: { ...scope, status: "SENT", validUntil: { lt: now } },
      }),
      prisma.quote.aggregate({
        where: { ...scope, status: "SENT", validUntil: { gte: now } },
        _sum: { grandTotal: true },
      }),
    ]);

  return {
    sentCount,
    acceptedCount,
    expiredCount,
    sentAmount: sentAmount._sum.grandTotal?.toString() ?? "0.00",
  };
}
