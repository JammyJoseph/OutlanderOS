// ===== Magazine flat plan + line tracker shared model =====
// Imported by both server (API/seed) and client (tracker + flat plan views),
// so it must stay free of server-only imports.

export type PageStatus =
  | "NOT_STARTED"
  | "CONTENT_RECEIVED"
  | "READY_FOR_DESIGN"
  | "IN_DESIGN"
  | "COMPLETE";

export type SectionKey =
  | "Cover"
  | "FOB"
  | "Fashion"
  | "Fashion Shoot"
  | "Cover Talent"
  | "Feature"
  | "Special"
  | "Community"
  | "Advertorial"
  | "Art & Design"
  | "Digital Focus"
  | "Space";

// Paper stock for a signature. Coated = glossy/art paper; uncoated = matte.
export type StockType = "coated" | "uncoated";
export const DEFAULT_STOCK: StockType = "coated";

export interface MagazinePage {
  pageNumber: number;
  section: SectionKey | string;
  feature: string;
  content: string; // Supplied, Editorial, Bespoke Content, Advertorial, etc.
  type: string; // Supplied, Bespoke, Editorial
  photographer: string;
  shootDate: string; // ISO yyyy-mm-dd or ""
  talent: string;
  interviewDate: string;
  editor: string;
  status: PageStatus;
  readyForDesign: boolean;
  inDesign: boolean;
  complete: boolean;
  notes: string;
  colour: string; // section colour, used by flat plan
  // Reference links for this page — Google Drive / Figma / any URL. Edited from
  // the tracker's Assets column; optional so existing/seeded pages stay valid.
  assetLinks?: string[];
  // ── Budget / cross-portal cost tracking (optional, see Print Budget tab) ──
  // These live on the FIRST page of a multi-page feature (the budget "anchor");
  // the Budget tab groups consecutive pages of a feature into a single row.
  campaignId?: string; // linked Commercial deal — revenue auto-fills from its dealValue
  productionId?: string; // linked Production project — production cost auto-fills from its actuals
  revenue?: number; // manual revenue (used when no campaignId is linked)
  productionCost?: number; // manual production cost (used when no productionId is linked)
  printCost?: number; // paper / printing / distribution cost for this feature (always manual)
  // ── Print signature (physical imposition) ──
  // A magazine prints in signatures — blocks of 8 or 16 pages on one folded sheet.
  // Each page records which signature it belongs to and that signature's stock.
  // Both are derived/stamped by groupSignatures + flattenSignatures below, so they
  // stay in lockstep with the page order; optional so legacy/seed pages stay valid.
  signatureIndex?: number; // 0-based signature this page sits in
  stockType?: StockType; // paper stock, inherited from the signature
}

export interface MagazinePlanData {
  id: string;
  issueNumber: number;
  issueName: string;
  totalPages: number;
  pages: MagazinePage[];
  updatedAt: string;
  updatedBy: string | null;
}

// Ordered pipeline. Clicking a status cell advances to the next stage.
export const STATUS_PIPELINE: PageStatus[] = [
  "NOT_STARTED",
  "CONTENT_RECEIVED",
  "READY_FOR_DESIGN",
  "IN_DESIGN",
  "COMPLETE",
];

export const STATUS_LABELS: Record<PageStatus, string> = {
  NOT_STARTED: "Not Started",
  CONTENT_RECEIVED: "Content Received",
  READY_FOR_DESIGN: "Ready for Design",
  IN_DESIGN: "In Design",
  COMPLETE: "Complete",
};

// Pill styling for the dark theme — [text, background, border].
export const STATUS_STYLE: Record<PageStatus, { text: string; bg: string; border: string }> = {
  NOT_STARTED: { text: "#9ca3af", bg: "rgba(156,163,175,0.12)", border: "rgba(156,163,175,0.3)" },
  CONTENT_RECEIVED: { text: "#fbbf24", bg: "rgba(251,191,36,0.14)", border: "rgba(251,191,36,0.35)" },
  READY_FOR_DESIGN: { text: "#60a5fa", bg: "rgba(96,165,250,0.14)", border: "rgba(96,165,250,0.35)" },
  IN_DESIGN: { text: "#c084fc", bg: "rgba(192,132,252,0.14)", border: "rgba(192,132,252,0.35)" },
  COMPLETE: { text: "#34d399", bg: "rgba(52,211,153,0.14)", border: "rgba(52,211,153,0.35)" },
};

// Section colours. `hex` drives the flat-plan card accent + tracker left border.
// Palette matches the SS26 flat-plan screenshots:
//   BLUE Cover · ORANGE FOB · GREY Fashion editorial/Space · GOLD Fashion shoots
//   PURPLE Cover Talent + Features · RED/Coral Special features · GREEN Community
//   + Behind the Craft · LIGHT GREEN Advertorial.
export const SECTIONS: Record<
  SectionKey,
  { label: string; hex: string }
