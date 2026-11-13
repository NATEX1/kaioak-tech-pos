import "server-only";

import type { PaymentMethod, Role } from "@/generated/prisma/enums";

import {
  BillCalculationError,
  calculateBillTotals,
  calculateLineTotals,
} from "@/lib/bill-calculations";
import { prisma } from "@/lib/db";
import { Decimal } from "@/lib/money";
import { writeAuditLog } from "@/server/audit";
import { BillError } from "@/server/services/bill-error";
import {
  approveBill,
  createBill,
  markBillPaid,
  submitBill,
} from "@/server/services/bills";
import { nextDocumentSequence } from "@/server/services/document-sequences";
import { ensureWalkInCustomer, getWalkInCustomer } from "@/server/services/customers";
import { getBillingSettings } from "@/server/services/billing-options";
import type { BillCreateInput } from "@/server/validators/bills";

export type PosActor = {
  id: string;
  role: Role;
};

export type PosItemInput = {
  kind: "PRODUCT" | "SERVICE";
  productId?: string;
  description?: string;
  quantity: number;
  unitPrice: string;
  discountType?: "PERCENT" | "AMOUNT" | null;
  discountValue?: string;
  serialIds?: string[];
};

export type PosSaleInput = {
  customerId?: string;
  technicianId?: string;
  title?: string;
  note?: string;
  items: PosItemInput[];
  discountType?: "PERCENT" | "AMOUNT" | null;
  discountValue?: string;
  paymentMethod: PaymentMethod;
  receivedAmount?: string;
  changeAmount?: string;
  paymentReference?: string;
};

export type PosQuoteInput = Omit<
  PosSaleInput,
  | "paymentMethod"
  | "receivedAmount"
  | "changeAmount"
  | "paymentReference"
  | "technicianId"
>;

export class PosError extends Error {
  constructor(
    public readonly code:
      | "EMPTY_CART"
      | "TECHNICIAN_REQUIRED"
      | "BILL_TYPE_MISSING"
      | "QUOTE_NOT_FOUND"
      | "QUOTE_STATUS"
      | "QUOTE_SERIAL_REQUIRED"
      | "FORBIDDEN"
      | "PAYMENT_FAILED",
    message: string,
    public readonly billId?: string,
    public readonly quoteId?: string,
  ) {
    super(message);
    this.name = "PosError";
  }
}

export async function getPosData(actor: PosActor) {
  const [products, customers, technicians, settings, walkIn] =
    await Promise.all([
      prisma.product.findMany({
        where: { isActive: true, deletedAt: null },
        orderBy: [{ name: "asc" }, { sku: "asc" }],
        take: 500,
        select: {
          id: true,
          sku: true,
          name: true,
          brand: true,
          model: true,
          salePrice: true,
          stockQty: true,
          warrantyMonths: true,
          trackSerial: true,
          category: { select: { id: true, name: true } },
          barcodes: {
            orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
            select: { barcode: true, isPrimary: true },
          },
          serials: {
            where: { status: "IN_STOCK" },
            orderBy: { serialNumber: "asc" },
            take: 200,
            select: { id: true, serialNumber: true },
          },
        },
      }),
      prisma.customer.findMany({
        where: { isActive: true, deletedAt: null, isWalkIn: false },
        orderBy: { name: "asc" },
        take: 500,
        select: {
          id: true,
          name: true,
          phone: true,
          lineId: true,
          whatsapp: true,
        },
      }),
      actor.role === "ADMIN"
        ? prisma.user.findMany({
            where: { isActive: true, role: "TECHNICIAN" },
            orderBy: { name: "asc" },
            select: { id: true, name: true },
          })
        : Promise.resolve([] as Array<{ id: string; name: string }>),
      getBillingSettings(),
      getWalkInCustomer(),
    ]);

  return {
    products: products.map((product) => ({
      ...product,
      salePrice: product.salePrice.toFixed(2),
      barcodes: product.barcodes.map((barcode) => barcode.barcode),
    })),
    customers,
    technicians,
    settings,
    walkIn,
    isAdmin: actor.role === "ADMIN",
  };
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

function optional(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeItems(items: PosItemInput[]) {
  return items.map((item) => ({
    kind: item.kind,
    productId: item.kind === "PRODUCT" ? item.productId : undefined,
    description: item.kind === "SERVICE" ? item.description : undefined,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    discountType: item.discountType ?? null,
    discountValue: item.discountValue || "0",
    serialIds: item.kind === "PRODUCT" ? (item.serialIds ?? []) : [],
  }));
}

async function resolveCustomerId(
  actor: PosActor,
  customerId?: string,
): Promise<string> {
  if (customerId && customerId !== "walkin") {
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, isActive: true, deletedAt: null },
      select: { id: true },
    });

    if (!customer) {
      throw new PosError("BILL_TYPE_MISSING", "ไม่พบลูกค้าที่เลือก");
    }

    return customer.id;
  }

  const walkIn = await ensureWalkInCustomer(actor.id);
  return walkIn.id;
}

