import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type {
  BillItemKind,
  BillStatus,
  DiscountType,
  PaymentMethod,
  Role,
} from "@/generated/prisma/enums";

import { calculateBillTotals, calculateLineTotals, addMonths, BillCalculationError } from "@/lib/bill-calculations";
import { prisma } from "@/lib/db";
import { Decimal } from "@/lib/money";
import { writeAuditLog } from "@/server/audit";
import {
  lockInventoryKey,
  nextDocumentSequence,
} from "@/server/services/document-sequences";
import { BillError } from "@/server/services/bill-error";
import {
  createCommissionEntryForApprovedBill,
  reverseCommissionForBill,
} from "@/server/services/commissions";
import type {
  BillCreateInput,
  BillItemInput,
  BillUpdateInput,
} from "@/server/validators/bills";

export type BillActor = {
  id: string;
  role: Role;
};

export type BillListFilters = {
  q?: string;
  status?: BillStatus;
  billTypeId?: string;
  technicianId?: string;
  page?: number;
  pageSize?: number;
};

export type BillEditableSnapshot = {
  id: string;
  status: BillStatus;
  technicianId: string;
};

const billListSelect = {
  id: true,
  billNumber: true,
  title: true,
  status: true,
  grandTotal: true,
  createdAt: true,
  submittedAt: true,
  approvedAt: true,
  paidAt: true,
  voidedAt: true,
  billType: { select: { code: true, name: true } },
  customer: { select: { id: true, name: true, phone: true } },
  technician: { select: { id: true, name: true } },
} satisfies Prisma.BillSelect;

const billDetailSelect = {
  id: true,
  billNumber: true,
  status: true,
  technicianId: true,
  title: true,
  description: true,
  note: true,
  subtotal: true,
  lineDiscountTotal: true,
  discountType: true,
  discountValue: true,
  discountAmount: true,
  netAmountBeforeVat: true,
  vatEnabled: true,
  vatIncluded: true,
  vatRate: true,
  vatAmount: true,
  grandTotal: true,
  paymentMethod: true,
  rejectionReason: true,
  voidReason: true,
  submittedAt: true,
  approvedAt: true,
  rejectedAt: true,
  paidAt: true,
  voidedAt: true,
  stockDeductedAt: true,
  stockRestoredAt: true,
  createdAt: true,
  updatedAt: true,
  billType: {
    select: {
      id: true,
      code: true,
      name: true,
      prefix: true,
      requiresRepairDetail: true,
      requiresWarrantyCheck: true,
    },
  },
  customer: {
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      address: true,
      taxId: true,
    },
  },
  technician: { select: { id: true, name: true, email: true } },
  items: {
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      kind: true,
      productId: true,
      description: true,
      skuSnapshot: true,
      barcodeSnapshot: true,
      quantity: true,
      unitPrice: true,
      discountType: true,
      discountValue: true,
      discountAmount: true,
      lineTotal: true,
      warrantyMonths: true,
      sortOrder: true,
      product: {
        select: { id: true, sku: true, name: true, trackSerial: true },
      },
      serials: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          releasedAt: true,
          warrantyStartAt: true,
          warrantyEndAt: true,
          productSerial: {
            select: { id: true, serialNumber: true, status: true },
          },
        },
      },
    },
  },
  repairDetail: {
    select: {
      id: true,
      deviceBrand: true,
      deviceModel: true,
      deviceSerial: true,
      reportedSymptoms: true,
      diagnosis: true,
      resolution: true,
      repairStatus: true,
      receivedAt: true,
      completedAt: true,
      deliveredAt: true,
    },
  },
  warrantyClaim: {
    select: {
      id: true,
      productId: true,
      originalBillId: true,
      originalBillItemId: true,
      productSerialId: true,
      checkResult: true,
      originalSaleAt: true,
      warrantyStartAt: true,
      warrantyEndsAt: true,
      checkedAt: true,
      checkSnapshot: true,
      adminOverrideReason: true,
      adminOverrideAt: true,
      adminNote: true,
      product: { select: { id: true, sku: true, name: true } },
      productSerial: { select: { id: true, serialNumber: true } },
      originalBill: {
        select: { id: true, billNumber: true, status: true, approvedAt: true },
      },
      originalBillItem: {
        select: { id: true, description: true, quantity: true, lineTotal: true },
      },
    },
  },
  statusHistory: {
    orderBy: { changedAt: "asc" },
    select: {
      id: true,
      fromStatus: true,
      toStatus: true,
      reason: true,
      changedAt: true,
      changedBy: { select: { name: true, role: true } },
    },
  },
  commissionEntries: {
    orderBy: { earnedAt: "asc" },
    select: {
      id: true,
      kind: true,
      basis: true,
      ruleName: true,
      ruleType: true,
      rateSnapshot: true,
      baseAmount: true,
      costAmount: true,
      commissionAmount: true,
      status: true,
      earnedAt: true,
      reversedAt: true,
      payoutItem: {
        select: {
          payoutId: true,
          payout: { select: { payoutNo: true, status: true } },
        },
      },
    },
  },
} satisfies Prisma.BillSelect;

export type BillDetail = Prisma.BillGetPayload<{
  select: typeof billDetailSelect;
}>;

export function canViewBill(
  actor: BillActor,
  bill: Pick<BillEditableSnapshot, "technicianId">,
): boolean {
  return actor.role === "ADMIN" || bill.technicianId === actor.id;
}

export function canEditBill(
  actor: BillActor,
  bill: BillEditableSnapshot,
): boolean {
  return (
    (bill.status === "DRAFT" || bill.status === "REJECTED") &&
    canViewBill(actor, bill)
  );
}

function assertAdmin(actor: BillActor): void {
  if (actor.role !== "ADMIN") {
    throw new BillError(
      "FORBIDDEN",
      "เฉพาะผู้ดูแลระบบเท่านั้นที่ดำเนินการขั้นตอนนี้ได้",
    );
  }
}

function optional(value?: string): string | null {
  return value?.trim() ? value.trim() : null;
}

function currentBuddhistYear(date = new Date()): number {
  const year = Number(
    new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      timeZone: "Asia/Bangkok",
    }).format(date),
  );

  return year + 543;
}

function billWhereForActor(
  actor: BillActor,
  filters: BillListFilters = {},
): Prisma.BillWhereInput {
  const q = filters.q?.trim().slice(0, 100) ?? "";
  const phoneDigits = q.replace(/\D/g, "");
  const technicianId =
    actor.role === "ADMIN" ? filters.technicianId : actor.id;
  const searchConditions: Prisma.BillWhereInput[] = q
    ? [
        { billNumber: { contains: q, mode: "insensitive" } },
        { title: { contains: q, mode: "insensitive" } },
        { customer: { name: { contains: q, mode: "insensitive" } } },
        ...(phoneDigits
          ? [{ customer: { phone: { contains: phoneDigits } } }]
          : []),
      ]
    : [];

  return {
    ...(technicianId ? { technicianId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.billTypeId ? { billTypeId: filters.billTypeId } : {}),
    ...(searchConditions.length > 0 ? { OR: searchConditions } : {}),
  };
}

export const BILLS_PAGE_SIZE = 50;

export async function listBills(
  actor: BillActor,
  filters: BillListFilters = {},
) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(200, Math.max(10, filters.pageSize ?? BILLS_PAGE_SIZE));
  const skip = (page - 1) * pageSize;
  const where = billWhereForActor(actor, filters);

  const [items, totalCount] = await Promise.all([
    prisma.bill.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      select: billListSelect,
    }),
    prisma.bill.count({ where }),
  ]);

  return { items, totalCount, page, pageSize };
}

