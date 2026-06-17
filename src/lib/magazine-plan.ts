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
  Cover: { label: "Cover", hex: "#2563eb" },
  FOB: { label: "FOB", hex: "#ff8c00" },
  Fashion: { label: "Fashion", hex: "#9ca3af" },
  Feature: { label: "Feature", hex: "#3b82f6" },
  Community: { label: "Community", hex: "#22c55e" },
  Advertorial: { label: "Advertorial", hex: "#84cc16" },
  Space: { label: "Space", hex: "#4b5563" },
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

// ===== Seed data — representative Issue 02 "SS26" structure (~296 pages) =====

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

// A believable run of sections matching Joe's planning sheet: cover, a deep FOB
// run of supplied/editorial pages, fashion editorial + FUTURE ICONS, long-form
// features (Behind the Craft), community pages, and advertorial partnerships,
// padded with paid Space pages so the total lands on a multiple of 8.
const SEED_SEGMENTS: Segment[] = [
  { section: "Cover", feature: "SS26 COVER", content: "Bespoke Content", type: "Bespoke", pages: 1, photographer: "Low Cooper", shootDate: "2026-04-20", talent: "Cover Talent TBC", editor: "Luke", status: "IN_DESIGN" },
  { section: "Advertorial", feature: "DIOR — Inside Front", content: "Advertorial", type: "Supplied", pages: 2, status: "CONTENT_RECEIVED" },
  { section: "FOB", feature: "DIOR STILL LIFE", content: "Supplied", type: "Supplied", pages: 2, photographer: "Low Cooper", shootDate: "2026-05-15", editor: "Luke", status: "CONTENT_RECEIVED" },
  { section: "FOB", feature: "Masthead & Credits", content: "Editorial", type: "Editorial", pages: 1, editor: "Luke", status: "COMPLETE" },
  { section: "FOB", feature: "Contents", content: "Editorial", type: "Editorial", pages: 2, editor: "Luke", status: "READY_FOR_DESIGN" },
  { section: "FOB", feature: "Editor's Letter", content: "Editorial", type: "Editorial", pages: 1, editor: "Luke", status: "READY_FOR_DESIGN" },
  { section: "Advertorial", feature: "SAINT LAURENT — DPS", content: "Advertorial", type: "Supplied", pages: 2, status: "CONTENT_RECEIVED" },
  { section: "FOB", feature: "Radar — New In", content: "Editorial", type: "Editorial", pages: 4, photographer: "Studio", editor: "Maya", status: "CONTENT_RECEIVED" },
  { section: "FOB", feature: "Object of Desire", content: "Supplied", type: "Supplied", pages: 2, status: "CONTENT_RECEIVED" },
  { section: "FOB", feature: "The Edit — Beauty", content: "Editorial", type: "Editorial", pages: 4, photographer: "Still Life Team", shootDate: "2026-05-02", editor: "Maya", status: "NOT_STARTED" },
  { section: "Advertorial", feature: "GUCCI — DPS", content: "Advertorial", type: "Supplied", pages: 2, status: "NOT_STARTED" },
  { section: "FOB", feature: "Five Minutes With…", content: "Bespoke Content", type: "Bespoke", pages: 3, talent: "Industry Guest", editor: "Sofia", status: "NOT_STARTED" },
  { section: "Fashion", feature: "FUTURE ICONS", content: "Bespoke Content", type: "Bespoke", pages: 10, photographer: "Low Cooper", shootDate: "2026-05-15", talent: "Future Icons Cast", editor: "Luke", status: "CONTENT_RECEIVED" },
  { section: "Advertorial", feature: "PRADA — DPS", content: "Advertorial", type: "Supplied", pages: 2, status: "CONTENT_RECEIVED" },
  { section: "Fashion", feature: "Fashion Editorial — Bloom", content: "Bespoke Content", type: "Bespoke", pages: 12, photographer: "Rae Iverson", shootDate: "2026-05-22", talent: "Model TBC", editor: "Luke", status: "NOT_STARTED" },
  { section: "Fashion", feature: "Accessories Story", content: "Bespoke Content", type: "Bespoke", pages: 6, photographer: "Still Life Team", shootDate: "2026-05-28", editor: "Maya", status: "NOT_STARTED" },
  { section: "Advertorial", feature: "BOTTEGA VENETA — DPS", content: "Advertorial", type: "Supplied", pages: 2, status: "NOT_STARTED" },
  { section: "Feature", feature: "BEHIND THE CRAFT — Parisian Sweet", content: "Bespoke Content", type: "Bespoke", pages: 8, photographer: "Theo Marsh", shootDate: "2026-05-10", talent: "Atelier Profile", editor: "Sofia", status: "CONTENT_RECEIVED" },
  { section: "Feature", feature: "The Long Read — Future of Craft", content: "Editorial", type: "Editorial", pages: 6, editor: "Sofia", status: "NOT_STARTED" },
  { section: "Advertorial", feature: "LOEWE — DPS", content: "Advertorial", type: "Supplied", pages: 2, status: "NOT_STARTED" },
  { section: "Feature", feature: "INDUSTRY ICON — Interview", content: "Bespoke Content", type: "Bespoke", pages: 8, photographer: "Low Cooper", shootDate: "2026-05-18", talent: "Industry Icon", editor: "Luke", status: "NOT_STARTED" },
  { section: "Feature", feature: "Photo Essay — City", content: "Bespoke Content", type: "Bespoke", pages: 6, photographer: "Rae Iverson", shootDate: "2026-05-25", editor: "Sofia", status: "NOT_STARTED" },
  { section: "Advertorial", feature: "CHANEL — DPS", content: "Advertorial", type: "Supplied", pages: 2, status: "NOT_STARTED" },
  { section: "Community", feature: "ASK THE INDUSTRY", content: "Editorial", type: "Editorial", pages: 4, editor: "Maya", status: "NOT_STARTED" },
  { section: "Community", feature: "OUTLANDER DIRECTORY", content: "Editorial", type: "Editorial", pages: 6, editor: "Maya", status: "NOT_STARTED" },
  { section: "Community", feature: "Community Spotlight", content: "Bespoke Content", type: "Bespoke", pages: 4, talent: "Community Members", editor: "Sofia", status: "NOT_STARTED" },
  { section: "Advertorial", feature: "BURBERRY — DPS", content: "Advertorial", type: "Supplied", pages: 2, status: "NOT_STARTED" },
  { section: "Feature", feature: "Travel — Slow Escapes", content: "Bespoke Content", type: "Bespoke", pages: 6, photographer: "Theo Marsh", editor: "Sofia", status: "NOT_STARTED" },
  { section: "Community", feature: "Stockists & Credits", content: "Editorial", type: "Editorial", pages: 2, editor: "Luke", status: "NOT_STARTED" },
  { section: "FOB", feature: "Back Page — Last Word", content: "Editorial", type: "Editorial", pages: 1, editor: "Luke", status: "NOT_STARTED" },
  { section: "Advertorial", feature: "HERMÈS — Inside Back", content: "Advertorial", type: "Supplied", pages: 1, status: "CONTENT_RECEIVED" },
  { section: "Advertorial", feature: "TIFFANY & CO — Outside Back", content: "Advertorial", type: "Supplied", pages: 1, status: "CONTENT_RECEIVED" },
];

export function buildSeedPages(totalPages = 296): MagazinePage[] {
  const pages: MagazinePage[] = [];
  let n = 1;
  for (const seg of SEED_SEGMENTS) {
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
          status: seg.status ?? "NOT_STARTED",
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

export const SEED_TOTAL_PAGES = 296;
