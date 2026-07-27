-- Per-production budget section ordering. Empty array = house order.
ALTER TABLE "Production" ADD COLUMN "budgetSectionOrder" TEXT[] DEFAULT ARRAY[]::TEXT[];
