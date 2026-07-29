-- AlterTable
ALTER TABLE "Production" ALTER COLUMN "budgetSectionOrder" DROP DEFAULT;

-- CreateTable
CREATE TABLE "RolloutPlan" (
    "id" TEXT NOT NULL,
    "magazinePlanId" TEXT NOT NULL,
    "totalPrintRun" INTEGER NOT NULL DEFAULT 0,
    "launchDate" TIMESTAMP(3),
    "warehouseDeadline" TIMESTAMP(3),
    "gbpToUsd" DOUBLE PRECISION NOT NULL DEFAULT 1.30,
    "eastCoastShare" DOUBLE PRECISION NOT NULL DEFAULT 60,
    "assumptions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RolloutPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolloutCover" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "sharePct" DOUBLE PRECISION NOT NULL,
    "isBalancer" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RolloutCover_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoverProfile" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "splits" JSONB NOT NULL DEFAULT '{}',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CoverProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FulfilmentHub" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "serves" TEXT,
    "isDirect" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FulfilmentHub_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolloutChannel" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "units" INTEGER NOT NULL DEFAULT 0,
    "purpose" TEXT,
    "hubId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'B2C',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RolloutChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolloutTerritory" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hubId" TEXT,
    "phase1" INTEGER NOT NULL DEFAULT 0,
    "phase2" INTEGER NOT NULL DEFAULT 0,
    "seedingVip" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RolloutTerritory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Stockist" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "market" TEXT,
    "hubId" TEXT,
    "profileId" TEXT,
    "units" INTEGER NOT NULL DEFAULT 0,
    "contactId" TEXT,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Stockist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolloutEvent" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "hubId" TEXT,
    "units" INTEGER NOT NULL DEFAULT 0,
    "eventDate" TIMESTAMP(3),
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RolloutEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShippingLane" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ratePerOrder" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "volume" INTEGER NOT NULL DEFAULT 0,
    "quoteStatus" TEXT,
    "isBaseline" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ShippingLane_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolloutMilestone" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "window" TEXT,
    "date" TIMESTAMP(3),
    "action" TEXT NOT NULL,
    "owner" TEXT,
    "criticalPath" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "notes" TEXT,

    CONSTRAINT "RolloutMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RolloutPlan_magazinePlanId_key" ON "RolloutPlan"("magazinePlanId");

-- CreateIndex
CREATE INDEX "RolloutCover_planId_idx" ON "RolloutCover"("planId");

-- CreateIndex
CREATE INDEX "CoverProfile_planId_idx" ON "CoverProfile"("planId");

-- CreateIndex
CREATE INDEX "FulfilmentHub_planId_idx" ON "FulfilmentHub"("planId");

-- CreateIndex
CREATE INDEX "RolloutChannel_planId_idx" ON "RolloutChannel"("planId");

-- CreateIndex
CREATE INDEX "RolloutTerritory_planId_idx" ON "RolloutTerritory"("planId");

-- CreateIndex
CREATE INDEX "Stockist_planId_idx" ON "Stockist"("planId");

-- CreateIndex
CREATE INDEX "Stockist_contactId_idx" ON "Stockist"("contactId");

-- CreateIndex
CREATE INDEX "RolloutEvent_planId_idx" ON "RolloutEvent"("planId");

-- CreateIndex
CREATE INDEX "ShippingLane_planId_idx" ON "ShippingLane"("planId");

-- CreateIndex
CREATE INDEX "RolloutMilestone_planId_idx" ON "RolloutMilestone"("planId");

-- AddForeignKey
ALTER TABLE "RolloutPlan" ADD CONSTRAINT "RolloutPlan_magazinePlanId_fkey" FOREIGN KEY ("magazinePlanId") REFERENCES "MagazinePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolloutCover" ADD CONSTRAINT "RolloutCover_planId_fkey" FOREIGN KEY ("planId") REFERENCES "RolloutPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoverProfile" ADD CONSTRAINT "CoverProfile_planId_fkey" FOREIGN KEY ("planId") REFERENCES "RolloutPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FulfilmentHub" ADD CONSTRAINT "FulfilmentHub_planId_fkey" FOREIGN KEY ("planId") REFERENCES "RolloutPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolloutChannel" ADD CONSTRAINT "RolloutChannel_planId_fkey" FOREIGN KEY ("planId") REFERENCES "RolloutPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolloutChannel" ADD CONSTRAINT "RolloutChannel_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "FulfilmentHub"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolloutTerritory" ADD CONSTRAINT "RolloutTerritory_planId_fkey" FOREIGN KEY ("planId") REFERENCES "RolloutPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolloutTerritory" ADD CONSTRAINT "RolloutTerritory_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "FulfilmentHub"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stockist" ADD CONSTRAINT "Stockist_planId_fkey" FOREIGN KEY ("planId") REFERENCES "RolloutPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stockist" ADD CONSTRAINT "Stockist_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "FulfilmentHub"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stockist" ADD CONSTRAINT "Stockist_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CoverProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolloutEvent" ADD CONSTRAINT "RolloutEvent_planId_fkey" FOREIGN KEY ("planId") REFERENCES "RolloutPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolloutEvent" ADD CONSTRAINT "RolloutEvent_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "FulfilmentHub"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShippingLane" ADD CONSTRAINT "ShippingLane_planId_fkey" FOREIGN KEY ("planId") REFERENCES "RolloutPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolloutMilestone" ADD CONSTRAINT "RolloutMilestone_planId_fkey" FOREIGN KEY ("planId") REFERENCES "RolloutPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