> = {
  Cover: { label: "Cover", hex: "#3b82f6" },
  FOB: { label: "FOB", hex: "#ff8c00" },
  Fashion: { label: "Fashion", hex: "#9ca3af" },
  "Fashion Shoot": { label: "Fashion Shoot", hex: "#eab308" },
  "Cover Talent": { label: "Cover Talent", hex: "#c084fc" },
  Feature: { label: "Feature", hex: "#a78bfa" },
  Special: { label: "Special", hex: "#f87171" },
  Community: { label: "Community", hex: "#34d399" },
  Advertorial: { label: "Advertorial", hex: "#4ade80" },
  "Art & Design": { label: "Art & Design", hex: "#8b5cf6" },
  "Digital Focus": { label: "Digital Focus", hex: "#2dd4bf" },
  Space: { label: "Space", hex: "#6b7280" },
};

export const SECTION_KEYS = Object.keys(SECTIONS) as SectionKey[];

export function sectionColour(section: string): string {
  return (SECTIONS as Record<string, { hex: string }>)[section]?.hex ?? SECTIONS.Space.hex;
}

// Keep the status pipeline and the three booleans consistent. A page is the
// single source of truth: derive the booleans from `status` on every write.
export function syncStatusFlags(page: MagazinePage): MagazinePage {
  const idx = STATUS_PIPELINE.indexOf(page.status);
  return {
    ...page,
    readyForDesign: idx >= STATUS_PIPELINE.indexOf("READY_FOR_DESIGN"),
    inDesign: idx >= STATUS_PIPELINE.indexOf("IN_DESIGN"),
    complete: page.status === "COMPLETE",
  };
}

export function advanceStatus(status: PageStatus): PageStatus {
  const idx = STATUS_PIPELINE.indexOf(status);
  return STATUS_PIPELINE[(idx + 1) % STATUS_PIPELINE.length];
}

export function blankPage(pageNumber: number, section: SectionKey = "Space"): MagazinePage {
  return syncStatusFlags({
    pageNumber,
    section,
    feature: "",
    content: "",
    type: "",
    photographer: "",
    shootDate: "",
    talent: "",
    interviewDate: "",
    editor: "",
    status: "NOT_STARTED",
    readyForDesign: false,
    inDesign: false,
    complete: false,
    notes: "",
    colour: sectionColour(section),
  });
}

// ===== Signatures (physical print imposition) =====
// A signature is a consecutive block of pages printed on one sheet. We keep the
// canonical state as a FLAT page array (so the tracker, budget and save path stay
// unchanged) and derive signature groups on demand. `groupSignatures` reads each
// page's stored `signatureIndex`; legacy/seed pages that predate signatures are
// auto-chunked into 16-page signatures (the magazine standard, tail kept as-is).

export interface MagazineSignature {
  signatureIndex: number; // 0-based, sequential
  startIndex: number; // index of this signature's first page in the flat array
  pageCount: number; // 8 or 16 in normal use, but any count is rendered honestly
  stockType: StockType;
  pages: MagazinePage[];
}

export function groupSignatures(pages: MagazinePage[]): MagazineSignature[] {
  const raw: { idx: number; startIndex: number; stockType: StockType; pages: MagazinePage[] }[] = [];
  const hasIdx = pages.some((p) => typeof p.signatureIndex === "number");

  if (hasIdx) {
    // Group consecutive pages sharing a signatureIndex (pages always flatten to
    // contiguous runs, so a run boundary is a signature boundary).
    let cur: (typeof raw)[number] | null = null;
    pages.forEach((p, i) => {
      const idx = typeof p.signatureIndex === "number" ? p.signatureIndex : -1;
      if (!cur || cur.idx !== idx) {
        cur = { idx, startIndex: i, stockType: p.stockType ?? DEFAULT_STOCK, pages: [p] };
        raw.push(cur);
      } else {
        cur.pages.push(p);
      }
    });
  } else {
    // Legacy: no signature info yet — fall back to clean 16-page blocks.
    for (let i = 0; i < pages.length; i += 16) {
      const slice = pages.slice(i, i + 16);
      raw.push({ idx: raw.length, startIndex: i, stockType: DEFAULT_STOCK, pages: slice });
    }
  }

  // Re-sequence to 0..n and recompute counts so callers always see clean numbers.
  return raw.map((s, n) => ({
    signatureIndex: n,
    startIndex: s.startIndex,
    pageCount: s.pages.length,
    stockType: s.stockType,
    pages: s.pages,
  }));
}

// Flatten signatures back to the canonical page array, stamping each page with its
// signature index + stock and re-sequencing page numbers. Empty signatures are
// dropped so a signature emptied by page moves doesn't linger as a ghost block.
export function flattenSignatures(signatures: MagazineSignature[]): MagazinePage[] {
  const out: MagazinePage[] = [];
  let sigNo = 0;
  for (const sig of signatures) {
    if (sig.pages.length === 0) continue;
    for (const p of sig.pages) {
      out.push(
        syncStatusFlags({
          ...p,
          pageNumber: out.length + 1,
          signatureIndex: sigNo,
          stockType: sig.stockType,
        })
      );
    }
    sigNo++;
  }
  return out;
}

export interface PlanStats {
  totalPages: number;
  sections: number; // distinct features/entries with content
  contentReceivedPct: number;
  inProgressPct: number;
  completePct: number;
  progressPct: number;
}

