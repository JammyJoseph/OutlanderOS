// Flexible, dependency-free date parsing for timeline entry.
//
// Understands the formats people actually paste or type:
//   Standard   — "2026-07-15", "15/07/2026", "07/15/2026", "15.7.26"
//   UK style   — "15 July 2026", "15th July", "15 Jul", "WED 1 JUL"
//   US style   — "July 15", "Jul 15th, 2026"
//   Bare day   — "the 15th", "15th" (nearest upcoming occurrence)
//   Casual     — "today", "tomorrow", "next Monday", "this Friday",
//                "in 2 weeks", "in 3 days"
//   In context — "Shoot day - 20th July", "meeting on the 3rd of August"
//
// All returned Dates are anchored to 12:00 UTC so a date-only value never
// slips a day across timezones (matches the convention used elsewhere in
// the timeline code: `new Date(date + "T12:00:00")`).

const MONTHS: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

const WEEKDAYS: Record<string, number> = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tues: 2, tuesday: 2,
  wed: 3, weds: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
};

const MONTH_RE = "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";
const WEEKDAY_RE = "sun(?:day)?|mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday|s)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?";

// Build a date-only Date at 12:00 UTC. Returns null for impossible dates
// (e.g. 31 Feb — the Date rollover is detected and rejected).
function utcNoon(year: number, month: number, day: number): Date | null {
  const d = new Date(Date.UTC(year, month, day, 12, 0, 0));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month || d.getUTCDate() !== day) {
    return null;
  }
  return d;
}

// Two-digit year → four digits ("26" → 2026).
function expandYear(y: number): number {
  return y < 100 ? 2000 + y : y;
}

// When no year is given, pick the occurrence nearest to the reference date,
// preferring the future: roll to next year only if the date would land more
// than 6 months in the past (mirrors the old parseMilestoneDate behaviour —
// production timelines look forward, but "last Tuesday's shoot" still works).
function resolveYear(month: number, day: number, ref: Date): number {
  let year = ref.getFullYear();
  const candidate = new Date(Date.UTC(year, month, day, 12));
  if (candidate.getTime() < ref.getTime() - 183 * 24 * 3600 * 1000) year += 1;
  return year;
}

// A reference date normalised to 12:00 UTC on its calendar day.
function refNoon(ref: Date): Date {
  return new Date(Date.UTC(ref.getFullYear(), ref.getMonth(), ref.getDate(), 12));
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 24 * 3600 * 1000);
}

/**
 * Parse a human-entered date. Returns a Date at 12:00 UTC on the named day,
 * or null if no date can be found in the text. `referenceDate` (default: now)
 * anchors relative phrases ("tomorrow", "next Monday") and year inference.
 */
