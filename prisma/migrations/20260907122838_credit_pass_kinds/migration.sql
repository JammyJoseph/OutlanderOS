-- AlterTable
ALTER TABLE "CreditReminderPass" ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'reminder',
ADD COLUMN     "recipients" TEXT;

