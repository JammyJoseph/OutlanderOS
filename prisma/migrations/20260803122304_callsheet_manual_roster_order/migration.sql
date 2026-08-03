-- AlterTable
ALTER TABLE "CallSheet" ADD COLUMN     "crewManualOrder" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "talentManualOrder" BOOLEAN NOT NULL DEFAULT false;