export function parseFlexibleDate(text: string, referenceDate?: Date): Date | null {
  const ref = referenceDate ?? new Date();
  const t = (text || "").toLowerCase().trim();
  if (!t) return null;
  const today = refNoon(ref);

  // ── Casual keywords ──
  if (/\btoday\b/.test(t)) return today;
  if (/\btomorrow\b/.test(t)) return addDays(today, 1);
  if (/\byesterday\b/.test(t)) return addDays(today, -1);

  // "in 2 weeks", "in 3 days", "in a week", "in 1 month"
  const inMatch = t.match(/\bin\s+(a|an|\d+)\s+(day|week|month)s?\b/);
  if (inMatch) {
    const n = inMatch[1] === "a" || inMatch[1] === "an" ? 1 : parseInt(inMatch[1], 10);
    if (inMatch[2] === "day") return addDays(today, n);
    if (inMatch[2] === "week") return addDays(today, n * 7);
    // month: same day-of-month N months on (clamped by utcNoon rollover check)
    const m = new Date(today);
    m.setUTCMonth(m.getUTCMonth() + n);
    return m;
  }

  // "next Monday", "this Friday", bare "monday" — but not when the weekday is
  // just a prefix to a full date ("WED 1 JUL" falls through to the day+month
  // matcher below because it contains a month name).
  const hasMonth = new RegExp(`\\b(${MONTH_RE})\\b`).test(t);
  const hasNumericDate = /\d{1,2}[\/\-.]\d{1,2}/.test(t) || /\b\d{4}-\d{2}-\d{2}\b/.test(t);
  if (!hasMonth && !hasNumericDate) {
    const wd = t.match(new RegExp(`\\b(next|this)?\\s*(${WEEKDAY_RE})\\b`));
    if (wd && WEEKDAYS[wd[2]] !== undefined) {
      const target = WEEKDAYS[wd[2]];
      let delta = (target - today.getUTCDay() + 7) % 7;
      // "this Friday" → the upcoming one, today counts. Bare "friday" or
      // "next Friday" → strictly in the future (today rolls a full week).
      if (delta === 0 && wd[1] !== "this") delta = 7;
      return addDays(today, delta);
    }
  }

  // ── ISO: 2026-07-15 ──
  const iso = t.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (iso) {
    return utcNoon(parseInt(iso[1], 10), parseInt(iso[2], 10) - 1, parseInt(iso[3], 10));
  }

  // ── Numeric: 15/07/2026, 07/15/2026, 15.7.26, 15-07-2026 ──
  const num = t.match(/\b(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?\b/);
  if (num) {
    const a = parseInt(num[1], 10);
    const b = parseInt(num[2], 10);
    // Default to UK day-first; flip to month-first only when the day slot
    // can't be a month and the other can (e.g. 07/15/2026).
    let day = a;
    let month = b - 1;
    if (b > 12 && a <= 12) {
      day = b;
      month = a - 1;
    }
    if (month < 0 || month > 11) return null;
    const year = num[3] ? expandYear(parseInt(num[3], 10)) : resolveYear(month, day, ref);
    return utcNoon(year, month, day);
  }

  // ── Day + month name, either order: "15 July 2026", "15th Jul", "July 15th, 2026" ──
  const dayFirst = t.match(
    new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?(?:\\s+of)?\\s+(${MONTH_RE})\\b(?:\\s*,?\\s*(\\d{2,4}))?`)
  );
  const monthFirst = t.match(
    new RegExp(`\\b(${MONTH_RE})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:\\s*,?\\s*(\\d{2,4}))?`)
  );
  const dm = dayFirst
    ? { day: parseInt(dayFirst[1], 10), month: MONTHS[dayFirst[2]], year: dayFirst[3] }
    : monthFirst
    ? { day: parseInt(monthFirst[2], 10), month: MONTHS[monthFirst[1]], year: monthFirst[3] }
    : null;
  if (dm && dm.month !== undefined) {
    const year = dm.year ? expandYear(parseInt(dm.year, 10)) : resolveYear(dm.month, dm.day, ref);
    return utcNoon(year, dm.month, dm.day);
  }

  // ── Bare ordinal day: "the 15th", "15th" → nearest upcoming occurrence ──
  const bare = t.match(/\b(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)\b/);
  if (bare) {
    const day = parseInt(bare[1], 10);
    if (day >= 1 && day <= 31) {
      // This month if still ahead (or today), else next month.
      let month = today.getUTCMonth();
      let year = today.getUTCFullYear();
      if (day < today.getUTCDate()) {
        month += 1;
        if (month > 11) {
          month = 0;
          year += 1;
        }
      }
      // Skip forward past months without this day (e.g. the 31st).
      for (let i = 0; i < 12; i++) {
        const d = utcNoon(year, month, day);
        if (d) return d;
        month += 1;
        if (month > 11) {
          month = 0;
          year += 1;
        }
      }
    }
  }

  return null;
}

export interface FlexibleDateRange {
  start: Date;
  end: Date;
}

/**
 * Parse a date range like "July 20-22", "20-22 July", "20th – 22nd July" or
 * "July 20 to July 22". Returns null when the text isn't a range (callers
 * should then fall back to parseFlexibleDate).
 */
export function parseFlexibleDateRange(
  text: string,
  referenceDate?: Date
): FlexibleDateRange | null {
  const ref = referenceDate ?? new Date();
  const t = (text || "").toLowerCase().trim();
  if (!t) return null;

  // "July 20-22" / "Jul 20 – 22"
  let m = t.match(
    new RegExp(
      `\\b(${MONTH_RE})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\s*(?:[-–—]|to|until)\\s*(\\d{1,2})(?:st|nd|rd|th)?\\b(?:\\s*,?\\s*(\\d{2,4}))?`
    )
  );
  if (m) {
    const month = MONTHS[m[1]];
    const d1 = parseInt(m[2], 10);
    const d2 = parseInt(m[3], 10);
    const year = m[4] ? expandYear(parseInt(m[4], 10)) : resolveYear(month, d1, ref);
    const start = utcNoon(year, month, d1);
    const end = utcNoon(year, month, d2);
    if (start && end && end.getTime() >= start.getTime()) return { start, end };
    return null;
  }

  // "20-22 July" / "20th – 22nd July 2026"
  m = t.match(
    new RegExp(
      `\\b(\\d{1,2})(?:st|nd|rd|th)?\\s*(?:[-–—]|to|until)\\s*(\\d{1,2})(?:st|nd|rd|th)?(?:\\s+of)?\\s+(${MONTH_RE})\\b(?:\\s*,?\\s*(\\d{2,4}))?`
    )
  );
  if (m) {
    const month = MONTHS[m[3]];
    const d1 = parseInt(m[1], 10);
    const d2 = parseInt(m[2], 10);
    const year = m[4] ? expandYear(parseInt(m[4], 10)) : resolveYear(month, d1, ref);
    const start = utcNoon(year, month, d1);
    const end = utcNoon(year, month, d2);
    if (start && end && end.getTime() >= start.getTime()) return { start, end };
    return null;
  }

  // "July 20 to August 2" — two full dates joined by a range word/dash.
  m = t.match(/^(.*?)\s+(?:to|until|through|[-–—])\s+(.+)$/);
  if (m) {
    const start = parseFlexibleDate(m[1], ref);
    // Anchor the end's year inference to the start so "Dec 30 to Jan 2" rolls.
    const end = start ? parseFlexibleDate(m[2], start) : null;
    if (start && end && end.getTime() >= start.getTime()) return { start, end };
  }

  return null;
}

// Any substring that looks like a date (or date range) phrase, so callers can
// lift a date out of running text ("Pre-pro meeting on the 3rd of August" →
// phrase "on the 3rd of August", remainder "Pre-pro meeting").
const DATE_PHRASE_RE = new RegExp(
  `(?:\\bon\\s+)?(?:\\bthe\\s+)?(?:` +
    [
      `\\d{4}-\\d{1,2}-\\d{1,2}`,
      // Month-name forms come before the bare numeric one so a range like
      // "14-16 September 2026" is lifted whole, not truncated to "14-16".
      // "WED 1 JUL", "15th July 2026", "20-22 July", "3rd of August"
      `(?:(?:${WEEKDAY_RE})\\s+)?\\d{1,2}(?:st|nd|rd|th)?(?:\\s*(?:[-–—]|to|until)\\s*\\d{1,2}(?:st|nd|rd|th)?)?(?:\\s+of)?\\s+(?:${MONTH_RE})\\b(?:\\s*,?\\s*\\d{2,4})?`,
      // "July 15", "Jul 20-22, 2026"
      `(?:${MONTH_RE})\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?(?:\\s*(?:[-–—]|to|until)\\s*\\d{1,2}(?:st|nd|rd|th)?)?(?:\\s*,?\\s*\\d{2,4})?`,
      // Numeric: 15/07/2026, 15.7.26, 15-07-2026
      `\\d{1,2}[\\/.-]\\d{1,2}(?:[\\/.-]\\d{2,4})?`,
      // Casual
      `(?:next|this)\\s+(?:${WEEKDAY_RE})\\b`,
      `\\btoday\\b|\\btomorrow\\b`,
      `\\bin\\s+(?:a|an|\\d+)\\s+(?:day|week|month)s?\\b`,
      // Bare ordinal, last (weakest match)
      `\\d{1,2}(?:st|nd|rd|th)\\b`,
    ].join("|") +
    `)`,
  "i"
);

export interface ExtractedDatePhrase {
  /** The matched date text — feed to parseFlexibleDate / parseFlexibleDateRange. */
  phrase: string;
  /** The input with the date phrase removed and edges tidied — usable as a title. */
  remainder: string;
}

/** Find the first date-like phrase in free text, or null. */
export function extractDatePhrase(text: string): ExtractedDatePhrase | null {
  const m = (text || "").match(DATE_PHRASE_RE);
  if (!m || m.index === undefined) return null;
  const remainder = (text.slice(0, m.index) + " " + text.slice(m.index + m[0].length))
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s\-–—:,]+|[\s\-–—:,]+$/g, "")
    .trim();
  return { phrase: m[0], remainder };
}

/** Every day in a range, inclusive, capped to `maxDays` (safety valve). */
export function eachDayInRange(range: FlexibleDateRange, maxDays = 21): Date[] {
  const out: Date[] = [];
  for (
    let d = new Date(range.start.getTime());
    d.getTime() <= range.end.getTime() && out.length < maxDays;
    d = addDays(d, 1)
  ) {
    out.push(new Date(d.getTime()));
  }
  return out;
}