async function resolveTechnicianId(
  actor: PosActor,
  requested?: string,
): Promise<string> {
  if (actor.role === "TECHNICIAN") {
    return actor.id;
  }

  if (requested) {
    const technician = await prisma.user.findFirst({
      where: { id: requested, role: "TECHNICIAN", isActive: true },
      select: { id: true },
    });

    if (technician) {
      return technician.id;
    }
  }

  const first = await prisma.user.findFirst({
    where: { role: "TECHNICIAN", isActive: true },
    orderBy: { name: "asc" },
    select: { id: true },
  });

  if (!first) {
    throw new PosError(
      "TECHNICIAN_REQUIRED",
      "ยังไม่มีช่างเทคนิคที่เปิดใช้งาน กรุณาเพิ่มผู้ใช้ก่อนขาย",
    );
  }

  return first.id;
}

async function resolveBillTypeId(
  items: PosItemInput[],
): Promise<string> {
  const code = items.every((item) => item.kind === "SERVICE")
    ? "SERVICE"
    : "SALE";
  const billType = await prisma.billType.findFirst({
    where: { code, isActive: true },
    select: { id: true },
  });

  if (!billType) {
    throw new PosError(
      "BILL_TYPE_MISSING",
      `ไม่พบประเภทบิล ${code} ที่เปิดใช้งาน`,
    );
  }

  return billType.id;
}

function billInputFromPos(input: {
  billTypeId: string;
  customerId: string;
  technicianId: string;
  title?: string;
  note?: string;
  items: PosItemInput[];
  discountType?: "PERCENT" | "AMOUNT" | null;
  discountValue?: string;
}): BillCreateInput {
  return {
    billTypeId: input.billTypeId,
    customerId: input.customerId,
    technicianId: input.technicianId,
    title: input.title?.trim() || "ขายหน้าร้าน",
    description: undefined,
    note: optional(input.note),
    discountType: input.discountType ?? null,
    discountValue: input.discountValue || "0",
    items: normalizeItems(input.items),
    repair: undefined,
    claim: undefined,
  };
}