// Totals shown at the bottom of the tracker. "Sections" counts rows that carry a
// feature/content entry (not blank Space pages).
export function computeStats(pages: MagazinePage[]): PlanStats {
  const entries = pages.filter((p) => p.feature.trim() || p.content.trim());
  const total = entries.length || 1;
  const received = entries.filter(
    (p) => STATUS_PIPELINE.indexOf(p.status) >= STATUS_PIPELINE.indexOf("CONTENT_RECEIVED")
  ).length;
  const inProgress = entries.filter(
    (p) =>
      STATUS_PIPELINE.indexOf(p.status) >= STATUS_PIPELINE.indexOf("CONTENT_RECEIVED") &&
      p.status !== "COMPLETE"
  ).length;
  const complete = entries.filter((p) => p.status === "COMPLETE").length;
  // Progress = weighted position through the pipeline across all entries.
  const lastIdx = STATUS_PIPELINE.length - 1;
  const progress =
    entries.reduce((sum, p) => sum + STATUS_PIPELINE.indexOf(p.status), 0) /
    (total * lastIdx);
  return {
    totalPages: pages.length,
    sections: entries.length,
    contentReceivedPct: Math.round((received / total) * 100),
    inProgressPct: Math.round((inProgress / total) * 100),
    completePct: Math.round((complete / total) * 100),
    progressPct: Math.round(progress * 100),
  };
}

// High-level issue state for dashboard badges, derived from page stats.
export type IssueState = "Complete" | "In Progress" | "Planning";

export function issueState(stats: PlanStats): IssueState {
  if (stats.sections > 0 && stats.completePct >= 100) return "Complete";
  if (stats.progressPct > 0 || stats.contentReceivedPct > 0) return "In Progress";
  return "Planning";
}

// Clone the page STRUCTURE (sections, page numbers, block layout) of an existing
// issue while wiping every content field back to a fresh, not-started state. Used
// by the "New Issue" action so a new issue inherits the previous flat plan shape.
export function resetPageStructure(pages: MagazinePage[]): MagazinePage[] {
  return pages.map((p, i) =>
    syncStatusFlags({
      pageNumber: i + 1,
      section: p.section,
      feature: "",
      content: "",
      type: "",
      photographer: "",
      shootDate: "",
      talent: "",
      interviewDate: "",
      editor: "",
      status: "NOT_STARTED",
      readyForDesign: false,
      inDesign: false,
      complete: false,
      notes: "",
      colour: sectionColour(p.section),
    })
  );
}

// ===== Seed data — two representative issues =====

// Bump whenever a seed blueprint below changes. Seeded issues store the version
// they were built from; the loader re-seeds any seed issue whose stored version
// is older, so blueprint edits reach already-seeded environments on next load.
export const SEED_VERSION = 2;

interface Segment {
  section: SectionKey;
  feature: string;
  content: string;
  type: string;
  pages: number;
  photographer?: string;
  shootDate?: string;
  talent?: string;
  editor?: string;
  status?: PageStatus;
}

