-- CreateTable
CREATE TABLE "XeroConnection" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "tenantId" TEXT NOT NULL,
    "tenantName" TEXT NOT NULL,
    "accessTokenEnc" TEXT NOT NULL,
    "refreshTokenEnc" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "scopes" TEXT,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "connectedByUserId" TEXT,
    "connectedByName" TEXT,
    "lastRefreshAt" TIMESTAMP(3),
    "refreshCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "XeroConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XeroSyncState" (
    "entity" TEXT NOT NULL,
    "lastModifiedUtc" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3),
    "lastCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "XeroSyncState_pkey" PRIMARY KEY ("entity")
);

-- CreateTable
CREATE TABLE "XeroSyncRun" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "trigger" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "entities" JSONB,
    "error" TEXT,
    "durationMs" INTEGER,

    CONSTRAINT "XeroSyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XeroAccount" (
    "id" TEXT NOT NULL,
    "xeroAccountId" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "accountClass" TEXT,
    "status" TEXT,
    "description" TEXT,
    "currencyCode" TEXT,
    "reportingCode" TEXT,
    "isBank" BOOLEAN NOT NULL DEFAULT false,
    "balancePence" INTEGER,
    "balanceAsAt" TIMESTAMP(3),
    "updatedDateUtc" TIMESTAMP(3),
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "XeroAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XeroTrackingCategory" (
    "id" TEXT NOT NULL,
    "xeroTrackingCategoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "XeroTrackingCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XeroTrackingOption" (
    "id" TEXT NOT NULL,
    "xeroTrackingOptionId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "XeroTrackingOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XeroContact" (
    "id" TEXT NOT NULL,
    "xeroContactId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emailAddress" TEXT,
    "accountNumber" TEXT,
    "defaultCurrency" TEXT,
    "isSupplier" BOOLEAN NOT NULL DEFAULT false,
    "isCustomer" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT,
    "updatedDateUtc" TIMESTAMP(3),
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "XeroContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XeroInvoice" (
    "id" TEXT NOT NULL,
    "xeroInvoiceId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "invoiceNumber" TEXT,
    "reference" TEXT,
    "status" TEXT NOT NULL,
    "contactXeroId" TEXT,
    "contactName" TEXT NOT NULL DEFAULT '',
    "subTotalPence" INTEGER NOT NULL DEFAULT 0,
    "totalTaxPence" INTEGER NOT NULL DEFAULT 0,
    "totalPence" INTEGER NOT NULL DEFAULT 0,
    "amountDuePence" INTEGER NOT NULL DEFAULT 0,
    "amountPaidPence" INTEGER NOT NULL DEFAULT 0,
    "currencyCode" TEXT NOT NULL DEFAULT 'GBP',
    "currencyRate" DOUBLE PRECISION,
    "date" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "fullyPaidOnDate" TIMESTAMP(3),
    "matchedCostLineId" TEXT,
    "matchedInvoiceSubmissionId" TEXT,
    "updatedDateUtc" TIMESTAMP(3),
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "XeroInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XeroPayment" (
    "id" TEXT NOT NULL,
    "xeroPaymentId" TEXT NOT NULL,
    "invoiceXeroId" TEXT,
    "invoiceNumber" TEXT,
    "contactName" TEXT,
    "amountPence" INTEGER NOT NULL DEFAULT 0,
    "currencyRate" DOUBLE PRECISION,
    "date" TIMESTAMP(3),
    "reference" TEXT,
    "status" TEXT,
    "paymentType" TEXT,
    "updatedDateUtc" TIMESTAMP(3),
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "XeroPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "XeroSyncRun_startedAt_idx" ON "XeroSyncRun"("startedAt");

-- CreateIndex
CREATE INDEX "XeroSyncRun_status_idx" ON "XeroSyncRun"("status");

-- CreateIndex
CREATE UNIQUE INDEX "XeroAccount_xeroAccountId_key" ON "XeroAccount"("xeroAccountId");

-- CreateIndex
CREATE INDEX "XeroAccount_code_idx" ON "XeroAccount"("code");

-- CreateIndex
CREATE INDEX "XeroAccount_type_idx" ON "XeroAccount"("type");

-- CreateIndex
CREATE INDEX "XeroAccount_isBank_idx" ON "XeroAccount"("isBank");

-- CreateIndex
CREATE UNIQUE INDEX "XeroTrackingCategory_xeroTrackingCategoryId_key" ON "XeroTrackingCategory"("xeroTrackingCategoryId");

-- CreateIndex
CREATE UNIQUE INDEX "XeroTrackingOption_xeroTrackingOptionId_key" ON "XeroTrackingOption"("xeroTrackingOptionId");

-- CreateIndex
CREATE INDEX "XeroTrackingOption_categoryId_idx" ON "XeroTrackingOption"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "XeroContact_xeroContactId_key" ON "XeroContact"("xeroContactId");

-- CreateIndex
CREATE INDEX "XeroContact_name_idx" ON "XeroContact"("name");

-- CreateIndex
CREATE INDEX "XeroContact_emailAddress_idx" ON "XeroContact"("emailAddress");

-- CreateIndex
CREATE UNIQUE INDEX "XeroInvoice_xeroInvoiceId_key" ON "XeroInvoice"("xeroInvoiceId");

-- CreateIndex
CREATE INDEX "XeroInvoice_type_status_idx" ON "XeroInvoice"("type", "status");

-- CreateIndex
CREATE INDEX "XeroInvoice_dueDate_idx" ON "XeroInvoice"("dueDate");

-- CreateIndex
CREATE INDEX "XeroInvoice_contactXeroId_idx" ON "XeroInvoice"("contactXeroId");

-- CreateIndex
CREATE INDEX "XeroInvoice_invoiceNumber_idx" ON "XeroInvoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "XeroInvoice_date_idx" ON "XeroInvoice"("date");

-- CreateIndex
CREATE UNIQUE INDEX "XeroPayment_xeroPaymentId_key" ON "XeroPayment"("xeroPaymentId");

-- CreateIndex
CREATE INDEX "XeroPayment_invoiceXeroId_idx" ON "XeroPayment"("invoiceXeroId");

-- CreateIndex
CREATE INDEX "XeroPayment_date_idx" ON "XeroPayment"("date");

-- CreateIndex
CREATE INDEX "XeroPayment_paymentType_idx" ON "XeroPayment"("paymentType");

-- AddForeignKey
ALTER TABLE "XeroTrackingOption" ADD CONSTRAINT "XeroTrackingOption_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "XeroTrackingCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

