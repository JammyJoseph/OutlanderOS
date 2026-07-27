-- Move production budgets onto the cost ledger, then retire BudgetLineItem.
--
-- The data move and the DROP are deliberately in ONE migration. Splitting them
-- creates a window where the deployed code reads the ledger while the data is
-- still in the old table (budgets render empty), and a standalone script can't
-- read BudgetLineItem once the Prisma client no longer models it. As one
-- migration this is atomic and correctly ordered.
--
-- Each BudgetLineItem becomes:
--   • one BUDGET CostLine  (id = 'cl_'  || original id)
--   • one ACTUAL CostLine  (id = 'cla_' || original id) when actual > 0,
--     drawn against the budget row via budgetLineId.
--
-- Deterministic ids keep provenance readable and make the insert naturally
-- idempotent — a re-run collides on the primary key rather than duplicating.

-- 1. Budget rows.
INSERT INTO "CostLine" (
  "id", "kind", "description", "amount", "currency",
  "productionId", "section", "category", "role",
  "quantity", "rate", "vatPercent",
  "invoiceStatus", "invoiceUrl", "poNumber", "invoicedAmount",
  "notes", "sortOrder", "createdAt", "updatedAt", "createdByName"
)
SELECT
  'cl_' || b."id",
  'BUDGET'::"CostKind",
  COALESCE(NULLIF(b."description", ''), b."role", b."category", 'Untitled line'),
  COALESCE(b."budgeted", 0),
  'GBP',
  b."productionId",
  b."section",
  b."category",
  b."role",
  b."quantity",
  b."rate",
  b."vatPercent",
  b."invoiceStatus",
  b."invoiceUrl",
  b."poNumber",
  b."invoicedAmount",
  b."notes",
  b."sortOrder",
  b."createdAt",
  b."updatedAt",
  'BudgetLineItem migration'
FROM "BudgetLineItem" b
ON CONFLICT ("id") DO NOTHING;

-- 2. Actual rows, drawn against the budget row above.
INSERT INTO "CostLine" (
  "id", "kind", "description", "amount", "currency",
  "productionId", "section", "category",
  "budgetLineId", "invoiceStatus", "invoiceUrl", "poNumber",
  "sortOrder", "createdAt", "updatedAt", "createdByName"
)
SELECT
  'cla_' || b."id",
  'ACTUAL'::"CostKind",
  'Recorded actual (production budget)',
  b."actual",
  'GBP',
  b."productionId",
  b."section",
  b."category",
  'cl_' || b."id",
  b."invoiceStatus",
  b."invoiceUrl",
  b."poNumber",
  b."sortOrder",
  b."createdAt",
  b."updatedAt",
  'BudgetLineItem migration'
FROM "BudgetLineItem" b
WHERE COALESCE(b."actual", 0) > 0
ON CONFLICT ("id") DO NOTHING;

-- 3. Fail loudly if anything failed to carry across, rather than dropping the
--    source table on top of a silent shortfall.
DO $$
DECLARE
  src_budget  DOUBLE PRECISION;
  src_actual  DOUBLE PRECISION;
  got_budget  DOUBLE PRECISION;
  got_actual  DOUBLE PRECISION;
BEGIN
  SELECT COALESCE(SUM("budgeted"), 0), COALESCE(SUM("actual"), 0)
    INTO src_budget, src_actual FROM "BudgetLineItem";

  SELECT COALESCE(SUM("amount"), 0) INTO got_budget
    FROM "CostLine" WHERE "id" LIKE 'cl\_%' AND "kind" = 'BUDGET';

  SELECT COALESCE(SUM("amount"), 0) INTO got_actual
    FROM "CostLine" WHERE "id" LIKE 'cla\_%' AND "kind" = 'ACTUAL';

  IF round(src_budget::numeric, 2) <> round(got_budget::numeric, 2) THEN
    RAISE EXCEPTION 'Budget total mismatch: source % vs ledger %', src_budget, got_budget;
  END IF;

  IF round(src_actual::numeric, 2) <> round(got_actual::numeric, 2) THEN
    RAISE EXCEPTION 'Actual total mismatch: source % vs ledger %', src_actual, got_actual;
  END IF;

  RAISE NOTICE 'Migrated % budget / % actual from BudgetLineItem', src_budget, src_actual;
END $$;

-- 4. Retire the table.
ALTER TABLE "BudgetLineItem" DROP CONSTRAINT IF EXISTS "BudgetLineItem_productionId_fkey";
DROP TABLE "BudgetLineItem";
