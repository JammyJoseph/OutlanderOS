-- Retire the CostEntry mirror.
--
-- Every row in this table was a copy of a production budget line's actual spend,
-- written by syncCostEntry on each budget save. Nothing originated here: on prod
-- all 5 rows carried a budgetLineItemId, and the only writer was that mirror.
--
-- Keeping it forced Finance to arbitrate — `spent = totalCosts > 0 ? totalCosts
-- : prodActuals` — choosing between the mirror and the ledger. Finance now reads
-- the ACTUAL rows directly, so there is nothing to copy and nothing to choose.
--
-- Safety check first: refuse to drop if anything ever entered here that was NOT
-- a mirror, because that data would have no home on the ledger.
DO $$
DECLARE
  orphans BIGINT;
BEGIN
  SELECT COUNT(*) INTO orphans FROM "CostEntry" WHERE "budgetLineItemId" IS NULL;
  IF orphans > 0 THEN
    RAISE EXCEPTION
      'CostEntry holds % row(s) that are not mirrors of a budget line. Migrate them onto CostLine before dropping.', orphans;
  END IF;
END $$;

DROP TABLE "CostEntry";
