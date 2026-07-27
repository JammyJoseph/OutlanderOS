-- Optional strand override for the Projects list.
-- NULL means "derive it" — see src/lib/production-strand.ts.
ALTER TABLE "Production" ADD COLUMN "strand" TEXT;