// A believable, FULL run of a real magazine: cover + inside front, a deep FOB
// section, fashion editorials interleaved with brand advertorials, long-form
// features, community/directory pages and back matter. The content fills almost
// the whole book — only a small handful of Space pages (unsold / TBC inventory)
// remain at the end.
// Page-by-page order taken from the SS26 flat-plan screenshots. Reads left→right,
// top→bottom in rows of spreads; section keys are chosen so each block lands on the
// colour shown in the screenshots (see SECTIONS above for the colour legend).
const SEED_SEGMENTS_SS26: Segment[] = [
  // ── Row 1 — Covers (BLUE) + inside-front advertorial + FOB open ──
  { section: "Cover", feature: "FRONT COVER A", content: "Bespoke Content", type: "Bespoke", pages: 1, photographer: "Low Cooper", shootDate: "2026-04-20", talent: "Cover Talent", editor: "Luke", status: "IN_DESIGN" },
  { section: "Cover", feature: "FRONT COVER B", content: "Bespoke Content", type: "Bespoke", pages: 1, photographer: "Low Cooper", shootDate: "2026-04-20", talent: "Cover Talent", editor: "Luke", status: "IN_DESIGN" },
  { section: "Cover", feature: "FRONT COVER C", content: "Bespoke Content", type: "Bespoke", pages: 1, photographer: "Low Cooper", shootDate: "2026-04-20", talent: "Cover Talent", editor: "Luke", status: "IN_DESIGN" },
  { section: "Advertorial", feature: "DIOR — Inside Front", content: "Advertorial", type: "Supplied", pages: 2, status: "CONTENT_RECEIVED" },
  { section: "FOB", feature: "Masthead & Credits", content: "Editorial", type: "Editorial", pages: 1, editor: "Luke", status: "COMPLETE" },
  { section: "FOB", feature: "Contents", content: "Editorial", type: "Editorial", pages: 2, editor: "Luke", status: "READY_FOR_DESIGN" },
  { section: "FOB", feature: "Editor's Letter", content: "Editorial", type: "Editorial", pages: 1, editor: "Luke", status: "READY_FOR_DESIGN" },
  { section: "FOB", feature: "Contributors", content: "Editorial", type: "Editorial", pages: 1, editor: "Luke", status: "CONTENT_RECEIVED" },

  // ── Row 2 — FOB editorial (ORANGE) ──
  { section: "FOB", feature: "Radar — New In", content: "Editorial", type: "Editorial", pages: 4, photographer: "Studio", editor: "Maya", status: "CONTENT_RECEIVED" },
  { section: "FOB", feature: "Object of Desire", content: "Supplied", type: "Supplied", pages: 2, status: "CONTENT_RECEIVED" },
  { section: "FOB", feature: "The Edit — Beauty", content: "Editorial", type: "Editorial", pages: 4, photographer: "Still Life Team", shootDate: "2026-05-02", editor: "Maya", status: "NOT_STARTED" },

  // ── Row 3 — Advertise / Space (GREY) mixed with supplied content ──
  { section: "Advertorial", feature: "SAINT LAURENT — DPS", content: "Advertorial", type: "Supplied", pages: 2, status: "CONTENT_RECEIVED" },
  { section: "Space", feature: "ADVERTISE — Space", content: "Space", type: "Space", pages: 2, status: "NOT_STARTED" },
  { section: "Advertorial", feature: "VERSACE — Full Page", content: "Advertorial", type: "Supplied", pages: 1, status: "CONTENT_RECEIVED" },

  // ── Row 4 — FOB editorial + DIYA (ORANGE) ──
  { section: "FOB", feature: "Trends Report", content: "Editorial", type: "Editorial", pages: 3, editor: "Maya", status: "NOT_STARTED" },
  { section: "FOB", feature: "DIYA — Do It Yourself Atelier", content: "Editorial", type: "Editorial", pages: 4, photographer: "Studio", editor: "Sofia", status: "NOT_STARTED" },
  { section: "FOB", feature: "Style Notes — Column", content: "Editorial", type: "Editorial", pages: 2, editor: "Sofia", status: "NOT_STARTED" },

  // ── Row 5 — Fashion editorial (GREY) — Fashion Bureau Retail ──
  { section: "Fashion", feature: "FASHION BUREAU RETAIL", content: "Bespoke Content", type: "Bespoke", pages: 8, photographer: "Rae Iverson", shootDate: "2026-05-22", talent: "Model TBC", editor: "Luke", status: "CONTENT_RECEIVED" },

  // ── Row 6 — FOB Bureau Retail continuing (ORANGE) ──
  { section: "FOB", feature: "FOB BUREAU RETAIL", content: "Supplied", type: "Supplied", pages: 6, photographer: "Still Life Team", editor: "Maya", status: "NOT_STARTED" },

  // ── Row 7 — Cover Talent spreads (PURPLE) ──
  { section: "Cover Talent", feature: "COVER TALENT — Opening Spread", content: "Bespoke Content", type: "Bespoke", pages: 2, photographer: "Low Cooper", shootDate: "2026-04-20", talent: "Cover Talent", editor: "Luke", status: "IN_DESIGN" },
  { section: "Cover Talent", feature: "COVER TALENT — The Interview", content: "Bespoke Content", type: "Bespoke", pages: 6, photographer: "Low Cooper", shootDate: "2026-04-20", talent: "Cover Talent", editor: "Luke", status: "CONTENT_RECEIVED" },

  // ── Row 8 — Behind the Craft (GREEN) + Outlander feature (PURPLE) + Space ──
  { section: "Community", feature: "BEHIND THE CRAFT — Atelier", content: "Bespoke Content", type: "Bespoke", pages: 6, photographer: "Theo Marsh", shootDate: "2026-05-10", talent: "Atelier Profile", editor: "Sofia", status: "CONTENT_RECEIVED" },
  { section: "Feature", feature: "OUTLANDER — The Long Read", content: "Editorial", type: "Editorial", pages: 4, editor: "Sofia", status: "NOT_STARTED" },
  { section: "Space", feature: "ADVERTISE — Space", content: "Space", type: "Space", pages: 2, status: "NOT_STARTED" },

  // ── Row 9 — Community / editorial (GREEN) ──
  { section: "Advertorial", feature: "GUCCI — DPS", content: "Advertorial", type: "Supplied", pages: 2, status: "NOT_STARTED" },
  { section: "Community", feature: "Community Spotlight", content: "Bespoke Content", type: "Bespoke", pages: 4, talent: "Community Members", editor: "Sofia", status: "NOT_STARTED" },
  { section: "Community", feature: "ASK THE INDUSTRY", content: "Editorial", type: "Editorial", pages: 4, editor: "Maya", status: "NOT_STARTED" },

  // ── Row 10 — Cover Talent portfolio (PURPLE) + community ──
  { section: "Cover Talent", feature: "COVER TALENT — Portfolio", content: "Bespoke Content", type: "Bespoke", pages: 6, photographer: "Low Cooper", talent: "Cover Talent", editor: "Luke", status: "NOT_STARTED" },
  { section: "Community", feature: "Community Voices", content: "Editorial", type: "Editorial", pages: 2, editor: "Maya", status: "NOT_STARTED" },

  // ── Row 11 — Fashion editorial (GREY) + Future Icons + Polaroids (GOLD) ──
  { section: "Advertorial", feature: "PRADA — DPS", content: "Advertorial", type: "Supplied", pages: 2, status: "CONTENT_RECEIVED" },
  { section: "Fashion", feature: "Fashion Editorial — Bloom", content: "Bespoke Content", type: "Bespoke", pages: 8, photographer: "Rae Iverson", shootDate: "2026-05-22", talent: "Model TBC", editor: "Luke", status: "NOT_STARTED" },
  { section: "Fashion Shoot", feature: "FUTURE ICONS", content: "Bespoke Content", type: "Bespoke", pages: 8, photographer: "Low Cooper", shootDate: "2026-05-15", talent: "Future Icons Cast", editor: "Luke", status: "CONTENT_RECEIVED" },
  { section: "Fashion Shoot", feature: "POLAROIDS", content: "Bespoke Content", type: "Bespoke", pages: 4, photographer: "Low Cooper", shootDate: "2026-05-15", talent: "Future Icons Cast", editor: "Luke", status: "NOT_STARTED" },

  // ── Row 12 — Behind the Craft (GREEN) + Outlander feature (PURPLE) ──
  { section: "Advertorial", feature: "VALENTINO — DPS", content: "Advertorial", type: "Supplied", pages: 2, status: "NOT_STARTED" },
  { section: "Community", feature: "BEHIND THE CRAFT — Makers", content: "Bespoke Content", type: "Bespoke", pages: 6, photographer: "Theo Marsh", shootDate: "2026-05-12", talent: "Atelier Profile", editor: "Sofia", status: "NOT_STARTED" },
  { section: "Feature", feature: "OUTLANDER — Cultural Essay", content: "Editorial", type: "Editorial", pages: 4, editor: "Sofia", status: "NOT_STARTED" },

  // ── Row 13 — Special feature (RED/Coral) + Space + community directory ──
  { section: "Special", feature: "SPECIAL — Anniversary Feature", content: "Bespoke Content", type: "Bespoke", pages: 6, photographer: "Low Cooper", talent: "Special Guests", editor: "Luke", status: "NOT_STARTED" },
  { section: "Space", feature: "ADVERTISE — Space", content: "Space", type: "Space", pages: 2, status: "NOT_STARTED" },
  { section: "Community", feature: "OUTLANDER DIRECTORY", content: "Editorial", type: "Editorial", pages: 6, editor: "Maya", status: "NOT_STARTED" },

  // ── Row 14 — Final pages — community, back matter, inside/outside back ──
  { section: "Community", feature: "Reader Pages", content: "Editorial", type: "Editorial", pages: 2, editor: "Maya", status: "NOT_STARTED" },
  { section: "FOB", feature: "Horoscopes", content: "Editorial", type: "Editorial", pages: 2, editor: "Maya", status: "NOT_STARTED" },
  { section: "Community", feature: "Stockists & Credits", content: "Editorial", type: "Editorial", pages: 2, editor: "Luke", status: "NOT_STARTED" },
  { section: "FOB", feature: "Back Page — Last Word", content: "Editorial", type: "Editorial", pages: 1, editor: "Luke", status: "NOT_STARTED" },
  { section: "Advertorial", feature: "CHANEL — Inside Back", content: "Advertorial", type: "Supplied", pages: 1, status: "CONTENT_RECEIVED" },
  { section: "Advertorial", feature: "DIOR — Outside Back", content: "Advertorial", type: "Supplied", pages: 1, status: "CONTENT_RECEIVED" },
];

