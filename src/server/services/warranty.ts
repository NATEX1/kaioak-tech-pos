import "server-only";

import { prisma } from "@/lib/db";
import {
  calculateWarrantyPeriod,
  type WarrantyCalculationResult,
  type WarrantyStatus,
} from "@/lib/warranty-calculations";

export type WarrantyActor = {
  id: string;
  role: "ADMIN" | "TECHNICIAN";
};

export type SerialWarrantyLookupResult = {
  found: boolean;
  serialNumber: string;
  status: "IN_STOCK" | "IN_WARRANTY" | "OUT_OF_WARRANTY" | "NO_WARRANTY" | "NOT_FOUND";
  product: {
    id: string;
    sku: string;
    name: string;
    brand: string | null;
    model: string | null;
    warrantyMonths: number;
    trackSerial: boolean;
  } | null;
  serial: {
    id: string;
    serialNumber: string;
    status: string;
    unitCost: string | null;
  } | null;
  customer: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
  } | null;
  originalBill: {
    id: string;
    billNumber: string;
    date: Date;
    status: string;
  } | null;
  warranty: WarrantyCalculationResult | null;
  claimHistory: Array<{
    id: string;
    billId: string;
    billNumber: string;
    billStatus: string;
    claimedAt: Date;
    checkResult: string | null;
    adminOverrideReason: string | null;
  }>;
  /** True when a technician can see the unit but not the other technician's sale/PII. */
  restricted?: boolean;
};

export type ClaimEligibilityInput = {
  customerId?: string | null;
  productId?: string | null;
  serialNumber?: string | null;
};

export type ClaimEligibilityResult = {
  result: "FOUND_IN_WARRANTY" | "FOUND_OUT_OF_WARRANTY" | "NOT_FOUND";
  originalBill: {
    id: string;
    billNumber: string;
    date: Date;
    status: string;
  } | null;
  originalBillItem: {
    id: string;
    productId: string | null;
  } | null;
  product: {
    id: string;
    sku: string;
    name: string;
    warrantyMonths: number;
  } | null;
  customer: {
    id: string;
    name: string;
    phone: string;
  } | null;
  productSerial: {
    id: string;
    serialNumber: string;
  } | null;
  warrantyStartAt: Date | null;
  warrantyEndsAt: Date | null;
  warrantyMonths: number;
  daysRemaining: number | null;
  daysExpired: number | null;
  message: string;
  requiresAdminOverride: boolean;
  /** True when the purchase belongs to another technician and PII is hidden. */
  restricted?: boolean;
};

export type CustomerPurchasedItem = {
  id: string;
  billId: string;
  billNumber: string;
  billStatus: string;
  purchasedAt: Date;
  productId: string | null;
  productName: string;
  productSku: string | null;
  quantity: number;
  unitPrice: string;
  warrantyMonths: number;
  serialNumbers: string[];
  warrantyStartAt: Date | null;
  warrantyEndsAt: Date | null;
  warrantyStatus: WarrantyStatus;
  daysRemaining: number | null;
  daysExpired: number | null;
};

/**
 * Look up a serial number to inspect its stock, sale, customer, and warranty status.
 * Can be performed without picking a customer first (reverse lookup).
 */
