-- AlterTable
ALTER TABLE "RolloutCover" ADD COLUMN     "dropId" TEXT,
ADD COLUMN     "subject" TEXT;

-- AlterTable
ALTER TABLE "RolloutPlan" ADD COLUMN     "b2bFreightPerShipment" DOUBLE PRECISION NOT NULL DEFAULT 45,
ADD COLUMN     "eurToUsd" DOUBLE PRECISION NOT NULL DEFAULT 1.08,
ADD COLUMN     "hubToStoreTransitDays" INTEGER NOT NULL DEFAULT 4,
ADD COLUMN     "lastYearUsRateGbp" DOUBLE PRECISION NOT NULL DEFAULT 33,
ADD COLUMN     "leadTimeWeeks" DOUBLE PRECISION NOT NULL DEFAULT 3,
ADD COLUMN     "printCompleteDate" TIMESTAMP(3),
ADD COLUMN     "promoDaysBeforeDrop1" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "shippingUpliftPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "usHubRunningCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "widerDaysAfterLastDrop" INTEGER NOT NULL DEFAULT 2,
ALTER COLUMN "gbpToUsd" SET DEFAULT 1.27,
ALTER COLUMN "eastCoastShare" SET DEFAULT 55;

-- AlterTable
ALTER TABLE "RolloutTerritory" DROP COLUMN "phase1",
DROP COLUMN "phase2",
ADD COLUMN     "b2cUnits" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ShippingLane" ADD COLUMN     "isPlaceholder" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Stockist" ADD COLUMN     "embargoSignedAt" TIMESTAMP(3),
ADD COLUMN     "embargoStatus" TEXT,
ADD COLUMN     "isReserved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tier" TEXT NOT NULL DEFAULT 'WIDER';

-- CreateTable
CREATE TABLE "RolloutDrop" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "goLiveAt" TIMESTAMP(3) NOT NULL,
    "sharePct" DOUBLE PRECISION NOT NULL,
    "isBalancer" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RolloutDrop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockistWave" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "inStoreByOverride" TIMESTAMP(3),
    "dispatchByOverride" TIMESTAMP(3),
    "isEmbargoed" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "StockistWave_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FulfilmentRateCard" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "hubId" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "orderFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "itemPick" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "runningCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isPlaceholder" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FulfilmentRateCard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RolloutDrop_planId_idx" ON "RolloutDrop"("planId");

-- CreateIndex
CREATE INDEX "StockistWave_planId_idx" ON "StockistWave"("planId");

-- CreateIndex
CREATE INDEX "FulfilmentRateCard_planId_idx" ON "FulfilmentRateCard"("planId");

-- AddForeignKey
ALTER TABLE "RolloutCover" ADD CONSTRAINT "RolloutCover_dropId_fkey" FOREIGN KEY ("dropId") REFERENCES "RolloutDrop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolloutDrop" ADD CONSTRAINT "RolloutDrop_planId_fkey" FOREIGN KEY ("planId") REFERENCES "RolloutPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockistWave" ADD CONSTRAINT "StockistWave_planId_fkey" FOREIGN KEY ("planId") REFERENCES "RolloutPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FulfilmentRateCard" ADD CONSTRAINT "FulfilmentRateCard_planId_fkey" FOREIGN KEY ("planId") REFERENCES "RolloutPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FulfilmentRateCard" ADD CONSTRAINT "FulfilmentRateCard_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "FulfilmentHub"("id") ON DELETE CASCADE ON UPDATE CASCADE;

