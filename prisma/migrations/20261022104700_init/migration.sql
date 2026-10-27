-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'TECHNICIAN');

-- CreateEnum
CREATE TYPE "BillStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'PAID', 'VOIDED');

-- CreateEnum
CREATE TYPE "BillItemKind" AS ENUM ('PRODUCT', 'SERVICE');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENT', 'AMOUNT');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'TRANSFER', 'CARD');

-- CreateEnum
CREATE TYPE "RepairStatus" AS ENUM ('RECEIVED', 'INSPECTING', 'WAITING_PARTS', 'REPAIRING', 'COMPLETED', 'DELIVERED');

-- CreateEnum
CREATE TYPE "BarcodeType" AS ENUM ('CODE128', 'EAN13');

-- CreateEnum
CREATE TYPE "SerialStatus" AS ENUM ('IN_STOCK', 'SOLD', 'CLAIMED', 'DISPOSED');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('GOODS_RECEIPT', 'SALE', 'ADJUSTMENT', 'VOID_RESTOCK', 'CLAIM', 'RETURN');

-- CreateEnum
CREATE TYPE "WarrantyCheckResult" AS ENUM ('FOUND_IN_WARRANTY', 'FOUND_OUT_OF_WARRANTY', 'NOT_FOUND');

-- CreateEnum
CREATE TYPE "CommissionRuleType" AS ENUM ('PERCENT_REVENUE', 'PERCENT_PROFIT', 'FIXED_PER_BILL');

-- CreateEnum
CREATE TYPE "CommissionBasis" AS ENUM ('REVENUE', 'PROFIT', 'FIXED');

-- CreateEnum
CREATE TYPE "CommissionEntryKind" AS ENUM ('EARNING', 'REVERSAL');

-- CreateEnum
CREATE TYPE "CommissionEntryStatus" AS ENUM ('PENDING', 'PAID', 'REVERSED');

