// Phase detection for pasted timelines.
//
// A pasted schedule rarely labels its phases — it's just a list of dated lines:
//
//   V1 Production Deck Shared — 13 August 2026
//   Shoot Week — 1–4 September 2026
//   Final Delivery — 24 September 2026
//
// Two signals sort those into Pre-Production / Production / Post-Production:
//   1. Keywords in the title (a "Shoot Week" is the shoot, "V1 Assets" is post).
//   2. Position relative to the shoot — anything before it is pre, anything
//      after it is post. This is the stronger signal: once we know where the
//      shoot sits, unlabelled lines like "Client Feedback" resolve on their
//      date alone.

export type TimelinePhase = "PRE_PRODUCTION" | "PRODUCTION" | "POST_PRODUCTION";

// The shoot itself. Checked first — "Shoot Week" beats every other keyword.
const SHOOT_PATTERNS: RegExp[] = [
  /\bshoot(ing|s)?\b/i,
  /\bfilm(ing)?\s+(day|week|dates?)\b/i,
  /\bon[-\s]?set\b/i,
  /\bproduction\s+(day|week|dates?)\b/i,
  /\bprincipal photography\b/i,
];

// Pre-production. Checked before the post list so "Product Delivery Deadline"
// (sending product to set) doesn't read as a delivery of finished assets.
const PRE_PATTERNS: RegExp[] = [
  /\bproduct\s+delivery\b/i,
  /\bdecks?\b/i,
  /\bbrief(ing)?\b/i,
  /\bcasting\b/i,
  /\brecce\b/i,
  /\blocation\s+scout(ing)?\b/i,
  /\bscout(ing)?\b/i,
  /\bmood\s?board\b/i,
  /\btreatment\b/i,
  /\bwardrobe\b/i,
  /\bfitting\b/i,
  /\bcall\s?sheet\b/i,
  /\bshot\s?list\b/i,
  /\bpre[-\s]?production\b/i,
  /\bpre[-\s]?pro\b/i,
  /\bcrew\s+book(ing|ed)?\b/i,
  /\bbook\s+crew\b/i,
  /\bstyling\b/i,
  /\bcontract\b/i,
];

// Post-production and delivery.
const POST_PATTERNS: RegExp[] = [
  /\bassets?\b/i,
  /\bfinal\s+delivery\b/i,
  /\bdeliver(y|ed|ables?)\b/i,
  /\bedit(ing|s)?\b/i,
  /\bpost[-\s]?production\b/i,
  /\bpost[-\s]?pro\b/i,
  /\bretouch(ing)?\b/i,
  /\bcolou?r\s?grad(e|ing)\b/i,
  /\bgrading\b/i,
  /\bfinal\s+cut\b/i,
  /\bselects\b/i,
  /\bsound\s?mix\b/i,
  /\bexports?\b/i,
];

// "Go live" / "live date" — the end of the line. Treated as post-production and
// flagged as a key milestone.
const GO_LIVE_PATTERNS: RegExp[] = [
  /\bgo[-\s]?live\b/i,
  /\blive\s+date\b/i,
  /\bpublish(ed|ing)?\b/i,
  /\blaunch(es|ed|ing)?\b/i,
];

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((re) => re.test(text));
}

/** True when the title reads as the shoot itself. */
export function isShootItem(title: string): boolean {
  return matchesAny(title || "", SHOOT_PATTERNS);
}

/** True when the title reads as a go-live / launch. */
export function isGoLiveItem(title: string): boolean {
  return matchesAny(title || "", GO_LIVE_PATTERNS);
}

// Phase from the title alone, or null when nothing matches ("Client Feedback"
// could sit either side of the shoot — chronology decides).
export function phaseFromKeywords(title: string): TimelinePhase | null {
  const t = title || "";
  if (matchesAny(t, SHOOT_PATTERNS)) return "PRODUCTION";
  if (matchesAny(t, PRE_PATTERNS)) return "PRE_PRODUCTION";
  if (matchesAny(t, GO_LIVE_PATTERNS)) return "POST_PRODUCTION";
  if (matchesAny(t, POST_PATTERNS)) return "POST_PRODUCTION";
  return null;
}

export interface PhaseableItem {
  title: string;
  /** ISO start date. */
  date: string;
  /** ISO end date for a multi-day item, else null. */
  endDate?: string | null;
  /** Set when the pasted text named the phase explicitly — never overridden. */
  phaseLocked?: boolean;
  phase?: TimelinePhase;
  isMilestone?: boolean;
}

function time(iso: string | null | undefined): number {
  if (!iso) return NaN;
  const t = new Date(iso).getTime();
  return isNaN(t) ? NaN : t;
}

/**
 * Assign a phase to every item. Items flagged `phaseLocked` keep the phase they
 * arrived with; the rest are classified by keyword, then re-sorted by position
 * relative to the shoot when the paste contains one.
 *
 * Returns a new array — the input is not mutated.
 */
export function assignPhases<T extends PhaseableItem>(items: T[]): T[] {
  const result = items.map((it) => ({ ...it }));

  // Pass 1 — keywords. Shoot items also become flagged milestones.
  for (const it of result) {
    if (isShootItem(it.title) && !it.phaseLocked) it.isMilestone = true;
    if (isGoLiveItem(it.title) && !it.phaseLocked) it.isMilestone = true;
    if (it.phaseLocked && it.phase) continue;
    it.phase = phaseFromKeywords(it.title) ?? "PRE_PRODUCTION";
  }

  // Pass 2 — chronology. Find the shoot window: earliest start and latest end
  // across every item that reads as the shoot.
  const shoots = result.filter((it) => !it.phaseLocked && isShootItem(it.title));
  const starts = shoots.map((s) => time(s.date)).filter((n) => !isNaN(n));
  if (starts.length === 0) return result;

  const shootStart = Math.min(...starts);
  const shootEnd = Math.max(
    ...shoots.map((s) => time(s.endDate) || time(s.date)).filter((n) => !isNaN(n))
  );

  for (const it of result) {
    if (it.phaseLocked && it.phase) continue;
    if (isShootItem(it.title)) {
      it.phase = "PRODUCTION";
      continue;
    }
    const t = time(it.date);
    if (isNaN(t)) continue;
    // A same-day-as-the-shoot item that isn't the shoot (e.g. a wrap note) sits
    // in production; otherwise strictly before → pre, strictly after → post.
    if (t < shootStart) it.phase = "PRE_PRODUCTION";
    else if (t > shootEnd) it.phase = "POST_PRODUCTION";
    else it.phase = "PRODUCTION";
  }

  return result;
}
