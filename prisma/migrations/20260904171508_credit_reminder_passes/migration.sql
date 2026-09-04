-- CreateTable
CREATE TABLE "CreditReminderPass" (
    "id" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "perHour" INTEGER NOT NULL DEFAULT 60,
    "label" TEXT,
    "ranAt" TIMESTAMP(3),
    "scheduledCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditReminderPass_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CreditReminderPass_dueAt_ranAt_idx" ON "CreditReminderPass"("dueAt", "ranAt");

