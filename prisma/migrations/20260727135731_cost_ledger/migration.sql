/*
  Warnings:

  - You are about to drop the `PrintBudgetLine` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "CostKind" AS ENUM ('BUDGET', 'COMMITTED', 'ACTUAL');

-- DropForeignKey
ALTER TABLE "PrintBudgetLine" DROP CONSTRAINT "PrintBudgetLine_magazinePlanId_fkey";

-- DropForeignKey
ALTER TABLE "PrintBudgetLine" DROP CONSTRAINT "PrintBudgetLine_productionId_fkey";

-- DropTable
DROP TABLE "PrintBudgetLine";

-- CreateTable
CREATE TABLE "CostLine" (
    "id" TEXT NOT NULL,
    "kind" "CostKind" NOT NULL DEFAULT 'BUDGET',
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "accountCode" TEXT,
    "accountName" TEXT,
    "trackingCategory" TEXT,
    "trackingOption" TEXT,
    "magazinePlanId" TEXT,
    "productionId" TEXT,
    "campaignId" TEXT,
    "section" TEXT,
    "budgetLineId" TEXT,
    "invoiceRef" TEXT,
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "createdByName" TEXT,

    CONSTRAINT "CostLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CostLine_magazinePlanId_kind_idx" ON "CostLine"("magazinePlanId", "kind");

-- CreateIndex
CREATE INDEX "CostLine_productionId_kind_idx" ON "CostLine"("productionId", "kind");

-- CreateIndex
CREATE INDEX "CostLine_campaignId_kind_idx" ON "CostLine"("campaignId", "kind");

-- CreateIndex
CREATE INDEX "CostLine_accountCode_idx" ON "CostLine"("accountCode");

-- CreateIndex
CREATE INDEX "CostLine_budgetLineId_idx" ON "CostLine"("budgetLineId");

-- CreateIndex
CREATE INDEX "CostLine_kind_idx" ON "CostLine"("kind");

-- AddForeignKey
ALTER TABLE "CostLine" ADD CONSTRAINT "CostLine_magazinePlanId_fkey" FOREIGN KEY ("magazinePlanId") REFERENCES "MagazinePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostLine" ADD CONSTRAINT "CostLine_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostLine" ADD CONSTRAINT "CostLine_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostLine" ADD CONSTRAINT "CostLine_budgetLineId_fkey" FOREIGN KEY ("budgetLineId") REFERENCES "CostLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