// Issue 01 "AW25" — the shipped, fully-COMPLETE back issue. Carries the wider
// section palette (Art & Design, Digital Focus) that defined AW25, and like a
// real printed book is filled almost end to end.
const SEED_SEGMENTS_AW25: Segment[] = [
  { section: "Cover", feature: "AW25 COVER", content: "Bespoke Content", type: "Bespoke", pages: 1, photographer: "Low Cooper", shootDate: "2025-08-12", talent: "AW25 Cover Star", editor: "Luke" },
  { section: "Advertorial", feature: "CARTIER — Inside Front", content: "Advertorial", type: "Supplied", pages: 2 },
  { section: "FOB", feature: "Masthead & Credits", content: "Editorial", type: "Editorial", pages: 1, editor: "Luke" },
  { section: "FOB", feature: "Contents", content: "Editorial", type: "Editorial", pages: 3, editor: "Luke" },
  { section: "FOB", feature: "Editor's Letter", content: "Editorial", type: "Editorial", pages: 1, editor: "Luke" },
  { section: "Advertorial", feature: "DIOR — DPS", content: "Advertorial", type: "Supplied", pages: 2 },
  { section: "FOB", feature: "Radar — New Season", content: "Editorial", type: "Editorial", pages: 6, photographer: "Studio", editor: "Maya" },
  { section: "Advertorial", feature: "SAINT LAURENT — DPS", content: "Advertorial", type: "Supplied", pages: 2 },
  { section: "FOB", feature: "Object of Desire", content: "Supplied", type: "Supplied", pages: 2 },
  { section: "FOB", feature: "The Edit — Beauty", content: "Editorial", type: "Editorial", pages: 4, photographer: "Still Life Team", shootDate: "2025-08-20", editor: "Maya" },
  { section: "Advertorial", feature: "TOM FORD — Full Page", content: "Advertorial", type: "Supplied", pages: 1 },
  { section: "FOB", feature: "Trends Report", content: "Editorial", type: "Editorial", pages: 4, editor: "Maya" },
  { section: "FOB", feature: "Five Minutes With…", content: "Bespoke Content", type: "Bespoke", pages: 3, talent: "Industry Guest", editor: "Sofia" },
  { section: "Advertorial", feature: "GUCCI — DPS", content: "Advertorial", type: "Supplied", pages: 2 },
  { section: "Fashion", feature: "Fashion Editorial — Nightfall", content: "Bespoke Content", type: "Bespoke", pages: 12, photographer: "Rae Iverson", shootDate: "2025-08-28", talent: "Lead Model", editor: "Luke" },
  { section: "Advertorial", feature: "PRADA — DPS", content: "Advertorial", type: "Supplied", pages: 2 },
  { section: "Fashion", feature: "Fashion Editorial — Tailored", content: "Bespoke Content", type: "Bespoke", pages: 10, photographer: "Low Cooper", shootDate: "2025-09-04", editor: "Luke" },
  { section: "Fashion", feature: "Accessories Story", content: "Bespoke Content", type: "Bespoke", pages: 6, photographer: "Still Life Team", shootDate: "2025-09-08", editor: "Maya" },
  { section: "Advertorial", feature: "VALENTINO — DPS", content: "Advertorial", type: "Supplied", pages: 2 },
  { section: "Fashion", feature: "Jewellery Story", content: "Bespoke Content", type: "Bespoke", pages: 6, photographer: "Still Life Team", shootDate: "2025-09-10", editor: "Maya" },
  { section: "Feature", feature: "COVER STORY — Interview", content: "Bespoke Content", type: "Bespoke", pages: 8, photographer: "Low Cooper", shootDate: "2025-08-12", talent: "AW25 Cover Star", editor: "Luke" },
  { section: "Feature", feature: "The Long Read — Reinvention", content: "Editorial", type: "Editorial", pages: 6, editor: "Sofia" },
  { section: "Advertorial", feature: "CHANEL — DPS", content: "Advertorial", type: "Supplied", pages: 2 },
  { section: "Feature", feature: "Photo Essay — Northern Light", content: "Bespoke Content", type: "Bespoke", pages: 8, photographer: "Theo Marsh", shootDate: "2025-09-12", editor: "Sofia" },
  { section: "Feature", feature: "Industry Icon — Interview", content: "Bespoke Content", type: "Bespoke", pages: 8, photographer: "Low Cooper", talent: "Industry Icon", editor: "Luke" },
  { section: "Advertorial", feature: "LOEWE — DPS", content: "Advertorial", type: "Supplied", pages: 2 },
  { section: "Art & Design", feature: "ART & DESIGN — Studio Visit", content: "Bespoke Content", type: "Bespoke", pages: 8, photographer: "Theo Marsh", shootDate: "2025-09-02", talent: "Featured Artist", editor: "Sofia" },
  { section: "Art & Design", feature: "Design Dispatch — Objects", content: "Editorial", type: "Editorial", pages: 6, editor: "Maya" },
  { section: "Advertorial", feature: "BURBERRY — DPS", content: "Advertorial", type: "Supplied", pages: 2 },
  { section: "Art & Design", feature: "Gallery Guide", content: "Editorial", type: "Editorial", pages: 4, editor: "Maya" },
  { section: "Digital Focus", feature: "DIGITAL FOCUS — Creators", content: "Bespoke Content", type: "Bespoke", pages: 6, talent: "Digital Creators", editor: "Maya" },
  { section: "Digital Focus", feature: "Digital Focus — Tools", content: "Editorial", type: "Editorial", pages: 4, editor: "Maya" },
  { section: "Advertorial", feature: "OMEGA — DPS", content: "Advertorial", type: "Supplied", pages: 2 },
  { section: "Feature", feature: "Watches & Wonders", content: "Bespoke Content", type: "Bespoke", pages: 8, photographer: "Still Life Team", editor: "Maya" },
  { section: "Feature", feature: "Travel — Autumn Escapes", content: "Bespoke Content", type: "Bespoke", pages: 6, photographer: "Theo Marsh", editor: "Sofia" },
  { section: "Advertorial", feature: "BOTTEGA VENETA — DPS", content: "Advertorial", type: "Supplied", pages: 2 },
  { section: "Feature", feature: "Interiors Story", content: "Bespoke Content", type: "Bespoke", pages: 6, photographer: "Rae Iverson", editor: "Sofia" },
  { section: "Feature", feature: "Long Read — Legacy", content: "Editorial", type: "Editorial", pages: 6, editor: "Sofia" },
  { section: "Community", feature: "Community Spotlight", content: "Bespoke Content", type: "Bespoke", pages: 4, talent: "Community Members", editor: "Sofia" },
  { section: "Community", feature: "Outlander Directory", content: "Editorial", type: "Editorial", pages: 6, editor: "Maya" },
  { section: "Advertorial", feature: "TIFFANY — DPS", content: "Advertorial", type: "Supplied", pages: 2 },
  { section: "Community", feature: "Reader Pages", content: "Editorial", type: "Editorial", pages: 2, editor: "Maya" },
  { section: "FOB", feature: "Horoscopes", content: "Editorial", type: "Editorial", pages: 2, editor: "Maya" },
  { section: "Community", feature: "Stockists & Credits", content: "Editorial", type: "Editorial", pages: 2, editor: "Luke" },
  { section: "FOB", feature: "Back Page — Last Word", content: "Editorial", type: "Editorial", pages: 1, editor: "Luke" },
  { section: "Advertorial", feature: "HERMÈS — Inside Back", content: "Advertorial", type: "Supplied", pages: 1 },
  { section: "Advertorial", feature: "ROLEX — Outside Back", content: "Advertorial", type: "Supplied", pages: 1 },
];

