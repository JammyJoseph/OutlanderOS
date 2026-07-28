-- E-signature tracking on insertion orders. Additive and all nullable: IOs
-- signed on paper keep working with every column null.
ALTER TABLE "InsertionOrder"
  ADD COLUMN "signatureProvider" TEXT,
  ADD COLUMN "envelopeId" TEXT,
  ADD COLUMN "signatureStatus" TEXT,
  ADD COLUMN "sentToEmail" TEXT,
  ADD COLUMN "viewedAt" TIMESTAMP(3),
  ADD COLUMN "declinedReason" TEXT,
  ADD COLUMN "signedPdfUrl" TEXT,
  ADD COLUMN "lastSyncedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "InsertionOrder_envelopeId_key" ON "InsertionOrder"("envelopeId");