export async function createPosSale(
  actor: PosActor,
  input: PosSaleInput,
) {
  if (input.items.length === 0) {
    throw new PosError("EMPTY_CART", "ตะกร้าว่าง กรุณาเพิ่มสินค้าก่อนชำระเงิน");
  }

  const [customerId, technicianId, billTypeId] = await Promise.all([
    resolveCustomerId(actor, input.customerId),
    resolveTechnicianId(actor, input.technicianId),
    resolveBillTypeId(input.items),
  ]);

  let billId: string;

  try {
    const bill = await createBill(
      { id: actor.id, role: actor.role },
      billInputFromPos({
        billTypeId,
        customerId,
        technicianId,
        title: input.title,
        note: input.note,
        items: input.items,
        discountType: input.discountType,
        discountValue: input.discountValue,
      }),
    );
    billId = bill.id;

    await submitBill({ id: actor.id, role: actor.role }, bill.id);

    if (actor.role === "ADMIN") {
      await approveBill({ id: actor.id, role: actor.role }, bill.id);
      await markBillPaid(
        { id: actor.id, role: actor.role },
        bill.id,
        input.paymentMethod,
        {
          receivedAmount: input.receivedAmount,
          changeAmount: input.changeAmount,
          paymentReference: input.paymentReference,
        },
      );
    }
  } catch (error) {
    if (error instanceof BillError) {
      throw new PosError("PAYMENT_FAILED", error.message, billId!);
    }
    throw error;
  }

  const bill = await prisma.bill.findUnique({
    where: { id: billId },
    select: {
      id: true,
      billNumber: true,
      status: true,
      grandTotal: true,
      receivedAmount: true,
      changeAmount: true,
      paidAt: true,
    },
  });

  if (!bill) {
    throw new PosError("PAYMENT_FAILED", "บันทึกบิลแล้วแต่ไม่พบข้อมูลบิล");
  }

  return {
    billId: bill.id,
    billNumber: bill.billNumber,
    status: bill.status,
    grandTotal: bill.grandTotal.toFixed(2),
    receivedAmount: bill.receivedAmount.toFixed(2),
    changeAmount: bill.changeAmount.toFixed(2),
    paidAt: bill.paidAt,
    requiresApproval: bill.status !== "PAID",
  };
}