// Generic page builder. `forceStatus` overrides every featured page's status
// (used to mark Issue 01 fully COMPLETE); otherwise each segment's own status is
// used. Remaining pages are padded with available Space slots.
function buildPagesFromSegments(
  segments: Segment[],
  totalPages: number,
  forceStatus?: PageStatus
): MagazinePage[] {
  const pages: MagazinePage[] = [];
  let n = 1;
  for (const seg of segments) {
    for (let i = 0; i < seg.pages; i++) {
      if (n > totalPages) break;
      const multi = seg.pages > 1 ? ` (${i + 1}/${seg.pages})` : "";
      pages.push(
        syncStatusFlags({
          pageNumber: n,
          section: seg.section,
          feature: seg.feature + multi,
          content: seg.content,
          type: seg.type,
          photographer: seg.photographer ?? "",
          shootDate: seg.shootDate ?? "",
          talent: seg.talent ?? "",
          interviewDate: "",
          editor: seg.editor ?? "",
          status: forceStatus ?? seg.status ?? "NOT_STARTED",
          readyForDesign: false,
          inDesign: false,
          complete: false,
          notes: "",
          colour: sectionColour(seg.section),
        })
      );
      n++;
    }
  }
  // Pad remaining with available Space pages (paid advertising slots / TBC).
  while (n <= totalPages) {
    pages.push(blankPage(n, "Space"));
    n++;
  }
  return pages.slice(0, totalPages);
}

