-- AlterTable
ALTER TABLE "InvoiceSubmission" ADD COLUMN     "expectedAmount" DOUBLE PRECISION,
ADD COLUMN     "ioNumber" TEXT,
ADD COLUMN     "productionId" TEXT,
ADD COLUMN     "requestedAt" TIMESTAMP(3),
ADD COLUMN     "requestedById" TEXT,
ADD COLUMN     "submittedAt" TIMESTAMP(3),
ADD COLUMN     "token" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceSubmission_token_key" ON "InvoiceSubmission"("token");

-- AddForeignKey
ALTER TABLE "InvoiceSubmission" ADD CONSTRAINT "InvoiceSubmission_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production"("id") ON DELETE SET NULL ON UPDATE CASCADE;

