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
  | "Feature"
  | "Community"
  | "Advertorial"
  | "Art & Design"
  | "Digital Focus"
  | "Space";

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
export const SECTIONS: Record<
  SectionKey,
  { label: string; hex: string }
> = {
  Cover: { label: "Cover", hex: "#3b82f6" },
  FOB: { label: "FOB", hex: "#ff8c00" },
  Fashion: { label: "Fashion", hex: "#9ca3af" },
  Feature: { label: "Feature", hex: "#60a5fa" },
  Community: { label: "Community", hex: "#34d399" },
  Advertorial: { label: "Advertorial", hex: "#4ade80" },
  "Art & Design": { label: "Art & Design", hex: "#a78bfa" },
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
const SEED_SEGMENTS_SS26: Segment[] = [
  { section: "Cover", feature: "SS26 COVER", content: "Bespoke Content", type: "Bespoke", pages: 1, photographer: "Low Cooper", shootDate: "2026-04-20", talent: "Cover Talent TBC", editor: "Luke", status: "IN_DESIGN" },
  { section: "Advertorial", feature: "DIOR — Inside Front", content: "Advertorial", type: "Supplied", pages: 2, status: "CONTENT_RECEIVED" },
  { section: "FOB", feature: "DIOR STILL LIFE", content: "Supplied", type: "Supplied", pages: 2, photographer: "Low Cooper", shootDate: "2026-05-15", editor: "Luke", status: "CONTENT_RECEIVED" },
  { section: "FOB", feature: "Masthead & Credits", content: "Editorial", type: "Editorial", pages: 1, editor: "Luke", status: "COMPLETE" },
  { section: "FOB", feature: "Contents", content: "Editorial", type: "Editorial", pages: 2, editor: "Luke", status: "READY_FOR_DESIGN" },
  { section: "FOB", feature: "Editor's Letter", content: "Editorial", type: "Editorial", pages: 1, editor: "Luke", status: "READY_FOR_DESIGN" },
  { section: "Advertorial", feature: "SAINT LAURENT — DPS", content: "Advertorial", type: "Supplied", pages: 2, status: "CONTENT_RECEIVED" },
  { section: "FOB", feature: "Radar — New In", content: "Editorial", type: "Editorial", pages: 4, photographer: "Studio", editor: "Maya", status: "CONTENT_RECEIVED" },
  { section: "Advertorial", feature: "VERSACE — Full Page", content: "Advertorial", type: "Supplied", pages: 1, status: "CONTENT_RECEIVED" },
  { section: "FOB", feature: "Object of Desire", content: "Supplied", type: "Supplied", pages: 2, status: "CONTENT_RECEIVED" },
  { section: "FOB", feature: "The Edit — Beauty", content: "Editorial", type: "Editorial", pages: 4, photographer: "Still Life Team", shootDate: "2026-05-02", editor: "Maya", status: "NOT_STARTED" },
  { section: "Advertorial", feature: "TOM FORD BEAUTY — Full Page", content: "Advertorial", type: "Supplied", pages: 1, status: "CONTENT_RECEIVED" },
  { section: "FOB", feature: "Trends Report", content: "Editorial", type: "Editorial", pages: 4, editor: "Maya", status: "NOT_STARTED" },
  { section: "Advertorial", feature: "GUCCI — DPS", content: "Advertorial", type: "Supplied", pages: 2, status: "NOT_STARTED" },
  { section: "FOB", feature: "Five Minutes With…", content: "Bespoke Content", type: "Bespoke", pages: 3, talent: "Industry Guest", editor: "Sofia", status: "NOT_STARTED" },
  { section: "FOB", feature: "Style Notes — Column", content: "Editorial", type: "Editorial", pages: 2, editor: "Sofia", status: "NOT_STARTED" },
  { section: "Advertorial", feature: "CARTIER — Full Page", content: "Advertorial", type: "Supplied", pages: 1, status: "CONTENT_RECEIVED" },
  { section: "Fashion", feature: "FUTURE ICONS", content: "Bespoke Content", type: "Bespoke", pages: 10, photographer: "Low Cooper", shootDate: "2026-05-15", talent: "Future Icons Cast", editor: "Luke", status: "CONTENT_RECEIVED" },
  { section: "Advertorial", feature: "PRADA — DPS", content: "Advertorial", type: "Supplied", pages: 2, status: "CONTENT_RECEIVED" },
  { section: "Fashion", feature: "Fashion Editorial — Bloom", content: "Bespoke Content", type: "Bespoke", pages: 12, photographer: "Rae Iverson", shootDate: "2026-05-22", talent: "Model TBC", editor: "Luke", status: "NOT_STARTED" },
  { section: "Advertorial", feature: "VALENTINO — DPS", content: "Advertorial", type: "Supplied", pages: 2, status: "NOT_STARTED" },
  { section: "Fashion", feature: "Fashion Editorial — Coastline", content: "Bespoke Content", type: "Bespoke", pages: 10, photographer: "Rae Iverson", shootDate: "2026-05-30", talent: "Model TBC", editor: "Luke", status: "NOT_STARTED" },
  { section: "Fashion", feature: "Accessories Story", content: "Bespoke Content", type: "Bespoke", pages: 6, photographer: "Still Life Team", shootDate: "2026-05-28", editor: "Maya", status: "NOT_STARTED" },
  { section: "Advertorial", feature: "BOTTEGA VENETA — DPS", content: "Advertorial", type: "Supplied", pages: 2, status: "NOT_STARTED" },
  { section: "Fashion", feature: "Shoe & Bag Edit", content: "Bespoke Content", type: "Bespoke", pages: 4, photographer: "Still Life Team", editor: "Maya", status: "NOT_STARTED" },
  { section: "Fashion", feature: "Jewellery Story", content: "Bespoke Content", type: "Bespoke", pages: 6, photographer: "Still Life Team", shootDate: "2026-06-02", editor: "Maya", status: "NOT_STARTED" },
  { section: "Advertorial", feature: "CHANEL — DPS", content: "Advertorial", type: "Supplied", pages: 2, status: "NOT_STARTED" },
  { section: "Feature", feature: "BEHIND THE CRAFT — Parisian Sweet", content: "Bespoke Content", type: "Bespoke", pages: 8, photographer: "Theo Marsh", shootDate: "2026-05-10", talent: "Atelier Profile", editor: "Sofia", status: "CONTENT_RECEIVED" },
  { section: "Feature", feature: "The Long Read — Future of Craft", content: "Editorial", type: "Editorial", pages: 6, editor: "Sofia", status: "NOT_STARTED" },
  { section: "Advertorial", feature: "LOEWE — DPS", content: "Advertorial", type: "Supplied", pages: 2, status: "NOT_STARTED" },
  { section: "Feature", feature: "INDUSTRY ICON — Interview", content: "Bespoke Content", type: "Bespoke", pages: 8, photographer: "Low Cooper", shootDate: "2026-05-18", talent: "Industry Icon", editor: "Luke", status: "NOT_STARTED" },
  { section: "Community", feature: "ASK THE INDUSTRY", content: "Editorial", type: "Editorial", pages: 4, editor: "Maya", status: "NOT_STARTED" },
  { section: "Feature", feature: "Photo Essay — City", content: "Bespoke Content", type: "Bespoke", pages: 6, photographer: "Rae Iverson", shootDate: "2026-05-25", editor: "Sofia", status: "NOT_STARTED" },
  { section: "Advertorial", feature: "BURBERRY — DPS", content: "Advertorial", type: "Supplied", pages: 2, status: "NOT_STARTED" },
  { section: "Feature", feature: "BEHIND THE CRAFT — Atelier", content: "Bespoke Content", type: "Bespoke", pages: 8, photographer: "Theo Marsh", shootDate: "2026-05-12", talent: "Atelier Profile", editor: "Sofia", status: "NOT_STARTED" },
  { section: "Feature", feature: "The Conversation", content: "Bespoke Content", type: "Bespoke", pages: 6, talent: "Two Voices", editor: "Sofia", status: "NOT_STARTED" },
  { section: "Advertorial", feature: "HERMÈS — DPS", content: "Advertorial", type: "Supplied", pages: 2, status: "CONTENT_RECEIVED" },
  { section: "Feature", feature: "Cultural Dispatch", content: "Editorial", type: "Editorial", pages: 4, editor: "Sofia", status: "NOT_STARTED" },
  { section: "Feature", feature: "Profile — Designer", content: "Bespoke Content", type: "Bespoke", pages: 6, photographer: "Low Cooper", talent: "Designer", editor: "Luke", status: "NOT_STARTED" },
  { section: "Advertorial", feature: "TIFFANY — DPS", content: "Advertorial", type: "Supplied", pages: 2, status: "NOT_STARTED" },
  { section: "Feature", feature: "Watches Special", content: "Bespoke Content", type: "Bespoke", pages: 8, photographer: "Still Life Team", editor: "Maya", status: "NOT_STARTED" },
  { section: "Advertorial", feature: "OMEGA — DPS", content: "Advertorial", type: "Supplied", pages: 2, status: "NOT_STARTED" },
  { section: "Feature", feature: "Photography Portfolio", content: "Bespoke Content", type: "Bespoke", pages: 8, photographer: "Theo Marsh", editor: "Sofia", status: "NOT_STARTED" },
  { section: "Feature", feature: "Travel — Slow Escapes", content: "Bespoke Content", type: "Bespoke", pages: 6, photographer: "Theo Marsh", editor: "Sofia", status: "NOT_STARTED" },
  { section: "Advertorial", feature: "MONCLER — DPS", content: "Advertorial", type: "Supplied", pages: 2, status: "NOT_STARTED" },
  { section: "Feature", feature: "Interiors Story", content: "Bespoke Content", type: "Bespoke", pages: 6, photographer: "Rae Iverson", editor: "Sofia", status: "NOT_STARTED" },
  { section: "Feature", feature: "Food & Table", content: "Bespoke Content", type: "Bespoke", pages: 4, photographer: "Still Life Team", editor: "Sofia", status: "NOT_STARTED" },
  { section: "Advertorial", feature: "BALENCIAGA — DPS", content: "Advertorial", type: "Supplied", pages: 2, status: "NOT_STARTED" },
  { section: "Community", feature: "OUTLANDER DIRECTORY", content: "Editorial", type: "Editorial", pages: 6, editor: "Maya", status: "NOT_STARTED" },
  { section: "Community", feature: "Community Spotlight", content: "Bespoke Content", type: "Bespoke", pages: 4, talent: "Community Members", editor: "Sofia", status: "NOT_STARTED" },
  { section: "Community", feature: "Reader Pages", content: "Editorial", type: "Editorial", pages: 2, editor: "Maya", status: "NOT_STARTED" },
  { section: "Advertorial", feature: "DOLCE & GABBANA — DPS", content: "Advertorial", type: "Supplied", pages: 2, status: "NOT_STARTED" },
  { section: "Feature", feature: "Wellness", content: "Editorial", type: "Editorial", pages: 4, editor: "Sofia", status: "NOT_STARTED" },
  { section: "Feature", feature: "Long Read — Sustainability", content: "Editorial", type: "Editorial", pages: 6, editor: "Sofia", status: "NOT_STARTED" },
  { section: "FOB", feature: "Horoscopes", content: "Editorial", type: "Editorial", pages: 2, editor: "Maya", status: "NOT_STARTED" },
  { section: "Community", feature: "Stockists & Credits", content: "Editorial", type: "Editorial", pages: 2, editor: "Luke", status: "NOT_STARTED" },
  { section: "FOB", feature: "Back Page — Last Word", content: "Editorial", type: "Editorial", pages: 1, editor: "Luke", status: "NOT_STARTED" },
  { section: "Advertorial", feature: "HERMÈS — Inside Back", content: "Advertorial", type: "Supplied", pages: 1, status: "CONTENT_RECEIVED" },
  { section: "Advertorial", feature: "TIFFANY & CO — Outside Back", content: "Advertorial", type: "Supplied", pages: 1, status: "CONTENT_RECEIVED" },
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
