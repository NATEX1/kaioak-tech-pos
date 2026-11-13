-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'CONVERTED', 'EXPIRED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'QR';

-- AlterEnum
ALTER TYPE "RepairStatus" ADD VALUE 'WAITING_APPROVAL';

-- DropIndex
DROP INDEX "Customer_name_trgm_idx";

-- DropIndex
DROP INDEX "Product_name_trgm_idx";

-- AlterTable
ALTER TABLE "AppSetting" ADD COLUMN     "bankInfo" TEXT,
ADD COLUMN     "lineId" VARCHAR(100),
ADD COLUMN     "messageTemplates" JSONB,
ADD COLUMN     "promptpayId" VARCHAR(32),
ADD COLUMN     "quoteValidityDays" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN     "repairTerms" TEXT,
ADD COLUMN     "repairWarrantyDays" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "whatsapp" VARCHAR(32);

-- AlterTable
ALTER TABLE "Bill" ADD COLUMN     "changeAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "paymentReference" VARCHAR(120),
ADD COLUMN     "receivedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "BillRepairDetail" ADD COLUMN     "accessories" TEXT,
ADD COLUMN     "depositAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "devicePasscode" VARCHAR(200),
ADD COLUMN     "dueAt" TIMESTAMP(3),
ADD COLUMN     "estimatedCost" DECIMAL(12,2),
ADD COLUMN     "warrantyDays" INTEGER NOT NULL DEFAULT 30;

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "isWalkIn" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lineId" VARCHAR(100),
ADD COLUMN     "whatsapp" VARCHAR(32);

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "quoteNumber" VARCHAR(32) NOT NULL,
    "customerId" TEXT NOT NULL,
    "createdById" TEXT,
    "status" "QuoteStatus" NOT NULL DEFAULT 'DRAFT',
    "validUntil" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discountType" "DiscountType",
    "discountValue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "netAmountBeforeVat" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "vatEnabled" BOOLEAN NOT NULL DEFAULT false,
    "vatIncluded" BOOLEAN NOT NULL DEFAULT true,
    "vatRate" DECIMAL(5,2) NOT NULL DEFAULT 7,
    "vatAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "grandTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "convertedBillId" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteItem" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "productId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "discountType" "DiscountType",
    "discountValue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "QuoteItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DayClosing" (
    "id" TEXT NOT NULL,
    "dateKey" VARCHAR(10) NOT NULL,
    "totalSales" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "billCount" INTEGER NOT NULL DEFAULT 0,
    "voidCount" INTEGER NOT NULL DEFAULT 0,
    "cashSales" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "transferSales" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "cardSales" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "qrSales" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "repairDeposits" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "expectedCash" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "countedCash" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "difference" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "closedById" TEXT NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "DayClosing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Quote_quoteNumber_key" ON "Quote"("quoteNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_convertedBillId_key" ON "Quote"("convertedBillId");

-- CreateIndex
CREATE INDEX "Quote_customerId_createdAt_idx" ON "Quote"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "Quote_status_validUntil_idx" ON "Quote"("status", "validUntil");

-- CreateIndex
CREATE INDEX "Quote_createdById_createdAt_idx" ON "Quote"("createdById", "createdAt");

-- CreateIndex
CREATE INDEX "Quote_createdAt_idx" ON "Quote"("createdAt");

-- CreateIndex
CREATE INDEX "QuoteItem_quoteId_idx" ON "QuoteItem"("quoteId");

-- CreateIndex
CREATE INDEX "QuoteItem_productId_idx" ON "QuoteItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "DayClosing_dateKey_key" ON "DayClosing"("dateKey");

-- CreateIndex
CREATE INDEX "DayClosing_closedAt_idx" ON "DayClosing"("closedAt");

-- CreateIndex
CREATE INDEX "Customer_isWalkIn_idx" ON "Customer"("isWalkIn");

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_convertedBillId_fkey" FOREIGN KEY ("convertedBillId") REFERENCES "Bill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DayClosing" ADD CONSTRAINT "DayClosing_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