export async function lookupWarrantyBySerial(
  actor: WarrantyActor,
  rawSerialNumber: string,
): Promise<SerialWarrantyLookupResult> {
  const serialNumber = rawSerialNumber.trim();

  if (!serialNumber) {
    return {
      found: false,
      serialNumber: "",
      status: "NOT_FOUND",
      product: null,
      serial: null,
      customer: null,
      originalBill: null,
      warranty: null,
      claimHistory: [],
    };
  }

  const serial = await prisma.productSerial.findUnique({
    where: { serialNumber },
    include: {
      product: {
        select: {
          id: true,
          sku: true,
          name: true,
          brand: true,
          model: true,
          warrantyMonths: true,
          trackSerial: true,
        },
      },
      goodsReceiptItem: {
        select: {
          goodsReceipt: {
            select: { id: true, receiptNo: true, receivedAt: true },
          },
        },
      },
      billItemSerials: {
        where: { releasedAt: null },
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          billItem: {
            include: {
              bill: {
                select: {
                  id: true,
                  billNumber: true,
                  status: true,
                  createdAt: true,
                  approvedAt: true,
                  paidAt: true,
                  technicianId: true,
                  customer: {
                    select: {
                      id: true,
                      name: true,
                      phone: true,
                      email: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
      warrantyClaims: {
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          bill: {
            select: {
              id: true,
              billNumber: true,
              status: true,
              createdAt: true,
            },
          },
        },
      },
    },
  });

  if (!serial) {
    return {
      found: false,
      serialNumber,
      status: "NOT_FOUND",
      product: null,
      serial: null,
      customer: null,
      originalBill: null,
      warranty: null,
      claimHistory: [],
    };
  }

  const activeSale = serial.billItemSerials[0];
  const saleBill = activeSale?.billItem.bill;
  const restricted = Boolean(
    saleBill &&
      actor.role !== "ADMIN" &&
      saleBill.technicianId !== actor.id,
  );
  const isSold = serial.status === "SOLD" && saleBill;
  const saleDate = saleBill
    ? (saleBill.paidAt ?? saleBill.approvedAt ?? saleBill.createdAt)
    : null;

  const warrantyMonths =
    activeSale?.billItem.warrantyMonths ?? serial.product.warrantyMonths;
  const warrantyStart = activeSale?.warrantyStartAt ?? serial.warrantyStartAt ?? saleDate;

  let warrantyResult: WarrantyCalculationResult | null = null;
  let overallStatus: SerialWarrantyLookupResult["status"] = "IN_STOCK";

  if (isSold && saleDate) {
    warrantyResult = calculateWarrantyPeriod(warrantyStart, warrantyMonths);
    overallStatus = warrantyResult.status;
  } else if (serial.status === "IN_STOCK") {
    overallStatus = "IN_STOCK";
  } else {
    overallStatus = "NO_WARRANTY";
  }

  const claimHistory = restricted
    ? []
    : serial.warrantyClaims.map((claim) => ({
        id: claim.id,
        billId: claim.bill.id,
        billNumber: claim.bill.billNumber,
        billStatus: claim.bill.status,
        claimedAt: claim.createdAt,
        checkResult: claim.checkResult,
        adminOverrideReason: claim.adminOverrideReason,
      }));

  return {
    found: true,
    serialNumber: serial.serialNumber,
    status: overallStatus,
    product: {
      id: serial.product.id,
      sku: serial.product.sku,
      name: serial.product.name,
      brand: serial.product.brand,
      model: serial.product.model,
      warrantyMonths: serial.product.warrantyMonths,
      trackSerial: serial.product.trackSerial,
    },
    serial: {
      id: serial.id,
      serialNumber: serial.serialNumber,
      status: serial.status,
      unitCost: actor.role === "ADMIN" ? serial.unitCost?.toString() ?? null : null,
    },
    customer:
      !restricted && saleBill?.customer
        ? {
            id: saleBill.customer.id,
            name: saleBill.customer.name,
            phone: saleBill.customer.phone,
            email: saleBill.customer.email,
          }
        : null,
    originalBill:
      !restricted && saleBill
        ? {
            id: saleBill.id,
            billNumber: saleBill.billNumber,
            date: saleDate!,
            status: saleBill.status,
          }
        : null,
    warranty: warrantyResult,
    claimHistory,
    restricted,
  };
}

/**
 * Check claim eligibility before opening or submitting a warranty claim.
 * Matches customer + product and/or serial number against approved/paid purchase history.
 */
export async function checkClaimEligibility(
  actor: WarrantyActor,
  input: ClaimEligibilityInput,
): Promise<ClaimEligibilityResult> {
  const customerId = input.customerId?.trim() || null;
  const productId = input.productId?.trim() || null;
  const serialNumber = input.serialNumber?.trim() || null;

  // 1. If Serial Number is provided
  if (serialNumber) {
    const serial = await prisma.productSerial.findUnique({
      where: { serialNumber },
      include: {
        product: {
          select: { id: true, sku: true, name: true, warrantyMonths: true },
        },
        billItemSerials: {
          where: {
            releasedAt: null,
            billItem: {
              bill: {
                status: { in: ["APPROVED", "PAID"] },
                ...(customerId ? { customerId } : {}),
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            billItem: {
              include: {
                bill: {
                  select: {
                    id: true,
                    billNumber: true,
                    status: true,
                    createdAt: true,
                    approvedAt: true,
                    paidAt: true,
                    technicianId: true,
                    customer: {
                      select: { id: true, name: true, phone: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!serial) {
      return {
        result: "NOT_FOUND",
        originalBill: null,
        originalBillItem: null,
        product: null,
        customer: null,
        productSerial: null,
        warrantyStartAt: null,
        warrantyEndsAt: null,
        warrantyMonths: 0,
        daysRemaining: null,
        daysExpired: null,
        message: `ไม่พบ Serial ${serialNumber} ในระบบของร้าน`,
        requiresAdminOverride: true,
      };
    }

    // Check product mismatch if productId was explicitly specified
    if (productId && serial.productId !== productId) {
      return {
        result: "NOT_FOUND",
        originalBill: null,
        originalBillItem: null,
        product: serial.product,
        customer: null,
        productSerial: { id: serial.id, serialNumber: serial.serialNumber },
        warrantyStartAt: null,
        warrantyEndsAt: null,
        warrantyMonths: serial.product.warrantyMonths,
        daysRemaining: null,
        daysExpired: null,
        message: `Serial ${serialNumber} เป็นของสินค้า "${serial.product.name}" ไม่ตรงกับสินค้าที่เลือก`,
        requiresAdminOverride: true,
      };
    }

    const activeSale = serial.billItemSerials[0];

    if (!activeSale) {
      return {
        result: "NOT_FOUND",
        originalBill: null,
        originalBillItem: null,
        product: serial.product,
        customer: null,
        productSerial: { id: serial.id, serialNumber: serial.serialNumber },
        warrantyStartAt: null,
        warrantyEndsAt: null,
        warrantyMonths: serial.product.warrantyMonths,
        daysRemaining: null,
        daysExpired: null,
        message: customerId
          ? `ไม่พบประวัติการซื้อ Serial ${serialNumber} จากลูกค้ารายนี้`
          : `Serial ${serialNumber} ยังไม่พบประวัติการขายให้กับลูกค้า`,
        requiresAdminOverride: true,
      };
    }

    const bill = activeSale.billItem.bill;
    const saleDate = bill.paidAt ?? bill.approvedAt ?? bill.createdAt;
    const warrantyMonths =
      activeSale.billItem.warrantyMonths ?? serial.product.warrantyMonths;
    const warrantyStart = activeSale.warrantyStartAt ?? saleDate;
    const period = calculateWarrantyPeriod(warrantyStart, warrantyMonths);

    if (actor.role !== "ADMIN" && bill.technicianId !== actor.id) {
      return {
        result: "NOT_FOUND",
        originalBill: null,
        originalBillItem: null,
        product: serial.product,
        customer: null,
        productSerial: { id: serial.id, serialNumber: serial.serialNumber },
        warrantyStartAt: null,
        warrantyEndsAt: null,
        warrantyMonths,
        daysRemaining: null,
        daysExpired: null,
        message:
          "บิลซื้อของ Serial นี้เป็นของช่างคนอื่น ระบบจึงไม่แสดงประวัติลูกค้าและบิลเดิม กรุณาให้ Admin ตรวจสอบหรือเปิดเคลมแทน",
        requiresAdminOverride: true,
        restricted: true,
      };
    }

    const isEligible = period.isInWarranty;
    const resultStatus: ClaimEligibilityResult["result"] = isEligible
      ? "FOUND_IN_WARRANTY"
      : "FOUND_OUT_OF_WARRANTY";

    const message = isEligible
      ? `พบประวัติการซื้อในบิล ${bill.billNumber} (อยู่ในประกัน เหลืออีก ${period.daysRemaining} วัน)`
      : `พบประวัติการซื้อในบิล ${bill.billNumber} แต่หมดประกันแล้วเมื่อ ${period.warrantyEndsAt?.toLocaleDateString("th-TH")} (หมดไปแล้ว ${period.daysExpired} วัน)`;

    return {
      result: resultStatus,
      originalBill: {
        id: bill.id,
        billNumber: bill.billNumber,
        date: saleDate,
        status: bill.status,
      },
      originalBillItem: {
        id: activeSale.billItem.id,
        productId: activeSale.billItem.productId,
      },
      product: serial.product,
      customer: {
        id: bill.customer.id,
        name: bill.customer.name,
        phone: bill.customer.phone,
      },
      productSerial: {
        id: serial.id,
        serialNumber: serial.serialNumber,
      },
      warrantyStartAt: period.warrantyStartAt,
      warrantyEndsAt: period.warrantyEndsAt,
      warrantyMonths,
      daysRemaining: period.daysRemaining,
      daysExpired: period.daysExpired,
      message,
      requiresAdminOverride: !isEligible,
    };
  }

  // 2. If Serial Number is NOT provided, match by Customer + Product
  if (customerId && productId) {
    const [product, customer, recentPurchase] = await Promise.all([
      prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, sku: true, name: true, warrantyMonths: true },
      }),
      prisma.customer.findUnique({
        where: { id: customerId },
        select: { id: true, name: true, phone: true },
      }),
      prisma.billItem.findFirst({
        where: {
          productId,
          bill: {
            customerId,
            status: { in: ["APPROVED", "PAID"] },
          },
        },
        orderBy: [{ bill: { paidAt: "desc" } }, { createdAt: "desc" }],
        include: {
          bill: {
            select: {
              id: true,
              billNumber: true,
              status: true,
              createdAt: true,
              approvedAt: true,
              paidAt: true,
              technicianId: true,
            },
          },
        },
      }),
    ]);

    if (!product || !customer) {
      return {
        result: "NOT_FOUND",
        originalBill: null,
        originalBillItem: null,
        product: product ?? null,
        customer: customer ?? null,
        productSerial: null,
        warrantyStartAt: null,
        warrantyEndsAt: null,
        warrantyMonths: 0,
        daysRemaining: null,
        daysExpired: null,
        message: "ข้อมูลสินค้าหรือลูกค้าไม่ถูกต้อง",
        requiresAdminOverride: true,
      };
    }

    if (!recentPurchase) {
      return {
        result: "NOT_FOUND",
        originalBill: null,
        originalBillItem: null,
        product,
        customer,
        productSerial: null,
        warrantyStartAt: null,
        warrantyEndsAt: null,
        warrantyMonths: product.warrantyMonths,
        daysRemaining: null,
        daysExpired: null,
        message: `ไม่พบประวัติการซื้อ "${product.name}" ของลูกค้า ${customer.name} จากทางร้าน`,
        requiresAdminOverride: true,
      };
    }

    const bill = recentPurchase.bill;
    const saleDate = bill.paidAt ?? bill.approvedAt ?? bill.createdAt;
    const warrantyMonths = recentPurchase.warrantyMonths ?? product.warrantyMonths;
    const period = calculateWarrantyPeriod(saleDate, warrantyMonths);

    if (actor.role !== "ADMIN" && bill.technicianId !== actor.id) {
      return {
        result: "NOT_FOUND",
        originalBill: null,
        originalBillItem: null,
        product,
        customer,
        productSerial: null,
        warrantyStartAt: null,
        warrantyEndsAt: null,
        warrantyMonths,
        daysRemaining: null,
        daysExpired: null,
        message:
          "ประวัติการซื้อนี้เป็นของช่างคนอื่น ระบบจึงไม่แสดงบิลเดิม กรุณาให้ Admin ตรวจสอบหรือเปิดเคลมแทน",
        requiresAdminOverride: true,
        restricted: true,
      };
    }

    const isEligible = period.isInWarranty;
    const resultStatus: ClaimEligibilityResult["result"] = isEligible
      ? "FOUND_IN_WARRANTY"
      : "FOUND_OUT_OF_WARRANTY";

    const message = isEligible
      ? `พบประวัติการซื้อในบิล ${bill.billNumber} (อยู่ในประกัน เหลืออีก ${period.daysRemaining} วัน)`
      : `พบประวัติการซื้อในบิล ${bill.billNumber} แต่หมดประกันแล้วเมื่อ ${period.warrantyEndsAt?.toLocaleDateString("th-TH")} (หมดไปแล้ว ${period.daysExpired} วัน)`;

    return {
      result: resultStatus,
      originalBill: {
        id: bill.id,
        billNumber: bill.billNumber,
        date: saleDate,
        status: bill.status,
      },
      originalBillItem: {
        id: recentPurchase.id,
        productId: recentPurchase.productId,
      },
      product,
      customer,
      productSerial: null,
      warrantyStartAt: period.warrantyStartAt,
      warrantyEndsAt: period.warrantyEndsAt,
      warrantyMonths,
      daysRemaining: period.daysRemaining,
      daysExpired: period.daysExpired,
      message,
      requiresAdminOverride: !isEligible,
    };
  }

  return {
    result: "NOT_FOUND",
    originalBill: null,
    originalBillItem: null,
    product: null,
    customer: null,
    productSerial: null,
    warrantyStartAt: null,
    warrantyEndsAt: null,
    warrantyMonths: 0,
    daysRemaining: null,
    daysExpired: null,
    message: "กรุณาระบุ Serial หรือเลือกลูกค้าและสินค้าที่ต้องการตรวจสอบ",
    requiresAdminOverride: true,
  };
}

/**
 * Get all purchased items with warranty info for a specific customer.
 */
export async function getCustomerPurchasedProducts(
  actor: WarrantyActor,
  customerId: string,
): Promise<CustomerPurchasedItem[]> {
  const items = await prisma.billItem.findMany({
    where: {
      productId: { not: null },
      bill: {
        customerId,
        status: { in: ["APPROVED", "PAID"] },
        ...(actor.role === "ADMIN" ? {} : { technicianId: actor.id }),
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      product: {
        select: { id: true, name: true, sku: true, warrantyMonths: true },
      },
      serials: {
        where: { releasedAt: null },
        include: {
          productSerial: {
            select: { serialNumber: true },
          },
        },
      },
      bill: {
        select: {
          id: true,
          billNumber: true,
          status: true,
          createdAt: true,
          approvedAt: true,
          paidAt: true,
        },
      },
    },
  });

  return items.map((item) => {
    const saleDate =
      item.bill.paidAt ?? item.bill.approvedAt ?? item.bill.createdAt;
    const warrantyMonths = item.warrantyMonths ?? item.product?.warrantyMonths ?? 0;
    const period = calculateWarrantyPeriod(saleDate, warrantyMonths);

    return {
      id: item.id,
      billId: item.bill.id,
      billNumber: item.bill.billNumber,
      billStatus: item.bill.status,
      purchasedAt: saleDate,
      productId: item.productId,
      productName: item.description || item.product?.name || "สินค้า",
      productSku: item.product?.sku ?? null,
      quantity: item.quantity,
      unitPrice: item.unitPrice.toString(),
      warrantyMonths,
      serialNumbers: item.serials.map((s) => s.productSerial.serialNumber),
      warrantyStartAt: period.warrantyStartAt,
      warrantyEndsAt: period.warrantyEndsAt,
      warrantyStatus: period.status,
      daysRemaining: period.daysRemaining,
      daysExpired: period.daysExpired,
    };
  });
}
