-- CreateTable
CREATE TABLE "CreditRequest" (
    "id" TEXT NOT NULL,
    "contactId" TEXT,
    "token" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "instagram" TEXT,
    "email" TEXT,
    "tier" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "sentAt" TIMESTAMP(3),
    "sentTo" TEXT,
    "isTest" BOOLEAN NOT NULL DEFAULT false,
    "emailError" TEXT,
    "openedAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "remindedAt" TIMESTAMP(3),
    "confirmedName" TEXT,
    "confirmedInstagram" TEXT,
    "confirmedEmail" TEXT,
    "address" JSONB,
    "agreementVersion" TEXT,
    "agreementAcceptedAt" TIMESTAMP(3),
    "printConsent" BOOLEAN,
    "declineNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CreditRequest_token_key" ON "CreditRequest"("token");

-- CreateIndex
CREATE INDEX "CreditRequest_status_idx" ON "CreditRequest"("status");

-- CreateIndex
CREATE INDEX "CreditRequest_email_idx" ON "CreditRequest"("email");

-- CreateIndex
CREATE INDEX "CreditRequest_contactId_idx" ON "CreditRequest"("contactId");

-- AddForeignKey
ALTER TABLE "CreditRequest" ADD CONSTRAINT "CreditRequest_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