export async function createPosQuote(
  actor: PosActor,
  input: PosQuoteInput,
) {
  if (input.items.length === 0) {
    throw new PosError("EMPTY_CART", "ตะกร้าว่าง กรุณาเพิ่มสินค้าก่อนออกใบเสนอราคา");
  }

  const customerId = await resolveCustomerId(actor, input.customerId);
  const productIds = [
    ...new Set(
      input.items
        .filter((item) => item.kind === "PRODUCT")
        .map((item) => item.productId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  if (
    input.items.some(
      (item) => item.kind === "PRODUCT" && !item.productId,
    )
  ) {
    throw new PosError("PAYMENT_FAILED", "ไม่พบสินค้าในรายการ");
  }

  if (productIds.length > 0) {
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        isActive: true,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (products.length !== productIds.length) {
      throw new PosError(
        "PAYMENT_FAILED",
        "มีสินค้าที่ถูกปิดใช้งานหรือไม่พบในระบบ",
      );
    }
  }

  const settings = await prisma.appSetting.findUnique({
    where: { id: "main" },
    select: { vatEnabled: true, vatRate: true, vatIncluded: true, quoteValidityDays: true },
  });

  const lines = input.items.map((item) => {
    try {
      const calculation = calculateLineTotals({
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountType: item.discountType ?? null,
        discountValue: item.discountValue || "0",
      });
      return { item, calculation };
    } catch (error) {
      if (error instanceof BillCalculationError) {
        throw new PosError("PAYMENT_FAILED", error.message);
      }
      throw error;
    }
  });

  let totals: ReturnType<typeof calculateBillTotals>;
  try {
    totals = calculateBillTotals({
      lineTotals: lines.map((line) => ({
        lineTotal: line.calculation.lineTotal,
        discountAmount: line.calculation.discountAmount,
      })),
      discountType: input.discountType ?? null,
      discountValue: input.discountValue || "0",
      vatEnabled: settings?.vatEnabled ?? false,
      vatIncluded: settings?.vatIncluded ?? true,
      vatRate: settings?.vatRate?.toString() ?? "7",
    });
  } catch (error) {
    if (error instanceof BillCalculationError) {
      throw new PosError("PAYMENT_FAILED", error.message);
    }
    throw error;
  }

  const validUntil = new Date(
    Date.now() +
      (settings?.quoteValidityDays ?? 7) * 24 * 60 * 60 * 1000,
  );

  return prisma.$transaction(async (tx) => {
    const year = currentBuddhistYear();
    const sequenceKey = `QT-${year}`;
    const running = await nextDocumentSequence(tx, sequenceKey, {
      padding: 6,
      createdById: actor.id,
    });
    const quoteNumber = `${sequenceKey}-${running}`;

    const quote = await tx.quote.create({
      data: {
        quoteNumber,
        customerId,
        createdById: actor.id,
        status: "SENT",
        validUntil,
        note: optional(input.note),
        subtotal: totals.subtotal,
        discountType: input.discountType ?? null,
        discountValue: input.discountType
          ? new Decimal(input.discountValue || "0")
          : new Decimal(0),
        discountAmount: totals.discountAmount,
        netAmountBeforeVat: totals.netAmountBeforeVat,
        vatEnabled: settings?.vatEnabled ?? false,
        vatIncluded: settings?.vatIncluded ?? true,
        vatRate: totals.vatRate,
        vatAmount: totals.vatAmount,
        grandTotal: totals.grandTotal,
        items: {
          create: lines.map(({ item, calculation }, index) => ({
            productId:
              item.kind === "PRODUCT" && item.productId
                ? item.productId
                : null,
            description:
              item.description?.trim() ||
              (item.kind === "PRODUCT" ? "สินค้า" : "ค่าบริการ"),
            quantity: item.quantity,
            unitPrice: new Decimal(item.unitPrice),
            discountType: item.discountType ?? null,
            discountValue: item.discountType
              ? new Decimal(item.discountValue || "0")
              : new Decimal(0),
            discountAmount: calculation.discountAmount,
            lineTotal: calculation.lineTotal,
            sortOrder: index,
            createdById: actor.id,
          })),
        },
      },
      select: {
        id: true,
        quoteNumber: true,
        grandTotal: true,
        validUntil: true,
      },
    });

    await writeAuditLog(
      {
        actorId: actor.id,
        action: "QUOTE_CREATED",
        entityType: "Quote",
        entityId: quote.id,
        after: {
          quoteNumber: quote.quoteNumber,
          customerId,
          grandTotal: quote.grandTotal.toFixed(2),
          validUntil: quote.validUntil.toISOString(),
        },
      },
      tx,
    );

    return {
      quoteId: quote.id,
      quoteNumber: quote.quoteNumber,
      grandTotal: quote.grandTotal.toFixed(2),
      validUntil: quote.validUntil.toISOString(),
    };
  });
}

export async function convertQuoteToBill(
  actor: PosActor,
  quoteId: string,
) {
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    select: {
      id: true,
      quoteNumber: true,
      status: true,
      validUntil: true,
      customerId: true,
      createdById: true,
      note: true,
      discountType: true,
      discountValue: true,
      items: {
        orderBy: { sortOrder: "asc" },
        select: {
          productId: true,
          description: true,
          quantity: true,
          unitPrice: true,
          discountType: true,
          discountValue: true,
          product: { select: { trackSerial: true } },
        },
      },
    },
  });

  if (!quote) {
    throw new PosError("QUOTE_NOT_FOUND", "ไม่พบใบเสนอราคานี้");
  }

  if (actor.role !== "ADMIN" && quote.createdById !== actor.id) {
    throw new PosError(
      "FORBIDDEN",
      "เปิดบิลได้เฉพาะใบเสนอราคาที่ตนเองสร้างเท่านั้น",
    );
  }

  if (
    quote.status === "CONVERTED" ||
    quote.status === "CANCELLED" ||
    quote.status === "EXPIRED"
  ) {
    throw new PosError(
      "QUOTE_STATUS",
      "ใบเสนอราคานี้ถูกเปิดบิล ยกเลิก หรือหมดอายุแล้ว",
      undefined,
      quote.id,
    );
  }

  if (
    quote.status === "SENT" &&
    quote.validUntil.getTime() < Date.now()
  ) {
    throw new PosError(
      "QUOTE_STATUS",
      "ใบเสนอราคานี้หมดอายุแล้ว กรุณาออกใบเสนอราคาใหม่",
      undefined,
      quote.id,
    );
  }

  if (quote.items.some((item) => item.product?.trackSerial)) {
    throw new PosError(
      "QUOTE_SERIAL_REQUIRED",
      "ใบเสนอราคานี้มีสินค้าที่ต้องเลือก Serial กรุณาเปิดบิลใหม่และเลือก Serial ก่อนบันทึก",
      undefined,
      quote.id,
    );
  }

  const technicianId = await resolveTechnicianId(
    actor,
    actor.role === "TECHNICIAN" ? actor.id : quote.createdById ?? undefined,
  );
  const billTypeId = await resolveBillTypeId(
    quote.items.map((item) => ({
      kind: item.productId ? "PRODUCT" : "SERVICE",
      productId: item.productId ?? undefined,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice.toString(),
    })),
  );

  const bill = await createBill(
    { id: actor.id, role: actor.role },
    billInputFromPos({
      billTypeId,
      customerId: quote.customerId,
      technicianId,
      title: `เปิดบิลจากใบเสนอราคา ${quote.quoteNumber}`,
      note: quote.note ?? undefined,
      items: quote.items.map((item) => ({
        kind: item.productId ? "PRODUCT" : "SERVICE",
        productId: item.productId ?? undefined,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toString(),
        discountType: item.discountType,
        discountValue: item.discountValue.toString(),
        serialIds: [],
      })),
      discountType: quote.discountType,
      discountValue: quote.discountValue.toString(),
    }),
  );

  await prisma.quote.update({
    where: { id: quote.id },
    data: {
      status: "CONVERTED",
      convertedBillId: bill.id,
      acceptedAt: new Date(),
    },
  });

  await writeAuditLog({
    actorId: actor.id,
    action: "QUOTE_CONVERTED",
    entityType: "Quote",
    entityId: quote.id,
    after: { status: "CONVERTED", billId: bill.id, billNumber: bill.billNumber },
  });

  return { billId: bill.id, billNumber: bill.billNumber };
}

export async function setQuoteStatus(
  actor: PosActor,
  quoteId: string,
  status: "ACCEPTED" | "CANCELLED" | "EXPIRED",
) {
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    select: { id: true, status: true, validUntil: true, createdById: true },
  });

  if (!quote) {
    throw new PosError("QUOTE_NOT_FOUND", "ไม่พบใบเสนอราคานี้");
  }

  if (actor.role !== "ADMIN" && quote.createdById !== actor.id) {
    throw new PosError(
      "FORBIDDEN",
      "แก้ไขได้เฉพาะใบเสนอราคาที่ตนเองสร้างเท่านั้น",
    );
  }

  if (
    quote.status === "CONVERTED" ||
    quote.status === "CANCELLED" ||
    quote.status === "EXPIRED"
  ) {
    throw new PosError(
      "QUOTE_STATUS",
      "ใบเสนอราคานี้ปิดรายการแล้ว ไม่สามารถเปลี่ยนสถานะได้",
    );
  }

  if (
    status === "ACCEPTED" &&
    quote.status === "SENT" &&
    quote.validUntil.getTime() < Date.now()
  ) {
    throw new PosError(
      "QUOTE_STATUS",
      "ใบเสนอราคานี้หมดอายุแล้ว ไม่สามารถบันทึกว่าตอบรับได้",
    );
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.quote.update({
      where: { id: quote.id },
      data: {
        status,
        acceptedAt: status === "ACCEPTED" ? new Date() : undefined,
        cancelledAt: status === "CANCELLED" ? new Date() : undefined,
      },
      select: { id: true, status: true },
    });

    await writeAuditLog(
      {
        actorId: actor.id,
        action: "QUOTE_STATUS_CHANGED",
        entityType: "Quote",
        entityId: quote.id,
        before: { status: quote.status },
        after: { status },
      },
      tx,
    );

    return updated;
  });
}