-- CreateEnum
CREATE TYPE "CommissionPayoutStatus" AS ENUM ('PENDING', 'PAID');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'TECHNICIAN',
    "phone" VARCHAR(32),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "lastLoginAt" TIMESTAMP(3),
    "deactivatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" VARCHAR(32) NOT NULL,
    "email" VARCHAR(254),
    "address" TEXT,
    "taxId" VARCHAR(20),
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "phone" VARCHAR(32),
    "email" VARCHAR(254),
    "address" TEXT,
    "taxId" VARCHAR(20),
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "sku" VARCHAR(64) NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "defaultSupplierId" TEXT,
    "brand" TEXT,
    "model" TEXT,
    "description" TEXT,
    "costPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "salePrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "stockQty" INTEGER NOT NULL DEFAULT 0,
    "reorderLevel" INTEGER NOT NULL DEFAULT 0,
    "warrantyMonths" INTEGER NOT NULL DEFAULT 0,
    "trackSerial" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductBarcode" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "barcode" VARCHAR(64) NOT NULL,
    "type" "BarcodeType" NOT NULL DEFAULT 'CODE128',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "ProductBarcode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductSerial" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "goodsReceiptItemId" TEXT,
    "serialNumber" VARCHAR(128) NOT NULL,
    "status" "SerialStatus" NOT NULL DEFAULT 'IN_STOCK',
    "unitCost" DECIMAL(12,2),
    "soldAt" TIMESTAMP(3),
    "warrantyStartAt" TIMESTAMP(3),
    "warrantyEndAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "ProductSerial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodsReceipt" (
    "id" TEXT NOT NULL,
    "receiptNo" VARCHAR(32) NOT NULL,
    "supplierId" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "GoodsReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodsReceiptItem" (
    "id" TEXT NOT NULL,
    "goodsReceiptId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitCost" DECIMAL(12,2) NOT NULL,
    "lineTotal" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "GoodsReceiptItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "billId" TEXT,
    "billItemId" TEXT,
    "goodsReceiptItemId" TEXT,
    "sourceMovementId" TEXT,
    "type" "StockMovementType" NOT NULL,
    "quantityDelta" INTEGER NOT NULL,
    "unitCost" DECIMAL(12,2),
    "balanceAfter" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillType" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" VARCHAR(12) NOT NULL,
    "requiresRepairDetail" BOOLEAN NOT NULL DEFAULT false,
    "requiresWarrantyCheck" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "BillType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentSequence" (
    "id" TEXT NOT NULL,
    "key" VARCHAR(32) NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "DocumentSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bill" (
    "id" TEXT NOT NULL,
    "billNumber" VARCHAR(32) NOT NULL,
    "billTypeId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "technicianId" TEXT NOT NULL,
    "status" "BillStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "note" TEXT,
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "lineDiscountTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discountType" "DiscountType",
    "discountValue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "netAmountBeforeVat" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "vatEnabled" BOOLEAN NOT NULL DEFAULT false,
    "vatIncluded" BOOLEAN NOT NULL DEFAULT true,
    "vatRate" DECIMAL(5,2) NOT NULL DEFAULT 7,
    "vatAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "grandTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paymentMethod" "PaymentMethod",
    "rejectionReason" TEXT,
    "voidReason" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectedById" TEXT,
    "paidAt" TIMESTAMP(3),
    "paidById" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidedById" TEXT,
    "stockDeductedAt" TIMESTAMP(3),
    "stockRestoredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "Bill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillItem" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "kind" "BillItemKind" NOT NULL,
    "productId" TEXT,
    "description" TEXT NOT NULL,
    "skuSnapshot" VARCHAR(64),
    "barcodeSnapshot" VARCHAR(64),
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "unitCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discountType" "DiscountType",
    "discountValue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "warrantyMonths" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "BillItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillItemSerial" (
    "id" TEXT NOT NULL,
    "billItemId" TEXT NOT NULL,
    "productSerialId" TEXT NOT NULL,
    "warrantyStartAt" TIMESTAMP(3),
    "warrantyEndAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "BillItemSerial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillRepairDetail" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "deviceBrand" TEXT,
    "deviceModel" TEXT,
    "deviceSerial" VARCHAR(128),
    "reportedSymptoms" TEXT NOT NULL,
    "diagnosis" TEXT,
    "resolution" TEXT,
    "repairStatus" "RepairStatus" NOT NULL DEFAULT 'RECEIVED',
    "receivedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "BillRepairDetail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillWarrantyClaim" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "originalBillId" TEXT,
    "originalBillItemId" TEXT,
    "productSerialId" TEXT,
    "checkResult" "WarrantyCheckResult",
    "originalSaleAt" TIMESTAMP(3),
    "warrantyStartAt" TIMESTAMP(3),
    "warrantyEndsAt" TIMESTAMP(3),
    "checkedAt" TIMESTAMP(3),
    "checkedById" TEXT,
    "checkSnapshot" JSONB,
    "adminOverrideReason" TEXT,
    "adminOverrideAt" TIMESTAMP(3),
    "adminOverrideById" TEXT,
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "BillWarrantyClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillStatusHistory" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "fromStatus" "BillStatus",
    "toStatus" "BillStatus" NOT NULL,
    "reason" TEXT,
    "changedById" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "BillStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ruleType" "CommissionRuleType" NOT NULL,
    "value" DECIMAL(12,4) NOT NULL,
    "technicianId" TEXT,
    "billTypeId" TEXT,
    "categoryId" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "CommissionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionEntry" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "billItemId" TEXT,
    "technicianId" TEXT NOT NULL,
    "ruleId" TEXT,
    "kind" "CommissionEntryKind" NOT NULL DEFAULT 'EARNING',
    "basis" "CommissionBasis" NOT NULL,
    "ruleName" TEXT NOT NULL,
    "ruleType" "CommissionRuleType" NOT NULL,
    "ruleSnapshot" JSONB NOT NULL,
    "rateSnapshot" DECIMAL(12,4),
    "baseAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "costAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "commissionAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "CommissionEntryStatus" NOT NULL DEFAULT 'PENDING',
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reversedAt" TIMESTAMP(3),
    "reversalOfId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "CommissionEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionPayout" (
    "id" TEXT NOT NULL,
    "payoutNo" VARCHAR(32) NOT NULL,
    "technicianId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "CommissionPayoutStatus" NOT NULL DEFAULT 'PAID',
    "note" TEXT,
    "paidAt" TIMESTAMP(3),
    "paidById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "CommissionPayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionPayoutItem" (
    "id" TEXT NOT NULL,
    "payoutId" TEXT NOT NULL,
    "commissionEntryId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "CommissionPayoutItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" VARCHAR(100) NOT NULL,
    "entityType" VARCHAR(100) NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ipAddress" VARCHAR(64),
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "id" TEXT NOT NULL DEFAULT 'main',
    "shopName" TEXT NOT NULL DEFAULT 'COMPOS Computer',
    "address" TEXT,
    "phone" VARCHAR(32),
    "email" VARCHAR(254),
    "taxId" VARCHAR(20),
    "vatEnabled" BOOLEAN NOT NULL DEFAULT false,
    "vatRate" DECIMAL(5,2) NOT NULL DEFAULT 7,
    "vatIncluded" BOOLEAN NOT NULL DEFAULT true,
    "receiptFooter" TEXT,
    "logoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimitBucket" (
    "id" TEXT NOT NULL,
    "key" VARCHAR(255) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "blockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_isActive_idx" ON "User"("role", "isActive");

-- CreateIndex
CREATE INDEX "User_isActive_createdAt_idx" ON "User"("isActive", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_phone_key" ON "Customer"("phone");

-- CreateIndex
CREATE INDEX "Customer_name_idx" ON "Customer"("name");

-- CreateIndex
CREATE INDEX "Customer_createdAt_idx" ON "Customer"("createdAt");

-- CreateIndex
CREATE INDEX "Customer_deletedAt_idx" ON "Customer"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Category_code_key" ON "Category"("code");

-- CreateIndex
CREATE INDEX "Category_isActive_idx" ON "Category"("isActive");

-- CreateIndex
CREATE INDEX "Category_name_idx" ON "Category"("name");

-- CreateIndex
CREATE INDEX "Supplier_name_idx" ON "Supplier"("name");

-- CreateIndex
CREATE INDEX "Supplier_isActive_idx" ON "Supplier"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

-- CreateIndex
CREATE INDEX "Product_categoryId_isActive_idx" ON "Product"("categoryId", "isActive");

-- CreateIndex
CREATE INDEX "Product_name_idx" ON "Product"("name");

-- CreateIndex
CREATE INDEX "Product_stockQty_idx" ON "Product"("stockQty");

-- CreateIndex
CREATE INDEX "Product_deletedAt_idx" ON "Product"("deletedAt");

-- CreateIndex
CREATE INDEX "Product_createdAt_idx" ON "Product"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProductBarcode_barcode_key" ON "ProductBarcode"("barcode");

-- CreateIndex
CREATE INDEX "ProductBarcode_productId_idx" ON "ProductBarcode"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductSerial_serialNumber_key" ON "ProductSerial"("serialNumber");

-- CreateIndex
CREATE INDEX "ProductSerial_productId_status_idx" ON "ProductSerial"("productId", "status");

-- CreateIndex
CREATE INDEX "ProductSerial_warrantyEndAt_idx" ON "ProductSerial"("warrantyEndAt");

-- CreateIndex
CREATE INDEX "ProductSerial_createdAt_idx" ON "ProductSerial"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "GoodsReceipt_receiptNo_key" ON "GoodsReceipt"("receiptNo");

-- CreateIndex
CREATE INDEX "GoodsReceipt_supplierId_receivedAt_idx" ON "GoodsReceipt"("supplierId", "receivedAt");

-- CreateIndex
CREATE INDEX "GoodsReceipt_receivedAt_idx" ON "GoodsReceipt"("receivedAt");

-- CreateIndex
CREATE INDEX "GoodsReceiptItem_goodsReceiptId_idx" ON "GoodsReceiptItem"("goodsReceiptId");

-- CreateIndex
CREATE INDEX "GoodsReceiptItem_productId_idx" ON "GoodsReceiptItem"("productId");

-- CreateIndex
CREATE INDEX "StockMovement_productId_createdAt_idx" ON "StockMovement"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_billId_idx" ON "StockMovement"("billId");

-- CreateIndex
CREATE INDEX "StockMovement_type_createdAt_idx" ON "StockMovement"("type", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_createdAt_idx" ON "StockMovement"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BillType_code_key" ON "BillType"("code");

-- CreateIndex
CREATE UNIQUE INDEX "BillType_prefix_key" ON "BillType"("prefix");

-- CreateIndex
CREATE INDEX "BillType_isActive_sortOrder_idx" ON "BillType"("isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentSequence_key_key" ON "DocumentSequence"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Bill_billNumber_key" ON "Bill"("billNumber");

-- CreateIndex
CREATE INDEX "Bill_status_createdAt_idx" ON "Bill"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Bill_technicianId_status_createdAt_idx" ON "Bill"("technicianId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Bill_customerId_createdAt_idx" ON "Bill"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "Bill_billTypeId_createdAt_idx" ON "Bill"("billTypeId", "createdAt");

-- CreateIndex
CREATE INDEX "Bill_approvedAt_idx" ON "Bill"("approvedAt");

-- CreateIndex
CREATE INDEX "Bill_createdAt_idx" ON "Bill"("createdAt");

-- CreateIndex
CREATE INDEX "BillItem_billId_idx" ON "BillItem"("billId");

-- CreateIndex
CREATE INDEX "BillItem_productId_idx" ON "BillItem"("productId");

-- CreateIndex
CREATE INDEX "BillItemSerial_productSerialId_releasedAt_idx" ON "BillItemSerial"("productSerialId", "releasedAt");

-- CreateIndex
CREATE INDEX "BillItemSerial_billItemId_idx" ON "BillItemSerial"("billItemId");

-- CreateIndex
CREATE UNIQUE INDEX "BillItemSerial_billItemId_productSerialId_key" ON "BillItemSerial"("billItemId", "productSerialId");

-- CreateIndex
CREATE UNIQUE INDEX "BillRepairDetail_billId_key" ON "BillRepairDetail"("billId");

-- CreateIndex
CREATE INDEX "BillRepairDetail_repairStatus_updatedAt_idx" ON "BillRepairDetail"("repairStatus", "updatedAt");

-- CreateIndex
CREATE INDEX "BillRepairDetail_deviceSerial_idx" ON "BillRepairDetail"("deviceSerial");

-- CreateIndex
CREATE UNIQUE INDEX "BillWarrantyClaim_billId_key" ON "BillWarrantyClaim"("billId");

-- CreateIndex
CREATE INDEX "BillWarrantyClaim_productId_idx" ON "BillWarrantyClaim"("productId");

-- CreateIndex
CREATE INDEX "BillWarrantyClaim_originalBillId_idx" ON "BillWarrantyClaim"("originalBillId");

-- CreateIndex
CREATE INDEX "BillWarrantyClaim_productSerialId_idx" ON "BillWarrantyClaim"("productSerialId");

-- CreateIndex
CREATE INDEX "BillWarrantyClaim_checkResult_idx" ON "BillWarrantyClaim"("checkResult");

-- CreateIndex
CREATE INDEX "BillStatusHistory_billId_changedAt_idx" ON "BillStatusHistory"("billId", "changedAt");

-- CreateIndex
CREATE INDEX "BillStatusHistory_changedById_changedAt_idx" ON "BillStatusHistory"("changedById", "changedAt");

-- CreateIndex
CREATE INDEX "CommissionRule_isActive_effectiveFrom_effectiveTo_idx" ON "CommissionRule"("isActive", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE INDEX "CommissionRule_technicianId_idx" ON "CommissionRule"("technicianId");

-- CreateIndex
CREATE INDEX "CommissionRule_billTypeId_idx" ON "CommissionRule"("billTypeId");

-- CreateIndex
CREATE INDEX "CommissionRule_categoryId_idx" ON "CommissionRule"("categoryId");

-- CreateIndex
CREATE INDEX "CommissionRule_priority_idx" ON "CommissionRule"("priority");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionEntry_reversalOfId_key" ON "CommissionEntry"("reversalOfId");

-- CreateIndex
CREATE INDEX "CommissionEntry_technicianId_status_earnedAt_idx" ON "CommissionEntry"("technicianId", "status", "earnedAt");

-- CreateIndex
CREATE INDEX "CommissionEntry_billId_idx" ON "CommissionEntry"("billId");

-- CreateIndex
CREATE INDEX "CommissionEntry_billItemId_idx" ON "CommissionEntry"("billItemId");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionPayout_payoutNo_key" ON "CommissionPayout"("payoutNo");

-- CreateIndex
CREATE INDEX "CommissionPayout_technicianId_paidAt_idx" ON "CommissionPayout"("technicianId", "paidAt");

-- CreateIndex
CREATE INDEX "CommissionPayout_paidAt_idx" ON "CommissionPayout"("paidAt");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionPayoutItem_commissionEntryId_key" ON "CommissionPayoutItem"("commissionEntryId");

-- CreateIndex
CREATE INDEX "CommissionPayoutItem_payoutId_idx" ON "CommissionPayoutItem"("payoutId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RateLimitBucket_key_key" ON "RateLimitBucket"("key");

-- CreateIndex
CREATE INDEX "RateLimitBucket_blockedUntil_idx" ON "RateLimitBucket"("blockedUntil");

-- CreateIndex
CREATE INDEX "RateLimitBucket_windowStart_idx" ON "RateLimitBucket"("windowStart");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_defaultSupplierId_fkey" FOREIGN KEY ("defaultSupplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductBarcode" ADD CONSTRAINT "ProductBarcode_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSerial" ADD CONSTRAINT "ProductSerial_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSerial" ADD CONSTRAINT "ProductSerial_goodsReceiptItemId_fkey" FOREIGN KEY ("goodsReceiptItemId") REFERENCES "GoodsReceiptItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptItem" ADD CONSTRAINT "GoodsReceiptItem_goodsReceiptId_fkey" FOREIGN KEY ("goodsReceiptId") REFERENCES "GoodsReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptItem" ADD CONSTRAINT "GoodsReceiptItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_billItemId_fkey" FOREIGN KEY ("billItemId") REFERENCES "BillItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_goodsReceiptItemId_fkey" FOREIGN KEY ("goodsReceiptItemId") REFERENCES "GoodsReceiptItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_sourceMovementId_fkey" FOREIGN KEY ("sourceMovementId") REFERENCES "StockMovement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_billTypeId_fkey" FOREIGN KEY ("billTypeId") REFERENCES "BillType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillItem" ADD CONSTRAINT "BillItem_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillItem" ADD CONSTRAINT "BillItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillItemSerial" ADD CONSTRAINT "BillItemSerial_billItemId_fkey" FOREIGN KEY ("billItemId") REFERENCES "BillItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillItemSerial" ADD CONSTRAINT "BillItemSerial_productSerialId_fkey" FOREIGN KEY ("productSerialId") REFERENCES "ProductSerial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillRepairDetail" ADD CONSTRAINT "BillRepairDetail_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillWarrantyClaim" ADD CONSTRAINT "BillWarrantyClaim_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillWarrantyClaim" ADD CONSTRAINT "BillWarrantyClaim_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillWarrantyClaim" ADD CONSTRAINT "BillWarrantyClaim_originalBillId_fkey" FOREIGN KEY ("originalBillId") REFERENCES "Bill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillWarrantyClaim" ADD CONSTRAINT "BillWarrantyClaim_originalBillItemId_fkey" FOREIGN KEY ("originalBillItemId") REFERENCES "BillItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillWarrantyClaim" ADD CONSTRAINT "BillWarrantyClaim_productSerialId_fkey" FOREIGN KEY ("productSerialId") REFERENCES "ProductSerial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillStatusHistory" ADD CONSTRAINT "BillStatusHistory_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillStatusHistory" ADD CONSTRAINT "BillStatusHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionRule" ADD CONSTRAINT "CommissionRule_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionRule" ADD CONSTRAINT "CommissionRule_billTypeId_fkey" FOREIGN KEY ("billTypeId") REFERENCES "BillType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionRule" ADD CONSTRAINT "CommissionRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionEntry" ADD CONSTRAINT "CommissionEntry_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionEntry" ADD CONSTRAINT "CommissionEntry_billItemId_fkey" FOREIGN KEY ("billItemId") REFERENCES "BillItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionEntry" ADD CONSTRAINT "CommissionEntry_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionEntry" ADD CONSTRAINT "CommissionEntry_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "CommissionRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionEntry" ADD CONSTRAINT "CommissionEntry_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "CommissionEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionPayout" ADD CONSTRAINT "CommissionPayout_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionPayout" ADD CONSTRAINT "CommissionPayout_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionPayoutItem" ADD CONSTRAINT "CommissionPayoutItem_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "CommissionPayout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionPayoutItem" ADD CONSTRAINT "CommissionPayoutItem_commissionEntryId_fkey" FOREIGN KEY ("commissionEntryId") REFERENCES "CommissionEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Manual integrity rules (kept in SQL so they hold outside the application)
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Fast Thai text search for the two main search screens.
CREATE INDEX "Customer_name_trgm_idx" ON "Customer" USING GIN ("name" gin_trgm_ops);
CREATE INDEX "Product_name_trgm_idx" ON "Product" USING GIN ("name" gin_trgm_ops);

-- Exactly one primary barcode per product.
CREATE UNIQUE INDEX "ProductBarcode_primary_per_product_key"
  ON "ProductBarcode" ("productId")
  WHERE "isPrimary" = true;

-- A physical serial may be attached to only one active sale at a time.
-- Voiding releases the row, preserving its sale history without deleting it.
CREATE UNIQUE INDEX "BillItemSerial_active_serial_key"
  ON "BillItemSerial" ("productSerialId")
  WHERE "releasedAt" IS NULL;

ALTER TABLE "User"
  ADD CONSTRAINT "User_email_normalized_check" CHECK ("email" = lower("email")),
  ADD CONSTRAINT "User_email_not_blank_check" CHECK (btrim("email") <> ''),
  ADD CONSTRAINT "User_name_not_blank_check" CHECK (btrim("name") <> '');

ALTER TABLE "Customer"
  ADD CONSTRAINT "Customer_phone_not_blank_check" CHECK (btrim("phone") <> ''),
  ADD CONSTRAINT "Customer_name_not_blank_check" CHECK (btrim("name") <> '');

ALTER TABLE "Category"
  ADD CONSTRAINT "Category_name_not_blank_check" CHECK (btrim("name") <> '');

ALTER TABLE "Supplier"
  ADD CONSTRAINT "Supplier_name_not_blank_check" CHECK (btrim("name") <> '');

ALTER TABLE "Product"
  ADD CONSTRAINT "Product_stock_non_negative_check" CHECK ("stockQty" >= 0),
  ADD CONSTRAINT "Product_cost_non_negative_check" CHECK ("costPrice" >= 0),
  ADD CONSTRAINT "Product_sale_price_non_negative_check" CHECK ("salePrice" >= 0),
  ADD CONSTRAINT "Product_reorder_non_negative_check" CHECK ("reorderLevel" >= 0),
  ADD CONSTRAINT "Product_warranty_non_negative_check" CHECK ("warrantyMonths" >= 0),
  ADD CONSTRAINT "Product_sku_not_blank_check" CHECK (btrim("sku") <> ''),
  ADD CONSTRAINT "Product_name_not_blank_check" CHECK (btrim("name") <> '');

ALTER TABLE "ProductSerial"
  ADD CONSTRAINT "ProductSerial_cost_non_negative_check" CHECK ("unitCost" IS NULL OR "unitCost" >= 0),
  ADD CONSTRAINT "ProductSerial_warranty_dates_check" CHECK (
    "warrantyStartAt" IS NULL
    OR "warrantyEndAt" IS NULL
    OR "warrantyEndAt" >= "warrantyStartAt"
  );

ALTER TABLE "GoodsReceipt"
  ADD CONSTRAINT "GoodsReceipt_total_non_negative_check" CHECK ("totalCost" >= 0);

ALTER TABLE "GoodsReceiptItem"
  ADD CONSTRAINT "GoodsReceiptItem_quantity_positive_check" CHECK ("quantity" > 0),
  ADD CONSTRAINT "GoodsReceiptItem_cost_non_negative_check" CHECK ("unitCost" >= 0),
  ADD CONSTRAINT "GoodsReceiptItem_total_consistent_check" CHECK ("lineTotal" = ("quantity" * "unitCost"));

ALTER TABLE "StockMovement"
  ADD CONSTRAINT "StockMovement_delta_non_zero_check" CHECK ("quantityDelta" <> 0),
  ADD CONSTRAINT "StockMovement_balance_non_negative_check" CHECK ("balanceAfter" >= 0),
  ADD CONSTRAINT "StockMovement_cost_non_negative_check" CHECK ("unitCost" IS NULL OR "unitCost" >= 0);

ALTER TABLE "BillType"
  ADD CONSTRAINT "BillType_prefix_uppercase_check" CHECK ("prefix" = upper("prefix"));

ALTER TABLE "DocumentSequence"
  ADD CONSTRAINT "DocumentSequence_last_number_non_negative_check" CHECK ("lastNumber" >= 0);

ALTER TABLE "Bill"
  ADD CONSTRAINT "Bill_amounts_non_negative_check" CHECK (
    "subtotal" >= 0
    AND "lineDiscountTotal" >= 0
    AND "discountValue" >= 0
    AND "discountAmount" >= 0
    AND "netAmountBeforeVat" >= 0
    AND "vatRate" >= 0
    AND "vatAmount" >= 0
    AND "grandTotal" >= 0
  ),
  ADD CONSTRAINT "Bill_bill_discount_check" CHECK (
    "discountType" IS NULL
    OR "discountType" <> 'PERCENT'
    OR ("discountValue" >= 0 AND "discountValue" <= 100)
  ),
  ADD CONSTRAINT "Bill_discount_not_over_subtotal_check" CHECK ("discountAmount" <= "subtotal"),
  ADD CONSTRAINT "Bill_status_required_fields_check" CHECK (
    ("status" NOT IN ('APPROVED', 'PAID', 'VOIDED') OR "approvedAt" IS NOT NULL)
    AND ("status" <> 'PENDING_APPROVAL' OR "submittedAt" IS NOT NULL)
    AND ("status" <> 'REJECTED' OR ("rejectionReason" IS NOT NULL AND btrim("rejectionReason") <> ''))
    AND ("status" <> 'VOIDED' OR ("voidedAt" IS NOT NULL AND "voidReason" IS NOT NULL AND btrim("voidReason") <> ''))
    AND ("status" <> 'PAID' OR ("paidAt" IS NOT NULL AND "paymentMethod" IS NOT NULL))
  );

ALTER TABLE "BillItem"
  ADD CONSTRAINT "BillItem_quantity_positive_check" CHECK ("quantity" > 0),
  ADD CONSTRAINT "BillItem_prices_non_negative_check" CHECK ("unitPrice" >= 0 AND "unitCost" >= 0),
  ADD CONSTRAINT "BillItem_discount_non_negative_check" CHECK ("discountValue" >= 0 AND "discountAmount" >= 0),
  ADD CONSTRAINT "BillItem_discount_percent_check" CHECK (
    "discountType" IS NULL
    OR "discountType" <> 'PERCENT'
    OR "discountValue" <= 100
  ),
  ADD CONSTRAINT "BillItem_discount_not_over_line_check" CHECK (
    ("quantity" * "unitPrice") >= "discountAmount" AND "lineTotal" >= 0
  ),
  ADD CONSTRAINT "BillItem_warranty_non_negative_check" CHECK (
    "warrantyMonths" IS NULL OR "warrantyMonths" >= 0
  );

ALTER TABLE "BillRepairDetail"
  ADD CONSTRAINT "BillRepairDetail_dates_check" CHECK (
    "completedAt" IS NULL OR "receivedAt" IS NULL OR "completedAt" >= "receivedAt"
  );

ALTER TABLE "BillWarrantyClaim"
  ADD CONSTRAINT "BillWarrantyClaim_dates_check" CHECK (
    "warrantyStartAt" IS NULL
    OR "warrantyEndsAt" IS NULL
    OR "warrantyEndsAt" >= "warrantyStartAt"
  );

ALTER TABLE "CommissionRule"
  ADD CONSTRAINT "CommissionRule_value_non_negative_check" CHECK ("value" >= 0),
  ADD CONSTRAINT "CommissionRule_percent_range_check" CHECK (
    "ruleType" = 'FIXED_PER_BILL' OR "value" <= 100
  ),
  ADD CONSTRAINT "CommissionRule_effective_range_check" CHECK (
    "effectiveTo" IS NULL OR "effectiveTo" >= "effectiveFrom"
  );

ALTER TABLE "CommissionEntry"
  ADD CONSTRAINT "CommissionEntry_base_non_negative_check" CHECK (
    "baseAmount" >= 0 AND "costAmount" >= 0
    AND ("rateSnapshot" IS NULL OR "rateSnapshot" >= 0)
  ),
  ADD CONSTRAINT "CommissionEntry_kind_sign_check" CHECK (
    ("kind" = 'EARNING' AND "commissionAmount" >= 0)
    OR ("kind" = 'REVERSAL' AND "commissionAmount" <= 0)
  );

ALTER TABLE "CommissionPayout"
  ADD CONSTRAINT "CommissionPayout_period_check" CHECK ("periodEnd" >= "periodStart"),
  ADD CONSTRAINT "CommissionPayout_total_non_negative_check" CHECK ("totalAmount" >= 0),
  ADD CONSTRAINT "CommissionPayout_paid_fields_check" CHECK (
    "status" <> 'PAID' OR ("paidAt" IS NOT NULL AND "paidById" IS NOT NULL)
  );

ALTER TABLE "CommissionPayoutItem"
  ADD CONSTRAINT "CommissionPayoutItem_amount_non_negative_check" CHECK ("amount" >= 0);

ALTER TABLE "RateLimitBucket"
  ADD CONSTRAINT "RateLimitBucket_count_non_negative_check" CHECK ("count" >= 0);