// Derive an issue's page count from its content: round the content up to the next
// multiple of 8 (a valid print signature). If the content already lands exactly on
// a signature, add one more so there's always a small block of Space pages for
// unsold/TBC slots. Space is therefore always 1–8 pages — never runaway padding.
function seedTotalPages(segments: Segment[]): number {
  const content = segments.reduce((sum, seg) => sum + seg.pages, 0);
  const rounded = Math.ceil(content / 8) * 8;
  return rounded === content ? rounded + 8 : rounded;
}

const SS26_TOTAL = seedTotalPages(SEED_SEGMENTS_SS26);
const AW25_TOTAL = seedTotalPages(SEED_SEGMENTS_AW25);

// Issue 02 SS26 — the live in-progress issue (kept as the default export name for
// backwards compatibility with the existing API route import).
export function buildSeedPages(totalPages = SS26_TOTAL): MagazinePage[] {
  return buildPagesFromSegments(SEED_SEGMENTS_SS26, totalPages);
}

// One blueprint per seeded issue. The API seeds all of these on first load.
export interface SeedIssue {
  issueNumber: number;
  issueName: string;
  totalPages: number;
  build: () => MagazinePage[];
}

export const SEED_ISSUES: SeedIssue[] = [
  {
    issueNumber: 1,
    issueName: "AW25",
    totalPages: AW25_TOTAL,
    build: () => buildPagesFromSegments(SEED_SEGMENTS_AW25, AW25_TOTAL, "COMPLETE"),
  },
  {
    issueNumber: 2,
    issueName: "SS26",
    totalPages: SS26_TOTAL,
    build: () => buildPagesFromSegments(SEED_SEGMENTS_SS26, SS26_TOTAL),
  },
];

export const SEED_TOTAL_PAGES = SS26_TOTAL;

// ===== Print Budget — cross-portal cost tracking =====
// Pure, shared between the Budget tab (client), /api/print-budget (server) and
// the Finance Print P&L (server). No server-only imports allowed here.

export type BudgetType = "Supplied Ad" | "Advertorial" | "Editorial" | "Space";

// Strip a multi-page suffix like " (2/8)" so every page of one feature shares a key.
function baseFeature(feature: string): string {
  return feature.replace(/\s*\(\d+\/\d+\)\s*$/, "").trim();
}

// Classify a page into one of the four budget content types from its existing
// flat-plan fields. Brand pages supplied finished (type "Supplied") are Supplied
// Ads (no production cost); produced advertorials carry production cost; blank
// Space pages are cost-free inventory; everything else is Editorial.
export function budgetType(page: MagazinePage): BudgetType {
  // Space inventory (blank slots and named "ADVERTISE — Space" pages) carries no
  // cost: the whole Space section, or a page explicitly marked Space content/type.
  if (page.section === "Space" || /^\s*space\s*$/i.test(page.type) || /^\s*space\s*$/i.test(page.content)) {
    return "Space";
  }
  const supplied = /supplied/i.test(page.type) || /supplied/i.test(page.content);
  const advertorial =
    page.section === "Advertorial" ||
    /advertorial/i.test(page.content) ||
    /advertorial/i.test(page.feature);
  if (advertorial && supplied) return "Supplied Ad"; // brand-supplied finished ad
  if (advertorial) return "Advertorial"; // produced content, client pays
  if (supplied) return "Supplied Ad";
  return "Editorial";
}

