import "server-only";

import type { Prisma } from "@/generated/prisma/client";

export async function lockInventoryKey(
  tx: Prisma.TransactionClient,
  key: string,
): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
}

export async function nextDocumentSequence(
  tx: Prisma.TransactionClient,
  key: string,
  options: { padding?: number; createdById?: string } = {},
): Promise<string> {
  await lockInventoryKey(tx, `sequence:${key}`);

  const sequence = await tx.documentSequence.upsert({
    where: { key },
    create: {
      key,
      lastNumber: 1,
      createdById: options.createdById,
    },
    update: {
      lastNumber: { increment: 1 },
    },
    select: { lastNumber: true },
  });

  return String(sequence.lastNumber).padStart(options.padding ?? 4, "0");
}
