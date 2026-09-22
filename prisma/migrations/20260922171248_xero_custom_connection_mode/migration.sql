-- AlterTable
ALTER TABLE "XeroConnection" ADD COLUMN     "mode" TEXT NOT NULL DEFAULT 'AUTH_CODE',
ALTER COLUMN "refreshTokenEnc" DROP NOT NULL;