// A budget row spans the consecutive pages of one feature. The financial fields
// (links, manual costs) live on the anchor page; the row range/page count are
// derived. Blank Space pages collapse into a single row.
export interface BudgetGroup {
  anchorIndex: number; // index into pages[] that owns the financial fields
  indices: number[];
  pageNumbers: number[];
  pageLabel: string; // "12" or "12–15"
  feature: string;
  section: string;
  type: BudgetType;
  status: PageStatus;
  pageCount: number;
}

export function groupBudgetRows(pages: MagazinePage[]): BudgetGroup[] {
  const groups: BudgetGroup[] = [];
  let key: string | null = null;
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    const blank = p.section === "Space" && !p.feature.trim();
    const k = blank ? `__space__|${p.section}` : `${baseFeature(p.feature)}|${p.section}`;
    if (k !== key || groups.length === 0) {
      groups.push({
        anchorIndex: i,
        indices: [i],
        pageNumbers: [p.pageNumber],
        pageLabel: String(p.pageNumber),
        feature: blank ? "Space" : baseFeature(p.feature),
        section: p.section,
        type: budgetType(p),
        status: p.status,
        pageCount: 1,
      });
      key = k;
    } else {
      const g = groups[groups.length - 1];
      g.indices.push(i);
      g.pageNumbers.push(p.pageNumber);
      g.pageCount++;
    }
  }
  for (const g of groups) {
    const first = g.pageNumbers[0];
    const last = g.pageNumbers[g.pageNumbers.length - 1];
    g.pageLabel = first === last ? String(first) : `${first}–${last}`;
  }
  return groups;
}

// Linked-record summaries the budget computation needs (fetched server-side).
export interface LinkedDeal {
  id: string;
  title: string;
  client: string | null;
  dealValue: number | null;
}
export interface LinkedProduction {
  id: string;
  title: string;
  actual: number;
}

export interface BudgetRow {
  anchorIndex: number;
  pageLabel: string;
  pageCount: number;
  feature: string;
  section: string;
  type: BudgetType;
  status: PageStatus;
  campaignId?: string;
  productionId?: string;
  source: string;
  sourceHref: string | null;
  revenue: number;
  productionCost: number;
  printCost: number;
  margin: number;
  revenueAuto: boolean; // revenue derived from a linked deal (not manually editable)
  productionCostAuto: boolean; // production cost derived from a linked production
}

// Compute the financial picture for one budget row, blending the page's manual
// fields with any linked deal/production values per the four cost models.
export function computeBudgetRow(
  group: BudgetGroup,
  anchor: MagazinePage,
  deal: LinkedDeal | null,
  production: LinkedProduction | null
): BudgetRow {
  const base = {
    anchorIndex: group.anchorIndex,
    pageLabel: group.pageLabel,
    pageCount: group.pageCount,
    feature: group.feature,
    section: group.section,
    type: group.type,
    status: group.status,
    campaignId: anchor.campaignId,
    productionId: anchor.productionId,
  };

  if (group.type === "Space") {
    return {
      ...base,
      source: "N/A",
      sourceHref: null,
      revenue: 0,
      productionCost: 0,
      printCost: 0,
      margin: 0,
      revenueAuto: false,
      productionCostAuto: false,
    };
  }

  const revenueAuto = !!deal;
  const revenue = deal ? deal.dealValue ?? 0 : anchor.revenue ?? 0;

  const productionCostAuto = group.type !== "Supplied Ad" && !!production;
  let productionCost = 0;
  if (group.type === "Supplied Ad") productionCost = 0;
  else if (production) productionCost = production.actual;
  else productionCost = anchor.productionCost ?? 0;

  const printCost = anchor.printCost ?? 0;
  const margin = revenue - productionCost - printCost;

  let source: string;
  let sourceHref: string | null = null;
  if (deal) {
    source = deal.client ? `${deal.title} · ${deal.client}` : deal.title;
    sourceHref = `/commercial/deals/${deal.id}`;
  } else if (production) {
    source = production.title;
    sourceHref = `/production/${production.id}`;
  } else if (group.type === "Editorial") {
    source = "Editorial Budget";
  } else {
    source = "—";
  }

  return {
    ...base,
    source,
    sourceHref,
    revenue,
    productionCost,
    printCost,
    margin,
    revenueAuto,
    productionCostAuto,
  };
}

export interface BudgetTotals {
  revenue: number;
  productionCost: number;
  printCost: number;
  margin: number;
  totalPages: number; // pages carrying a feature (excludes blank Space)
  revenuePerPage: number;
  costPerPage: number;
}

export function computeBudgetTotals(rows: BudgetRow[]): BudgetTotals {
  const revenue = rows.reduce((s, r) => s + r.revenue, 0);
  const productionCost = rows.reduce((s, r) => s + r.productionCost, 0);
  const printCost = rows.reduce((s, r) => s + r.printCost, 0);
  const margin = revenue - productionCost - printCost;
  const totalPages = rows.reduce((s, r) => s + (r.type === "Space" ? 0 : r.pageCount), 0);
  const cost = productionCost + printCost;
  return {
    revenue,
    productionCost,
    printCost,
    margin,
    totalPages,
    revenuePerPage: totalPages ? revenue / totalPages : 0,
    costPerPage: totalPages ? cost / totalPages : 0,
  };
}