export async function getBillSummary(actor: BillActor) {
  const where =
    actor.role === "ADMIN" ? {} : { technicianId: actor.id };

  const [draftCount, pendingCount, approvedCount, paidCount, voidedCount, pendingAmount] =
    await Promise.all([
      prisma.bill.count({ where: { ...where, status: "DRAFT" } }),
      prisma.bill.count({ where: { ...where, status: "PENDING_APPROVAL" } }),
      prisma.bill.count({ where: { ...where, status: "APPROVED" } }),
      prisma.bill.count({ where: { ...where, status: "PAID" } }),
      prisma.bill.count({ where: { ...where, status: "VOIDED" } }),
      prisma.bill.aggregate({
        where: { ...where, status: "PENDING_APPROVAL" },
        _sum: { grandTotal: true },
      }),
    ]);

  return {
    draftCount,
    pendingCount,
    approvedCount,
    paidCount,
    voidedCount,
    pendingAmount: pendingAmount._sum.grandTotal?.toString() ?? "0.00",
  };
}

export async function getBillById(actor: BillActor, billId: string) {
  return prisma.bill.findFirst({
    where: {
      id: billId,
      ...(actor.role === "ADMIN" ? {} : { technicianId: actor.id }),
    },
    select: billDetailSelect,
  });
}

export async function getBillForEdit(actor: BillActor, billId: string) {
  const bill = await getBillById(actor, billId);

  if (!bill || !canEditBill(actor, bill)) {
    return null;
  }

  return bill;
}

type ProductForBilling = {
  id: string;
  sku: string;
  name: string;
  costPrice: Decimal;
  salePrice: Decimal;
  stockQty: number;
  warrantyMonths: number;
  trackSerial: boolean;
  isActive: boolean;
  deletedAt: Date | null;
  barcodes: Array<{ barcode: string; isPrimary: boolean }>;
  serials: Array<{ id: string; serialNumber: string; status: string }>;
};

type PreparedLine = {
  kind: BillItemKind;
  productId: string | null;
  description: string;
  skuSnapshot: string | null;
  barcodeSnapshot: string | null;
  quantity: number;
  unitPrice: Decimal;
  unitCost: Decimal;
  discountType: DiscountType | null;
  discountValue: Decimal;
  discountAmount: Decimal;
  lineTotal: Decimal;
  warrantyMonths: number | null;
  sortOrder: number;
  serialIds: string[];
};

