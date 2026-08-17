// ═══════════════════════════════════════════════════════════════════════════
// Day-schedule parser — paste a comprehensive timing breakdown, get a clean,
// structured run of the day.
//
// Producers write schedules minute-by-minute, in text, and the formats vary by
// where the text came from. This understands all of them in one paste:
//
//   1. Slash lines (how a producer types it):
//        10:00 / Look 1 Photo / Barbican 1 / 2 Hero, 1 Product Detail, 2 BTS
//      Segments are time / activity / [location] / [notes] — the location is
//      recognised, not positional, because half the lines don't have one.
//
//   2. Indented sub-lines, two kinds:
//        60 mins / Crew prep              → duration + category for the block above
//        09:55 / Talent to Location 1 / 5 mins  → its own minor row between key timings
//
//   3. Table pastes (copying a schedule grid out of a doc or sheet gives
//      tab-separated lines):  08:00 <TAB> 60 min <TAB> CREW CALL <TAB> notes
//
//   4. Legacy plain lines ("08:00 Crew Call") — the format the old importer
//      accepted keeps working.
//
// Call-time rows (crew call, talent call, wrap…) are ALSO emitted as CallTimes
// entries but stay in the schedule: the Call Times block is the at-a-glance
// summary, the Day Schedule is the full run, and real sheets carry both.
// ═══════════════════════════════════════════════════════════════════════════

import {
  type CallTimeRow,
  type ScheduleItem,
  inferScheduleCategory,
  isCallTimeLabel,
} from './types'

export interface ParsedDaySchedule {
  callTimes: CallTimeRow[]
  schedule: ScheduleItem[]
}

const TIME_RE = /^(\d{1,2})[:.](\d{2})\s*/
// "60 min" / "60 mins" / "1h" / "1h30" / "90m"
const DURATION_RE = /^(?:(\d+)\s*h(?:ours?)?\s*(\d+)?\s*m?(?:ins?)?|(\d+)\s*m(?:ins?)?)\s*$/i

function parseTime(line: string): { time: string; rest: string } | null {
  const m = line.match(TIME_RE)
  if (!m) return null
  const h = parseInt(m[1], 10)
  const min = parseInt(m[2], 10)
  if (h > 23 || min > 59) return null
  return {
    time: `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`,
    // "08:00 / Crew Call" leaves a leading separator on the remainder — the
    // split below only breaks on slashes with whitespace on BOTH sides.
    rest: line.slice(m[0].length).replace(/^[/|\u00b7-]\s*/, ''),
  }
}

export function parseDurationMins(text: string): number | null {
  const m = (text || '').trim().match(DURATION_RE)
  if (!m) return null
  if (m[3] != null) return parseInt(m[3], 10)
  return parseInt(m[1], 10) * 60 + (m[2] ? parseInt(m[2], 10) : 0)
}

// Does a segment read as a place rather than a sentence? Short, no sentence
// punctuation, and not an obvious status phrase. Wrong guesses land in the
// preview where they're one click to fix, so this favours simplicity.
function looksLikeLocation(seg: string): boolean {
  const s = seg.trim()
  if (!s || s.length > 34) return false
  if (/[,.;!?]/.test(s)) return false
  if (/\b(complete|done|ready|final|checks?|capture|shoot|arrivals?|arrive|into|prep|set ?up|call)\b/i.test(s)) return false
  // "Look 2" after a look-change row is the look, not a place.
  if (/^look\s*\d+$/i.test(s)) return false
  return true
}

function splitSegments(rest: string): string[] {
  // Tabs win (a pasted table); otherwise slashes with breathing room. A bare
  // "/" inside a word ("HMUA/Look 1") must not split, hence the space test.
  if (rest.includes('\t')) return rest.split('\t').map((s) => s.trim()).filter(Boolean)
  return rest.split(/\s+\/\s+|\s+\|\s+/).map((s) => s.trim()).filter(Boolean)
}

export function parseDaySchedule(raw: string): ParsedDaySchedule {
  const text = (raw || '').replace(/\r\n/g, '\n')
  const callTimes: CallTimeRow[] = []
  const schedule: ScheduleItem[] = []
  if (!text.trim()) return { callTimes, schedule }

  let lastMajor: ScheduleItem | null = null

  for (const rawLine of text.split('\n')) {
    if (!rawLine.trim()) continue
    const indented = /^[\s ]/.test(rawLine)
    const line = rawLine.replace(/^[\s ]*[-*•]?\s*/, '')

    const timed = parseTime(line)

    // ── Duration sub-line: "60 mins / Crew prep" ──
    if (!timed) {
      const segs = splitSegments(line)
      const dur = segs.length > 0 ? parseDurationMins(segs[0]) : null
      if (dur != null && lastMajor) {
        lastMajor.durationMins = dur
        // The sub-line's label ("60 mins / Crew prep") is the producer saying
        // what kind of time this is — it beats anything guessed from notes.
        const label = segs.slice(1).join(' · ')
        const labelled = label ? inferScheduleCategory(label) : null
        if (labelled) lastMajor.category = labelled
        continue
      }
      // A plain untimed line: notes continuation for the block above.
      if (lastMajor && line.trim()) {
        lastMajor.notes = [lastMajor.notes, line.trim()].filter(Boolean).join(' ')
      }
      continue
    }

    // ── Timed line ──
    const segs = splitSegments(timed.rest)
    if (segs.length === 0) continue

    const item: ScheduleItem = {
      time: timed.time,
      description: segs[0],
      notes: '',
      durationMins: null,
      category: null,
      location: null,
      // Indented timed lines are the sub-points between key timings.
      minor: indented,
    }

    // Remaining segments: pull out a trailing duration ("… / 5 mins"), then
    // decide location vs notes for what's left.
    const restSegs = segs.slice(1)
    if (restSegs.length > 0) {
      const trailingDur = parseDurationMins(restSegs[restSegs.length - 1])
      if (trailingDur != null) {
        item.durationMins = trailingDur
        restSegs.pop()
      }
    }
    // Table pastes put the duration as its own second column, before the title:
    // time <TAB> 60 min <TAB> ACTIVITY. In that case segs[0] parsed as a
    // duration, and the real title is the next segment.
    const leadingDur = parseDurationMins(item.description)
    if (leadingDur != null && restSegs.length > 0) {
      item.durationMins = leadingDur
      item.description = restSegs.shift()!
    }

    for (const seg of restSegs) {
      if (!item.location && looksLikeLocation(seg)) {
        item.location = seg
      } else {
        item.notes = [item.notes, seg].filter(Boolean).join(' · ')
      }
    }

    // For table pastes the location often leads the notes: "Barbican 1. Capture…"
    if (!item.location && item.notes) {
      const m = item.notes.match(/^([^.·]{2,34})\.\s+(.*)$/)
      if (m && looksLikeLocation(m[1])) {
        item.location = m[1].trim()
        item.notes = m[2].trim()
      }
    }

    // The activity name is the strongest signal; notes only break ties, so
    // "Crew Call" with "styling setup" in its notes stays crew time.
    item.category =
      inferScheduleCategory(item.description) ?? inferScheduleCategory(item.notes) ?? null

    // Call-time-ish rows feed the summary block too, but stay in the run —
    // real sheets show CREW CALL both as a call time and as the day's first row.
    if (!indented && isCallTimeLabel(item.description)) {
      callTimes.push({ time: item.time, department: item.description })
    }

    schedule.push(item)
    if (!indented) lastMajor = item
  }

  return { callTimes, schedule }
}
