-- AlterTable
ALTER TABLE "CostLine" ADD COLUMN     "category" TEXT,
ADD COLUMN     "invoiceStatus" TEXT,
ADD COLUMN     "invoiceUrl" TEXT,
ADD COLUMN     "invoicedAmount" DOUBLE PRECISION,
ADD COLUMN     "poNumber" TEXT,
ADD COLUMN     "quantity" DOUBLE PRECISION,
ADD COLUMN     "rate" DOUBLE PRECISION,
ADD COLUMN     "role" TEXT,
ADD COLUMN     "vatPercent" DOUBLE PRECISION;