async function prepareBillLines(
  tx: Prisma.TransactionClient,
  items: BillItemInput[],
): Promise<PreparedLine[]> {
  const productItems = items.filter(
    (item) => item.kind === "PRODUCT" && item.productId,
  );
  const productIds = [
    ...new Set(
      productItems
        .map((item) => item.productId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const serialIds = [
    ...new Set(items.flatMap((item) => item.serialIds)),
  ];

  const [products, serials] = await Promise.all([
    productIds.length
      ? tx.product.findMany({
          where: { id: { in: productIds } },
          select: {
            id: true,
            sku: true,
            name: true,
            costPrice: true,
            salePrice: true,
            stockQty: true,
            warrantyMonths: true,
            trackSerial: true,
            isActive: true,
            deletedAt: true,
            barcodes: {
              orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
              select: { barcode: true, isPrimary: true },
            },
            serials: {
              where: { id: { in: serialIds } },
              select: { id: true, serialNumber: true, status: true },
            },
          },
        })
      : Promise.resolve([] as ProductForBilling[]),
    serialIds.length
      ? tx.productSerial.findMany({
          where: { id: { in: serialIds } },
          select: { id: true, productId: true, serialNumber: true, status: true },
        })
      : Promise.resolve([]),
  ]);

  const productMap = new Map(products.map((product) => [product.id, product]));
  const serialMap = new Map(serials.map((serial) => [serial.id, serial]));
  const seenProductIds = new Set<string>();
  const seenSerialIds = new Set<string>();
  const lines: PreparedLine[] = [];

  for (const [index, item] of items.entries()) {
    if (item.kind === "SERVICE") {
      try {
        const calculation = calculateLineTotals({
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountType: item.discountType,
          discountValue: item.discountValue,
        });

        lines.push({
          kind: "SERVICE",
          productId: null,
          description: item.description?.trim() || "ค่าบริการ",
          skuSnapshot: null,
          barcodeSnapshot: null,
          quantity: item.quantity,
          unitPrice: new Decimal(item.unitPrice),
          unitCost: new Decimal(0),
          discountType: item.discountType,
          discountValue: item.discountType ? new Decimal(item.discountValue) : new Decimal(0),
          discountAmount: calculation.discountAmount,
          lineTotal: calculation.lineTotal,
          warrantyMonths: null,
          sortOrder: index,
          serialIds: [],
        });
      } catch (error) {
        throwToBillCalculationError(error);
      }
      continue;
    }

    if (!item.productId) {
      throw new BillError("PRODUCT_INACTIVE", "ไม่พบสินค้าในรายการ");
    }

    if (seenProductIds.has(item.productId)) {
      throw new BillError(
        "DUPLICATE_PRODUCT_LINE",
        "สินค้าเดียวกันไม่ควรปรากฏซ้ำในบิล กรุณาเพิ่มจำนวนในรายการเดิม",
      );
    }
    seenProductIds.add(item.productId);

    const product = productMap.get(item.productId);

    if (!product || !product.isActive || product.deletedAt) {
      throw new BillError(
        "PRODUCT_INACTIVE",
        "มีสินค้าที่ถูกปิดใช้งานหรือไม่พบในระบบ",
      );
    }

    if (!product.trackSerial && item.serialIds.length > 0) {
      throw new BillError(
        "SERIAL_NOT_FOUND",
        `สินค้า ${product.name} ไม่ได้ติดตาม Serial`,
      );
    }

    if (product.trackSerial && item.serialIds.length !== item.quantity) {
      throw new BillError(
        "SERIAL_REQUIRED",
        `สินค้า ${product.name} ต้องเลือก Serial ให้ครบ ${item.quantity} รายการ`,
      );
    }

    for (const serialId of item.serialIds) {
      if (seenSerialIds.has(serialId)) {
        throw new BillError("SERIAL_DUPLICATE", "Serial ถูกเลือกซ้ำในบิลนี้");
      }
      seenSerialIds.add(serialId);

      const serial = serialMap.get(serialId);

      if (!serial || serial.productId !== product.id) {
        throw new BillError(
          "SERIAL_NOT_FOUND",
          `ไม่พบ Serial ที่เลือกสำหรับ ${product.name}`,
        );
      }

      if (serial.status !== "IN_STOCK") {
        throw new BillError(
          "SERIAL_NOT_AVAILABLE",
          `Serial ${serial.serialNumber} ไม่พร้อมขาย`,
        );
      }
    }

    try {
      const calculation = calculateLineTotals({
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountType: item.discountType,
        discountValue: item.discountValue,
      });

      lines.push({
        kind: "PRODUCT",
        productId: product.id,
        description: product.name,
        skuSnapshot: product.sku,
        barcodeSnapshot:
          product.barcodes.find((barcode) => barcode.isPrimary)?.barcode ??
          product.barcodes[0]?.barcode ??
          null,
        quantity: item.quantity,
        unitPrice: new Decimal(item.unitPrice),
        unitCost: product.costPrice,
        discountType: item.discountType,
        discountValue: item.discountType ? new Decimal(item.discountValue) : new Decimal(0),
        discountAmount: calculation.discountAmount,
        lineTotal: calculation.lineTotal,
        warrantyMonths: product.warrantyMonths,
        sortOrder: index,
        serialIds: item.serialIds,
      });
    } catch (error) {
      throwToBillCalculationError(error);
    }
  }

  return lines;
}

function throwToBillCalculationError(error: unknown): never {
  if (error instanceof BillCalculationError) {
    throw new BillError("INVALID_DISCOUNT", error.message);
  }
  throw error;
}

function readSettingsSelect() {
  return {
    vatEnabled: true,
    vatRate: true,
    vatIncluded: true,
  } as const;
}

type BillSettings = {
  vatEnabled: boolean;
  vatRate: Decimal;
  vatIncluded: boolean;
};

async function readBillSettings(
  tx: Prisma.TransactionClient,
): Promise<BillSettings> {
  const setting = await tx.appSetting.findUnique({
    where: { id: "main" },
    select: readSettingsSelect(),
  });

  return {
    vatEnabled: setting?.vatEnabled ?? false,
    vatRate: setting?.vatRate ?? new Decimal(7),
    vatIncluded: setting?.vatIncluded ?? true,
  };
}

async function calculateBillForWrite(
  tx: Prisma.TransactionClient,
  input: BillCreateInput | BillUpdateInput,
  settings: BillSettings,
) {
  const lines = await prepareBillLines(tx, input.items);

  try {
    const totals = calculateBillTotals({
      lineTotals: lines.map((line) => ({
        lineTotal: line.lineTotal,
        discountAmount: line.discountAmount,
      })),
      discountType: input.discountType,
      discountValue: input.discountValue,
      vatEnabled: settings.vatEnabled,
      vatIncluded: settings.vatIncluded,
      vatRate: settings.vatRate.toString(),
    });

    return {
      lines,
      amounts: {
        subtotal: totals.subtotal,
        lineDiscountTotal: totals.lineDiscountTotal,
        discountType: input.discountType,
        discountValue: input.discountType
          ? new Decimal(input.discountValue)
          : new Decimal(0),
        discountAmount: totals.discountAmount,
        netAmountBeforeVat: totals.netAmountBeforeVat,
        vatEnabled: settings.vatEnabled,
        vatIncluded: settings.vatIncluded,
        vatRate: totals.vatRate,
        vatAmount: totals.vatAmount,
        grandTotal: totals.grandTotal,
      },
    };
  } catch (error) {
    throwToBillCalculationError(error);
  }
}

async function resolveTechnicianId(
  tx: Prisma.TransactionClient,
  actor: BillActor,
  requestedTechnicianId?: string,
): Promise<string> {
  if (actor.role !== "ADMIN") {
    const self = await tx.user.findFirst({
      where: { id: actor.id, isActive: true, role: "TECHNICIAN" },
      select: { id: true },
    });

    if (!self) {
      throw new BillError("TECHNICIAN_INVALID", "ไม่พบช่างเทคนิคที่ใช้งานอยู่");
    }

    return self.id;
  }

  if (!requestedTechnicianId) {
    throw new BillError("TECHNICIAN_INVALID", "กรุณาเลือกช่างผู้รับผิดชอบบิล");
  }

  const technician = await tx.user.findFirst({
    where: {
      id: requestedTechnicianId,
      isActive: true,
      role: "TECHNICIAN",
    },
    select: { id: true },
  });

  if (!technician) {
    throw new BillError("TECHNICIAN_INVALID", "ไม่พบช่างเทคนิคที่เลือก");
  }

  return technician.id;
}

async function getWritableBillType(
  tx: Prisma.TransactionClient,
  billTypeId: string,
) {
  const billType = await tx.billType.findFirst({
    where: { id: billTypeId, isActive: true },
    select: {
      id: true,
      code: true,
      name: true,
      prefix: true,
      requiresRepairDetail: true,
      requiresWarrantyCheck: true,
    },
  });

  if (!billType) {
    throw new BillError("BILL_TYPE_INACTIVE", "ไม่พบประเภทบิลที่เปิดใช้งาน");
  }

  return billType;
}

async function getWritableCustomer(
  tx: Prisma.TransactionClient,
  customerId: string,
) {
  const customer = await tx.customer.findFirst({
    where: { id: customerId, isActive: true, deletedAt: null },
    select: { id: true, name: true },
  });

  if (!customer) {
    throw new BillError(
      "CUSTOMER_INACTIVE",
      "ไม่พบลูกค้าที่ใช้งานอยู่ กรุณาเลือกหรือสร้างลูกค้าใหม่",
    );
  }

  return customer;
}

async function writeBillItems(
  tx: Prisma.TransactionClient,
  actor: BillActor,
  billId: string,
  lines: PreparedLine[],
) {
  for (const line of lines) {
    const item = await tx.billItem.create({
      data: {
        billId,
        kind: line.kind,
        productId: line.productId,
        description: line.description,
        skuSnapshot: line.skuSnapshot,
        barcodeSnapshot: line.barcodeSnapshot,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        unitCost: line.unitCost,
        discountType: line.discountType,
        discountValue: line.discountValue,
        discountAmount: line.discountAmount,
        lineTotal: line.lineTotal,
        warrantyMonths: line.warrantyMonths,
        sortOrder: line.sortOrder,
        createdById: actor.id,
      },
      select: { id: true },
    });

    if (line.serialIds.length > 0) {
      await tx.billItemSerial.createMany({
        data: line.serialIds.map((productSerialId) => ({
          billItemId: item.id,
          productSerialId,
          createdById: actor.id,
        })),
      });
    }
  }
}

function repairData(
  input: NonNullable<BillCreateInput["repair"]>,
) {
  return {
    deviceBrand: optional(input.deviceBrand),
    deviceModel: optional(input.deviceModel),
    deviceSerial: optional(input.deviceSerial),
    reportedSymptoms: input.reportedSymptoms?.trim() ?? "",
    diagnosis: optional(input.diagnosis),
    resolution: optional(input.resolution),
    repairStatus: input.repairStatus ?? ("RECEIVED" as const),
  };
}

async function writeRepairDetail(
  tx: Prisma.TransactionClient,
  actor: BillActor,
  billId: string,
  billType: { requiresRepairDetail: boolean },
  input?: BillCreateInput["repair"],
) {
  if (!billType.requiresRepairDetail || !input) {
    await tx.billRepairDetail.deleteMany({ where: { billId } });
    return;
  }

  const data = repairData(input);

  await tx.billRepairDetail.upsert({
    where: { billId },
    create: {
      ...data,
      billId,
      receivedAt: new Date(),
      createdById: actor.id,
    },
    update: {
      ...data,
      receivedAt: undefined,
    },
  });
}

function readClaimSerial(snapshot: Prisma.JsonValue | null): string | null {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return null;
  }

  const value = (snapshot as Prisma.JsonObject).claimedSerialNumber;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

const ACTIVE_WARRANTY_CLAIM_STATUSES = [
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
] as const;

async function assertNoDuplicateWarrantyClaim(
  tx: Prisma.TransactionClient,
  billId: string,
  customerId: string,
  claim: { productId: string; productSerialId: string | null },
) {
  const lockKey = claim.productSerialId
    ? `claim:serial:${claim.productSerialId}`
    : `claim:customer:${customerId}:product:${claim.productId}`;
  await lockInventoryKey(tx, lockKey);

  const duplicate = await tx.billWarrantyClaim.findFirst({
    where: {
      billId: { not: billId },
      ...(claim.productSerialId
        ? { productSerialId: claim.productSerialId }
        : { productId: claim.productId }),
      bill: {
        status: { in: [...ACTIVE_WARRANTY_CLAIM_STATUSES] },
        ...(claim.productSerialId ? {} : { customerId }),
      },
    },
    select: { bill: { select: { billNumber: true } } },
    orderBy: { createdAt: "asc" },
  });

  if (duplicate) {
    throw new BillError(
      "DUPLICATE_WARRANTY_CLAIM",
      `สินค้านี้มีใบเคลมที่ยังไม่ปิดอยู่แล้ว (${duplicate.bill.billNumber}) กรุณาปิดใบเคลมเดิมก่อนเปิดใบใหม่`,
      [duplicate.bill.billNumber],
    );
  }
}

async function writeWarrantyClaim(
  tx: Prisma.TransactionClient,
  actor: BillActor,
  billId: string,
  billType: { requiresWarrantyCheck: boolean },
  customerId: string,
  input?: BillCreateInput["claim"],
) {
  if (!billType.requiresWarrantyCheck || !input?.productId) {
    await tx.billWarrantyClaim.deleteMany({ where: { billId } });
    return;
  }

  const product = await tx.product.findUnique({
    where: { id: input.productId },
    select: { id: true, name: true },
  });

  if (!product) {
    throw new BillError("PRODUCT_INACTIVE", "ไม่พบสินค้าที่ต้องการเคลม");
  }

  const serialNumber = input.serialNumber?.trim() || undefined;
  const productSerial = serialNumber
    ? await tx.productSerial.findUnique({
        where: { serialNumber },
        select: { id: true, productId: true, serialNumber: true },
      })
    : null;

  if (productSerial && productSerial.productId !== product.id) {
    throw new BillError(
      "SERIAL_NOT_FOUND",
      "Serial ที่ระบุไม่ตรงกับสินค้าที่ต้องการเคลม",
    );
  }

  await assertNoDuplicateWarrantyClaim(tx, billId, customerId, {
    productId: product.id,
    productSerialId: productSerial?.id ?? null,
  });

  await tx.billWarrantyClaim.upsert({
    where: { billId },
    create: {
      billId,
      productId: product.id,
      productSerialId: productSerial?.id,
      adminNote: optional(input.note),
      checkSnapshot: {
        claimedSerialNumber: serialNumber ?? null,
      },
      createdById: actor.id,
    },
    update: {
      productId: product.id,
      productSerialId: productSerial?.id,
      adminNote: optional(input.note),
      checkResult: null,
      originalBillId: null,
      originalBillItemId: null,
      originalSaleAt: null,
      warrantyStartAt: null,
      warrantyEndsAt: null,
      checkedAt: null,
      checkedById: null,
      checkSnapshot: {
        claimedSerialNumber: serialNumber ?? null,
      },
      adminOverrideReason: null,
      adminOverrideAt: null,
      adminOverrideById: null,
    },
  });
}

export async function createBill(
  actor: BillActor,
  input: BillCreateInput,
) {
  return prisma.$transaction(async (tx) => {
    const billType = await getWritableBillType(tx, input.billTypeId);
    const customer = await getWritableCustomer(tx, input.customerId);
    const technicianId = await resolveTechnicianId(
      tx,
      actor,
      input.technicianId,
    );
    const settings = await readBillSettings(tx);
    const calculated = await calculateBillForWrite(tx, input, settings);
    const year = currentBuddhistYear();
    const sequenceKey = `${billType.prefix}-${year}`;
    const running = await nextDocumentSequence(tx, sequenceKey, {
      padding: 6,
      createdById: actor.id,
    });
    const billNumber = `${sequenceKey}-${running}`;

    const bill = await tx.bill.create({
      data: {
        billNumber,
        billTypeId: billType.id,
        customerId: customer.id,
        technicianId,
        title: input.title.trim(),
        description: optional(input.description),
        note: optional(input.note),
        ...calculated.amounts,
        createdById: actor.id,
      },
      select: { id: true, billNumber: true },
    });

    await writeBillItems(tx, actor, bill.id, calculated.lines);
    await writeRepairDetail(tx, actor, bill.id, billType, input.repair);
    await writeWarrantyClaim(
      tx,
      actor,
      bill.id,
      billType,
      input.customerId,
      input.claim,
    );

    await tx.billStatusHistory.create({
      data: {
        billId: bill.id,
        fromStatus: null,
        toStatus: "DRAFT",
        reason: "สร้างบิล",
        changedById: actor.id,
        createdById: actor.id,
      },
    });

    await writeAuditLog(
      {
        actorId: actor.id,
        action: "BILL_CREATED",
        entityType: "Bill",
        entityId: bill.id,
        after: {
          billNumber: bill.billNumber,
          billType: billType.code,
          customerId: customer.id,
          technicianId,
          status: "DRAFT",
          grandTotal: calculated.amounts.grandTotal.toFixed(2),
          itemCount: calculated.lines.length,
        },
      },
      tx,
    );

    return bill;
  });
}

export async function updateBill(
  actor: BillActor,
  input: BillUpdateInput,
) {
  return prisma.$transaction(async (tx) => {
    await lockInventoryKey(tx, `bill:${input.billId}`);
    const existing = await tx.bill.findUnique({
      where: { id: input.billId },
      select: { id: true, status: true, technicianId: true, billNumber: true },
    });

    if (!existing) {
      throw new BillError("NOT_FOUND", "ไม่พบบิลนี้");
    }

    if (!canEditBill(actor, existing)) {
      throw new BillError(
        "INVALID_STATUS",
        "แก้ไขได้เฉพาะบิลร่างหรือบิลที่ถูกตีกลับ และต้องเป็นบิลของตนเอง",
      );
    }

    const billType = await getWritableBillType(tx, input.billTypeId);
    const customer = await getWritableCustomer(tx, input.customerId);
    const technicianId = await resolveTechnicianId(
      tx,
      actor,
      input.technicianId ?? existing.technicianId,
    );
    const settings = await readBillSettings(tx);
    const calculated = await calculateBillForWrite(tx, input, settings);

    await tx.billItemSerial.deleteMany({
      where: { billItem: { billId: existing.id } },
    });
    await tx.billItem.deleteMany({ where: { billId: existing.id } });

    await tx.bill.update({
      where: { id: existing.id },
      data: {
        billTypeId: billType.id,
        customerId: customer.id,
        technicianId,
        title: input.title.trim(),
        description: optional(input.description),
        note: optional(input.note),
        ...calculated.amounts,
      },
    });

    await writeBillItems(tx, actor, existing.id, calculated.lines);
    await writeRepairDetail(tx, actor, existing.id, billType, input.repair);
    await writeWarrantyClaim(
      tx,
      actor,
      existing.id,
      billType,
      customer.id,
      input.claim,
    );

    await writeAuditLog(
      {
        actorId: actor.id,
        action: "BILL_UPDATED",
        entityType: "Bill",
        entityId: existing.id,
        before: { status: existing.status },
        after: {
          billNumber: existing.billNumber,
          billType: billType.code,
          customerId: customer.id,
          technicianId,
          status: existing.status,
          grandTotal: calculated.amounts.grandTotal.toFixed(2),
          itemCount: calculated.lines.length,
        },
      },
      tx,
    );

    return { id: existing.id, billNumber: existing.billNumber };
  });
}

type WorkflowItem = {
  id: string;
  productId: string | null;
  quantity: number;
  description: string;
  serials: Array<{ id: string; productSerialId: string }>;
  product: {
    id: string;
    sku: string;
    name: string;
    stockQty: number;
    costPrice: Decimal;
    warrantyMonths: number;
    trackSerial: boolean;
    isActive: boolean;
    deletedAt: Date | null;
  } | null;
};

async function validateStockForItems(
  tx: Prisma.TransactionClient,
  items: WorkflowItem[],
  options: { lock: boolean },
) {
  const productIds = [
    ...new Set(
      items
        .map((item) => item.productId)
        .filter((id): id is string => Boolean(id)),
    ),
  ].sort();

  if (options.lock) {
    for (const productId of productIds) {
      await lockInventoryKey(tx, `stock:${productId}`);
    }
  }

  const products = await tx.product.findMany({
    where: { id: { in: productIds } },
    select: {
      id: true,
      sku: true,
      name: true,
      stockQty: true,
      costPrice: true,
      warrantyMonths: true,
      trackSerial: true,
      isActive: true,
      deletedAt: true,
    },
  });
  const productMap = new Map(products.map((product) => [product.id, product]));
  const serialIds = items.flatMap((item) =>
    item.serials.map((serial) => serial.productSerialId),
  );
  const serials = serialIds.length
    ? await tx.productSerial.findMany({
        where: { id: { in: serialIds } },
        select: { id: true, productId: true, serialNumber: true, status: true },
      })
    : [];
  const serialMap = new Map(serials.map((serial) => [serial.id, serial]));
  const problems: string[] = [];

  for (const item of items) {
    if (!item.productId) {
      continue;
    }

    const product = productMap.get(item.productId);

    if (!product || !product.isActive || product.deletedAt) {
      problems.push(`สินค้า ${item.description} ถูกปิดใช้งานหรือไม่พบ`);
      continue;
    }

    if (product.stockQty < item.quantity) {
      problems.push(
        `${product.name}: คงเหลือ ${product.stockQty} แต่ต้องใช้ ${item.quantity}`,
      );
    }

    if (product.trackSerial) {
      if (item.serials.length !== item.quantity) {
        problems.push(
          `${product.name}: ต้องเลือก Serial ${item.quantity} รายการ แต่มี ${item.serials.length} รายการ`,
        );
      }

      for (const itemSerial of item.serials) {
        const serial = serialMap.get(itemSerial.productSerialId);

        if (!serial || serial.productId !== product.id) {
          problems.push(`${product.name}: ไม่พบ Serial ที่เลือก`);
          continue;
        }

        if (serial.status !== "IN_STOCK") {
          problems.push(`Serial ${serial.serialNumber} ไม่พร้อมขาย`);
        }
      }
    } else if (item.serials.length > 0) {
      problems.push(`${product.name}: สินค้านี้ไม่ได้ติดตาม Serial`);
    }
  }

  if (problems.length > 0) {
    throw new BillError(
      "STOCK_INSUFFICIENT",
      "สต๊อกหรือ Serial ไม่เพียงพอ กรุณาตรวจสอบรายการอีกครั้ง",
      problems,
    );
  }

  return productMap;
}

export async function submitBill(actor: BillActor, billId: string) {
  return prisma.$transaction(async (tx) => {
    await lockInventoryKey(tx, `bill:${billId}`);
    const bill = await tx.bill.findUnique({
      where: { id: billId },
      select: {
        id: true,
        billNumber: true,
        status: true,
        technicianId: true,
        customerId: true,
        billType: {
          select: {
            requiresRepairDetail: true,
            requiresWarrantyCheck: true,
          },
        },
        items: {
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            productId: true,
            quantity: true,
            description: true,
            serials: {
              select: { id: true, productSerialId: true },
            },
            product: {
              select: {
                id: true,
                sku: true,
                name: true,
                stockQty: true,
                costPrice: true,
                warrantyMonths: true,
                trackSerial: true,
                isActive: true,
                deletedAt: true,
              },
            },
          },
        },
        repairDetail: { select: { reportedSymptoms: true } },
      },
    });

    if (!bill) {
      throw new BillError("NOT_FOUND", "ไม่พบบิลนี้");
    }

    if (!canViewBill(actor, bill)) {
      throw new BillError("FORBIDDEN", "คุณไม่มีสิทธิ์ส่งบิลนี้เพื่อขออนุมัติ");
    }

    if (bill.status !== "DRAFT" && bill.status !== "REJECTED") {
      throw new BillError(
        "INVALID_STATUS",
        "ส่งขออนุมัติได้เฉพาะบิลร่างหรือบิลที่ถูกตีกลับเท่านั้น",
      );
    }

    if (bill.items.length === 0) {
      throw new BillError("EMPTY_ITEMS", "กรุณาเพิ่มรายการสินค้าหรือบริการก่อนส่งอนุมัติ");
    }

    if (
      bill.billType.requiresRepairDetail &&
      (!bill.repairDetail?.reportedSymptoms.trim() ||
        bill.repairDetail.reportedSymptoms.trim().length < 3)
    ) {
      throw new BillError(
        "REPAIR_DETAIL_REQUIRED",
        "กรุณาระบุอาการเสียก่อนส่งบิลซ่อมเพื่อขออนุมัติ",
      );
    }

    await validateStockForItems(tx, bill.items, { lock: false });

    if (bill.billType.requiresWarrantyCheck) {
      const claim = await tx.billWarrantyClaim.findUnique({
        where: { billId: bill.id },
        select: { id: true, productId: true, productSerialId: true },
      });

      if (!claim) {
        throw new BillError(
          "WARRANTY_CLAIM_REQUIRED",
          "กรุณาระบุสินค้าที่ต้องการเคลมก่อนส่งขออนุมัติ",
        );
      }

      await assertNoDuplicateWarrantyClaim(tx, bill.id, bill.customerId, {
        productId: claim.productId,
        productSerialId: claim.productSerialId,
      });

      await refreshWarrantyClaimCheck(tx, bill.id, actor);
    }

    const now = new Date();
    await tx.bill.update({
      where: { id: bill.id },
      data: {
        status: "PENDING_APPROVAL",
        submittedAt: now,
        rejectionReason: null,
        rejectedAt: null,
        rejectedById: null,
      },
    });

    await tx.billStatusHistory.create({
      data: {
        billId: bill.id,
        fromStatus: bill.status,
        toStatus: "PENDING_APPROVAL",
        reason: "ส่งบิลเพื่อขออนุมัติ",
        changedById: actor.id,
        createdById: actor.id,
      },
    });

    await writeAuditLog(
      {
        actorId: actor.id,
        action: "BILL_SUBMITTED",
        entityType: "Bill",
        entityId: bill.id,
        before: { status: bill.status },
        after: { status: "PENDING_APPROVAL" },
        metadata: { billNumber: bill.billNumber },
      },
      tx,
    );

    return { id: bill.id };
  });
}

type ClaimCheckResult = {
  result: "FOUND_IN_WARRANTY" | "FOUND_OUT_OF_WARRANTY" | "NOT_FOUND";
  originalBillNumber: string | null;
  productSerialId: string | null;
  adminOverrideReason: string | null;
};

async function refreshWarrantyClaimCheck(
  tx: Prisma.TransactionClient,
  billId: string,
  actor: BillActor,
): Promise<ClaimCheckResult> {
  const claim = await tx.billWarrantyClaim.findUnique({
    where: { billId },
    select: {
      id: true,
      productId: true,
      productSerialId: true,
      checkSnapshot: true,
      adminOverrideReason: true,
      product: { select: { name: true } },
      productSerial: { select: { id: true, serialNumber: true } },
      bill: { select: { customerId: true, billNumber: true } },
    },
  });

  if (!claim) {
    throw new BillError(
      "WARRANTY_CLAIM_REQUIRED",
      "ไม่พบข้อมูลการเคลมสำหรับบิลนี้",
    );
  }

  const serialNumber =
    claim.productSerial?.serialNumber ??
    readClaimSerial(claim.checkSnapshot);
  const serial = serialNumber
    ? await tx.productSerial.findUnique({
        where: { serialNumber },
        select: {
          id: true,
          productId: true,
          serialNumber: true,
          status: true,
        },
      })
    : null;

  if (serial && serial.productId !== claim.productId) {
    throw new BillError(
      "SERIAL_NOT_FOUND",
      "Serial ที่ระบุไม่ตรงกับสินค้าที่ต้องการเคลม",
    );
  }

  let originalBillId: string | null = null;
  let originalBillItemId: string | null = null;
  let originalSaleAt: Date | null = null;
  let warrantyStartAt: Date | null = null;
  let warrantyEndsAt: Date | null = null;
  let originalBillNumber: string | null = null;
  let warrantyMonths = 0;

  if (serial) {
    const purchase = await tx.billItemSerial.findFirst({
      where: {
        productSerialId: serial.id,
        releasedAt: null,
        billItem: {
          bill: {
            customerId: claim.bill.customerId,
            status: { in: ["APPROVED", "PAID"] },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      select: {
        warrantyStartAt: true,
        warrantyEndAt: true,
        billItem: {
          select: {
            id: true,
            warrantyMonths: true,
            bill: {
              select: {
                id: true,
                billNumber: true,
                approvedAt: true,
                paidAt: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });

    if (purchase) {
      const purchaseBill = purchase.billItem.bill;
      originalBillId = purchaseBill.id;
      originalBillItemId = purchase.billItem.id;
      originalBillNumber = purchaseBill.billNumber;
      originalSaleAt =
        purchaseBill.paidAt ?? purchaseBill.approvedAt ?? purchaseBill.createdAt;
      warrantyMonths = purchase.billItem.warrantyMonths ?? 0;
      warrantyStartAt = purchase.warrantyStartAt ?? originalSaleAt;
      warrantyEndsAt =
        purchase.warrantyEndAt ??
        (warrantyMonths > 0
          ? addMonths(warrantyStartAt, warrantyMonths)
          : null);
    }
  } else if (!serialNumber) {
    const purchases = await tx.billItem.findMany({
      where: {
        productId: claim.productId,
        bill: {
          customerId: claim.bill.customerId,
          status: { in: ["APPROVED", "PAID"] },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        warrantyMonths: true,
        bill: {
          select: {
            id: true,
            billNumber: true,
            approvedAt: true,
            paidAt: true,
            createdAt: true,
          },
        },
      },
    });

    const purchase = purchases.sort((a, b) => {
      const aDate = a.bill.paidAt ?? a.bill.approvedAt ?? a.bill.createdAt;
      const bDate = b.bill.paidAt ?? b.bill.approvedAt ?? b.bill.createdAt;
      return bDate.getTime() - aDate.getTime();
    })[0];

    if (purchase) {
      originalBillId = purchase.bill.id;
      originalBillItemId = purchase.id;
      originalBillNumber = purchase.bill.billNumber;
      originalSaleAt =
        purchase.bill.paidAt ??
        purchase.bill.approvedAt ??
        purchase.bill.createdAt;
      warrantyMonths = purchase.warrantyMonths ?? 0;
      warrantyStartAt = originalSaleAt;
      warrantyEndsAt =
        warrantyMonths > 0 ? addMonths(originalSaleAt, warrantyMonths) : null;
    }
  }

  const now = new Date();
  const checkResult: ClaimCheckResult["result"] = !originalBillId
    ? "NOT_FOUND"
    : warrantyEndsAt && warrantyEndsAt >= now
      ? "FOUND_IN_WARRANTY"
      : "FOUND_OUT_OF_WARRANTY";

  const updated = await tx.billWarrantyClaim.update({
    where: { id: claim.id },
    data: {
      productSerialId: serial?.id ?? null,
      originalBillId,
      originalBillItemId,
      checkResult,
      originalSaleAt,
      warrantyStartAt,
      warrantyEndsAt,
      checkedAt: now,
      checkedById: actor.id,
      checkSnapshot: {
        claimedSerialNumber: serialNumber ?? null,
        originalBillNumber,
        checkedAt: now.toISOString(),
        source: serial ? "serial" : "product_customer",
        warrantyMonths,
      },
    },
    select: { id: true, adminOverrideReason: true },
  });

  return {
    result: checkResult,
    originalBillNumber,
    productSerialId: serial?.id ?? null,
    adminOverrideReason: updated.adminOverrideReason,
  };
}

function warrantyResultMessage(
  result: ClaimCheckResult["result"],
  originalBillNumber: string | null,
): string {
  if (result === "FOUND_IN_WARRANTY") {
    return `พบประวัติซื้อและยังอยู่ในประกัน${originalBillNumber ? ` (${originalBillNumber})` : ""}`;
  }

  if (result === "FOUND_OUT_OF_WARRANTY") {
    return `พบประวัติซื้อแต่หมดประกันแล้ว${originalBillNumber ? ` (${originalBillNumber})` : ""}`;
  }

  return "ไม่พบประวัติซื้อที่ตรงกับลูกค้าและสินค้านี้";
}

export async function approveBill(
  actor: BillActor,
  billId: string,
  options: { overrideReason?: string } = {},
) {
  assertAdmin(actor);

  return prisma.$transaction(async (tx) => {
    await lockInventoryKey(tx, `bill:${billId}`);
    const bill = await tx.bill.findUnique({
      where: { id: billId },
      select: {
        id: true,
        billNumber: true,
        status: true,
        customerId: true,
        stockDeductedAt: true,
        billType: {
          select: {
            requiresRepairDetail: true,
            requiresWarrantyCheck: true,
          },
        },
        repairDetail: { select: { reportedSymptoms: true } },
        items: {
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            productId: true,
            quantity: true,
            description: true,
            warrantyMonths: true,
            serials: {
              select: { id: true, productSerialId: true },
            },
            product: {
              select: {
                id: true,
                sku: true,
                name: true,
                stockQty: true,
                costPrice: true,
                warrantyMonths: true,
                trackSerial: true,
                isActive: true,
                deletedAt: true,
              },
            },
          },
        },
      },
    });

    if (!bill) {
      throw new BillError("NOT_FOUND", "ไม่พบบิลนี้");
    }

    if (bill.status !== "PENDING_APPROVAL") {
      throw new BillError(
        "INVALID_STATUS",
        "อนุมัติได้เฉพาะบิลที่รออนุมัติเท่านั้น",
      );
    }

    if (bill.items.length === 0) {
      throw new BillError("EMPTY_ITEMS", "บิลนี้ไม่มีรายการให้อนุมัติ");
    }

    if (
      bill.billType.requiresRepairDetail &&
      (!bill.repairDetail?.reportedSymptoms.trim() ||
        bill.repairDetail.reportedSymptoms.trim().length < 3)
    ) {
      throw new BillError(
        "REPAIR_DETAIL_REQUIRED",
        "บิลซ่อมยังไม่มีข้อมูลอาการเสีย กรุณาตีกลับให้ช่างแก้ไข",
      );
    }

    if (bill.billType.requiresWarrantyCheck) {
      const claim = await tx.billWarrantyClaim.findUnique({
        where: { billId: bill.id },
        select: { id: true, productId: true, productSerialId: true },
      });

      if (!claim) {
        throw new BillError(
          "WARRANTY_CLAIM_REQUIRED",
          "บิลเคลมไม่มีข้อมูลสินค้าที่ต้องการเคลม",
        );
      }

      await assertNoDuplicateWarrantyClaim(tx, bill.id, bill.customerId, {
        productId: claim.productId,
        productSerialId: claim.productSerialId,
      });

      const check = await refreshWarrantyClaimCheck(tx, bill.id, actor);

      if (check.result !== "FOUND_IN_WARRANTY") {
        const overrideReason = options.overrideReason?.trim();

        if (overrideReason && overrideReason.length >= 3) {
          await tx.billWarrantyClaim.update({
            where: { billId: bill.id },
            data: {
              adminOverrideReason: overrideReason,
              adminOverrideAt: new Date(),
              adminOverrideById: actor.id,
            },
          });
        } else if (!check.adminOverrideReason) {
          throw new BillError(
            "WARRANTY_OVERRIDE_REQUIRED",
            `${warrantyResultMessage(check.result, check.originalBillNumber)} กรุณาระบุเหตุผลอนุมัติเป็นกรณีพิเศษอย่างน้อย 3 ตัวอักษร`,
          );
        }
      }
    }

    const products = await validateStockForItems(tx, bill.items, {
      lock: true,
    });
    const now = new Date();

    for (const item of bill.items) {
      if (!item.productId) {
        continue;
      }

      const product = products.get(item.productId);

      if (!product) {
        throw new BillError("PRODUCT_INACTIVE", "ไม่พบสินค้าในบิล");
      }

      const balanceAfter = product.stockQty - item.quantity;
      const warrantyMonths = item.warrantyMonths ?? product.warrantyMonths;
      const warrantyEndAt =
        warrantyMonths > 0 ? addMonths(now, warrantyMonths) : null;

      await tx.billItem.update({
        where: { id: item.id },
        data: { unitCost: product.costPrice },
      });

      await tx.product.update({
        where: { id: product.id },
        data: { stockQty: balanceAfter },
      });

      product.stockQty = balanceAfter;

      if (product.trackSerial) {
        const serialIds = item.serials.map(
          (serial) => serial.productSerialId,
        );
        const sold = await tx.productSerial.updateMany({
          where: { id: { in: serialIds }, status: "IN_STOCK" },
          data: {
            status: "SOLD",
            soldAt: now,
            warrantyStartAt: now,
            warrantyEndAt,
          },
        });

        if (sold.count !== item.quantity) {
          throw new BillError(
            "SERIAL_NOT_AVAILABLE",
            "Serial บางรายการถูกใช้งานระหว่างการอนุมัติ กรุณาตรวจสอบอีกครั้ง",
          );
        }

        await tx.billItemSerial.updateMany({
          where: { billItemId: item.id },
          data: { warrantyStartAt: now, warrantyEndAt },
        });
      }

      await tx.stockMovement.create({
        data: {
          productId: product.id,
          billId: bill.id,
          billItemId: item.id,
          type: "SALE",
          quantityDelta: -item.quantity,
          unitCost: product.costPrice,
          balanceAfter,
          note: `ตัดสต๊อกบิล ${bill.billNumber}`,
          createdById: actor.id,
        },
      });
    }

    await createCommissionEntryForApprovedBill(tx, {
      billId: bill.id,
      actorId: actor.id,
      approvedAt: now,
    });

    if (bill.billType.requiresWarrantyCheck) {
      const claim = await tx.billWarrantyClaim.findUnique({
        where: { billId: bill.id },
        select: { productSerialId: true },
      });

      if (claim?.productSerialId) {
        await tx.productSerial.update({
          where: { id: claim.productSerialId },
          data: { status: "CLAIMED" },
        });
      }
    }

    await tx.bill.update({
      where: { id: bill.id },
      data: {
        status: "APPROVED",
        approvedAt: now,
        approvedById: actor.id,
        stockDeductedAt: now,
      },
    });

    await tx.billStatusHistory.create({
      data: {
        billId: bill.id,
        fromStatus: "PENDING_APPROVAL",
        toStatus: "APPROVED",
        reason: "อนุมัติบิลและตัดสต๊อก",
        changedById: actor.id,
        createdById: actor.id,
      },
    });

    await writeAuditLog(
      {
        actorId: actor.id,
        action: "BILL_APPROVED",
        entityType: "Bill",
        entityId: bill.id,
        before: { status: "PENDING_APPROVAL" },
        after: {
          status: "APPROVED",
          stockDeductedAt: now.toISOString(),
        },
        metadata: { billNumber: bill.billNumber },
      },
      tx,
    );

    return { id: bill.id };
  });
}

export async function rejectBill(
  actor: BillActor,
  billId: string,
  reason: string,
) {
  assertAdmin(actor);

  return prisma.$transaction(async (tx) => {
    await lockInventoryKey(tx, `bill:${billId}`);
    const bill = await tx.bill.findUnique({
      where: { id: billId },
      select: { id: true, billNumber: true, status: true },
    });

    if (!bill) {
      throw new BillError("NOT_FOUND", "ไม่พบบิลนี้");
    }

    if (bill.status !== "PENDING_APPROVAL") {
      throw new BillError(
        "INVALID_STATUS",
        "ตีกลับได้เฉพาะบิลที่รออนุมัติเท่านั้น",
      );
    }

    const now = new Date();
    await tx.bill.update({
      where: { id: bill.id },
      data: {
        status: "REJECTED",
        rejectionReason: reason.trim(),
        rejectedAt: now,
        rejectedById: actor.id,
      },
    });

    await tx.billStatusHistory.create({
      data: {
        billId: bill.id,
        fromStatus: "PENDING_APPROVAL",
        toStatus: "REJECTED",
        reason: reason.trim(),
        changedById: actor.id,
        createdById: actor.id,
      },
    });

    await writeAuditLog(
      {
        actorId: actor.id,
        action: "BILL_REJECTED",
        entityType: "Bill",
        entityId: bill.id,
        before: { status: "PENDING_APPROVAL" },
        after: { status: "REJECTED", reason: reason.trim() },
        metadata: { billNumber: bill.billNumber },
      },
      tx,
    );

    return { id: bill.id };
  });
}

export async function markBillPaid(
  actor: BillActor,
  billId: string,
  paymentMethod: PaymentMethod,
) {
  assertAdmin(actor);

  return prisma.$transaction(async (tx) => {
    await lockInventoryKey(tx, `bill:${billId}`);
    const bill = await tx.bill.findUnique({
      where: { id: billId },
      select: { id: true, billNumber: true, status: true },
    });

    if (!bill) {
      throw new BillError("NOT_FOUND", "ไม่พบบิลนี้");
    }

    if (bill.status !== "APPROVED") {
      throw new BillError(
        "INVALID_STATUS",
        "บันทึกชำระเงินได้เฉพาะบิลที่อนุมัติแล้วเท่านั้น",
      );
    }

    const now = new Date();
    await tx.bill.update({
      where: { id: bill.id },
      data: {
        status: "PAID",
        paymentMethod,
        paidAt: now,
        paidById: actor.id,
      },
    });

    await tx.billStatusHistory.create({
      data: {
        billId: bill.id,
        fromStatus: "APPROVED",
        toStatus: "PAID",
        reason: "บันทึกการชำระเงิน",
        changedById: actor.id,
        createdById: actor.id,
      },
    });

    await writeAuditLog(
      {
        actorId: actor.id,
        action: "BILL_PAID",
        entityType: "Bill",
        entityId: bill.id,
        before: { status: "APPROVED" },
        after: { status: "PAID", paymentMethod },
        metadata: { billNumber: bill.billNumber },
      },
      tx,
    );

    return { id: bill.id };
  });
}

export async function voidBill(
  actor: BillActor,
  billId: string,
  reason: string,
) {
  assertAdmin(actor);

  return prisma.$transaction(async (tx) => {
    await lockInventoryKey(tx, `bill:${billId}`);
    const bill = await tx.bill.findUnique({
      where: { id: billId },
      select: {
        id: true,
        billNumber: true,
        status: true,
        stockDeductedAt: true,
        billType: {
          select: {
            code: true,
            requiresWarrantyCheck: true,
          },
        },
        items: {
          select: {
            id: true,
            productId: true,
            serials: {
              select: { id: true, productSerialId: true },
            },
          },
        },
        stockMovements: {
          where: { type: "SALE" },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            productId: true,
            billItemId: true,
            quantityDelta: true,
            unitCost: true,
          },
        },
      },
    });

    if (!bill) {
      throw new BillError("NOT_FOUND", "ไม่พบบิลนี้");
    }

    if (bill.status !== "APPROVED" && bill.status !== "PAID") {
      throw new BillError(
        "INVALID_STATUS",
        "ยกเลิกได้เฉพาะบิลที่อนุมัติหรือชำระเงินแล้วเท่านั้น",
      );
    }

    const productIds = [
      ...new Set(bill.stockMovements.map((movement) => movement.productId)),
    ].sort();

    for (const productId of productIds) {
      await lockInventoryKey(tx, `stock:${productId}`);
    }

    const products = productIds.length
      ? await tx.product.findMany({
          where: { id: { in: productIds } },
          select: {
            id: true,
            sku: true,
            name: true,
            stockQty: true,
            isActive: true,
            deletedAt: true,
          },
        })
      : [];
    const productMap = new Map(products.map((product) => [product.id, product]));
    const archived = products.filter(
      (product) => !product.isActive || product.deletedAt,
    );

    if (archived.length > 0) {
      throw new BillError(
        "PRODUCT_ARCHIVED",
        "ไม่สามารถคืนสต๊อกได้เพราะมีสินค้าถูกเก็บถาวร กรุณากู้คืนสินค้าก่อนยกเลิกบิล",
        archived.map((product) => `${product.sku} · ${product.name}`),
      );
    }

    const now = new Date();

    for (const movement of bill.stockMovements) {
      const product = productMap.get(movement.productId);

      if (!product) {
        throw new BillError(
          "BOOKKEEPING_ERROR",
          "ไม่พบสินค้าสำหรับคืนสต๊อก",
        );
      }

      const quantityToRestore = Math.abs(movement.quantityDelta);
      const balanceAfter = product.stockQty + quantityToRestore;

      await tx.product.update({
        where: { id: product.id },
        data: { stockQty: balanceAfter },
      });

      product.stockQty = balanceAfter;

      await tx.stockMovement.create({
        data: {
          productId: product.id,
          billId: bill.id,
          billItemId: movement.billItemId,
          sourceMovementId: movement.id,
          type: "VOID_RESTOCK",
          quantityDelta: quantityToRestore,
          unitCost: movement.unitCost,
          balanceAfter,
          note: `คืนสต๊อกจากการยกเลิกบิล ${bill.billNumber}`,
          createdById: actor.id,
        },
      });
    }

    const itemSerialIds = bill.items.flatMap((item) =>
      item.serials.map((serial) => serial.productSerialId),
    );

    if (itemSerialIds.length > 0) {
      const activeClaim = await tx.billWarrantyClaim.findFirst({
        where: {
          productSerialId: { in: itemSerialIds },
          bill: {
            status: { in: ["DRAFT", "PENDING_APPROVAL", "APPROVED", "PAID"] },
          },
        },
        select: {
          bill: { select: { billNumber: true, status: true } },
          productSerial: { select: { serialNumber: true } },
        },
      });

      if (activeClaim) {
        throw new BillError(
          "BILL_HAS_WARRANTY_CLAIM",
          `ไม่สามารถยกเลิกบิลขายได้ เนื่องจาก Serial ${activeClaim.productSerial?.serialNumber ?? ""} มีประวัติเคลมสินค้าในบิล ${activeClaim.bill.billNumber} (${activeClaim.bill.status}) กรุณาตรวจสอบหรือจัดการบิลเคลมก่อน`,
        );
      }

      const serials = await tx.productSerial.findMany({
        where: { id: { in: itemSerialIds } },
        select: { id: true, serialNumber: true, status: true },
      });

      const unavailable = serials.filter(
        (serial) => serial.status !== "SOLD",
      );

      if (unavailable.length > 0) {
        throw new BillError(
          "BOOKKEEPING_ERROR",
          "มี Serial ที่ไม่พร้อมคืนสต๊อก กรุณาตรวจสอบสถานะ Serial",
          unavailable.map((serial) => serial.serialNumber),
        );
      }

      await tx.productSerial.updateMany({
        where: { id: { in: itemSerialIds } },
        data: {
          status: "IN_STOCK",
          soldAt: null,
          warrantyStartAt: null,
          warrantyEndAt: null,
        },
      });

      await tx.billItemSerial.updateMany({
        where: { billItem: { billId: bill.id }, releasedAt: null },
        data: { releasedAt: now },
      });
    }

    if (bill.billType.requiresWarrantyCheck) {
      const claim = await tx.billWarrantyClaim.findUnique({
        where: { billId: bill.id },
        select: { productSerialId: true },
      });

      if (claim?.productSerialId) {
        await tx.productSerial.update({
          where: { id: claim.productSerialId },
          data: { status: "SOLD" },
        });
      }
    }

    const reversedCommissionCount = await reverseCommissionForBill(tx, {
      billId: bill.id,
      actorId: actor.id,
      reason: reason.trim(),
      voidedAt: now,
    });

    await tx.bill.update({
      where: { id: bill.id },
      data: {
        status: "VOIDED",
        voidedAt: now,
        voidedById: actor.id,
        voidReason: reason.trim(),
        stockRestoredAt: now,
      },
    });

    await tx.billStatusHistory.create({
      data: {
        billId: bill.id,
        fromStatus: bill.status,
        toStatus: "VOIDED",
        reason: reason.trim(),
        changedById: actor.id,
        createdById: actor.id,
      },
    });

    await writeAuditLog(
      {
        actorId: actor.id,
        action: "BILL_VOIDED",
        entityType: "Bill",
        entityId: bill.id,
        before: { status: bill.status },
        after: {
          status: "VOIDED",
          reason: reason.trim(),
          stockRestoredAt: now.toISOString(),
          reversedCommissionCount,
        },
        metadata: { billNumber: bill.billNumber },
      },
      tx,
    );

    return { id: bill.id };
  });
}
