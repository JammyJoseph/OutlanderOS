// Older call sheets stored shoot title, wrap time, talent, and the three note
// fields as a JSON blob inside the `notes` column. The dedicated columns are
// now the source of truth — this shim backfills them at read time so existing
// sheets keep working without a data migration.

interface LegacyNotes {
  shootTitle?: string;
  wrapTime?: string;
  talent?: unknown[];
  general?: string;
  safety?: string;
  parking?: string;
}

export interface CallSheetColumnFields {
  shootTitle: string | null;
  wrapTime: string | null;
  talent: unknown;
  productionNotes: string | null;
  safetyNotes: string | null;
  parkingNotes: string | null;
  notes: string | null;
}

function parseLegacyNotes(raw: string | null): LegacyNotes {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as LegacyNotes) : {};
  } catch {
    return {};
  }
}

// Mutates a copy: any new column that is still null gets its value from the
// legacy notes JSON. Columns that have been written take precedence.
export function applyLegacyNotesShim<T extends CallSheetColumnFields>(sheet: T): T {
  const talentEmpty = !Array.isArray(sheet.talent) || sheet.talent.length === 0;
  const needsShim =
    sheet.shootTitle == null ||
    sheet.wrapTime == null ||
    talentEmpty ||
    sheet.productionNotes == null ||
    sheet.safetyNotes == null ||
    sheet.parkingNotes == null;
  if (!needsShim || !sheet.notes) return sheet;

  const legacy = parseLegacyNotes(sheet.notes);
  return {
    ...sheet,
    shootTitle: sheet.shootTitle ?? legacy.shootTitle ?? null,
    wrapTime: sheet.wrapTime ?? legacy.wrapTime ?? null,
    talent: talentEmpty && Array.isArray(legacy.talent) ? legacy.talent : sheet.talent,
    productionNotes: sheet.productionNotes ?? legacy.general ?? null,
    safetyNotes: sheet.safetyNotes ?? legacy.safety ?? null,
    parkingNotes: sheet.parkingNotes ?? legacy.parking ?? null,
  };
}
