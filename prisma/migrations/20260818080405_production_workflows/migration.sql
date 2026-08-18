-- CreateTable
CREATE TABLE "ProductionWorkflow" (
    "id" TEXT NOT NULL,
    "productionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "email" TEXT,
    "track" TEXT NOT NULL DEFAULT 'CREW',
    "contactId" TEXT,
    "steps" JSONB NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionWorkflow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductionWorkflow_productionId_idx" ON "ProductionWorkflow"("productionId");

-- AddForeignKey
ALTER TABLE "ProductionWorkflow" ADD CONSTRAINT "ProductionWorkflow_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production"("id") ON DELETE CASCADE ON UPDATE CASCADE;

