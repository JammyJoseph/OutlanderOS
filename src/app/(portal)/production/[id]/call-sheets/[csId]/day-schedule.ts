// ═══════════════════════════════════════════════════════════════════════════
// Day-schedule parser — paste a comprehensive timing breakdown, get a clean,
// structured run of the day.
//
// Producers write schedules minute-by-minute, in text, and the dialects vary.
// This understands all of them in one paste:
//
//   1. Slash lines:   10:00 / Look 1 Photo / Barbican 1 / 2 Hero, 1 Detail
//   2. Dash lines:    10:00 - LOOK 1 / LOCATION 1 - PHOTO & VIDEO
//      Either separator after the time; segments are activity / [location] /
//      [notes], with the location recognised rather than positional.
//
//   3. Indented sub-lines, three kinds:
//        60 mins / Setup                → ONE under a block: its duration and
//                                         category, nothing more
//        30 mins / Photo                → SEVERAL under a block: segments of
//        10 mins / Video                  the block. The block's duration is
//        5 mins / Walk back to glam      their sum, and each becomes its own
//                                         minute-by-minute row with a start
//                                         time derived from the block's start
//        09:55 / Talent travel / 5 mins → a timed sub-point, kept as written
//
//   4. Table pastes (tab-separated) and the legacy "08:00 Crew Call" lines.
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
    // "08:00 / Crew Call" and "08:00 - CREW CALL" both leave a leading
    // separator on the remainder — the split below only breaks on separators
    // with whitespace on BOTH sides.
    rest: line.slice(m[0].length).replace(/^[/|·-]\s*/, ''),
  }
}

const timeToMins = (t: string): number | null => {
  const m = t.match(/^(\d{2}):(\d{2})$/)
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null
}

const minsToTime = (mins: number): string => {
  const clamped = ((mins % 1440) + 1440) % 1440
  return `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`
}

export function parseDurationMins(text: string): number | null {
  const m = (text || '').trim().match(DURATION_RE)
  if (!m) return null
  if (m[3] != null) return parseInt(m[3], 10)
  return parseInt(m[1], 10) * 60 + (m[2] ? parseInt(m[2], 10) : 0)
}

// Does a segment read as a place rather than a sentence? Short, no sentence
// punctuation, and not an obvious status or activity phrase. Wrong guesses
// land in the preview where they're one click to fix.
function looksLikeLocation(seg: string): boolean {
  const s = seg.trim()
  if (!s || s.length > 34) return false
  if (/[,.;!?]/.test(s)) return false
  if (
    /\b(complete|done|ready|final|checks?|capture|shoot|arrivals?|arrive|into|prep|set ?up|call|photo|video)\b/i.test(
      s
    )
  )
    return false
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

interface PendingSub {
  dur: number
  label: string
}

export function parseDaySchedule(raw: string): ParsedDaySchedule {
  const text = (raw || '').replace(/\r\n/g, '\n')
  const callTimes: CallTimeRow[] = []
  const schedule: ScheduleItem[] = []
  if (!text.trim()) return { callTimes, schedule }

  let lastMajor: ScheduleItem | null = null
  let pendingSubs: PendingSub[] = []

  // Resolve the buffered duration lines under a block. One line is the
  // producer annotating the block ("60 mins / Setup"); several are the block's
  // internal segments — the block's duration becomes their sum, and each gets
  // its own row with a start time walked forward from the block's start, which
  // is what turns the shorthand into an actual minute-by-minute.
  function flushSubs() {
    if (!lastMajor || pendingSubs.length === 0) {
      pendingSubs = []
      return
    }
    if (pendingSubs.length === 1) {
      const sub = pendingSubs[0]
      lastMajor.durationMins = sub.dur
      const labelled = sub.label ? inferScheduleCategory(sub.label) : null
      if (labelled) lastMajor.category = labelled
    } else {
      lastMajor.durationMins = pendingSubs.reduce((s, x) => s + x.dur, 0)
      let clock = timeToMins(lastMajor.time)
      for (const sub of pendingSubs) {
        schedule.push({
          time: clock != null ? minsToTime(clock) : '',
          description: sub.label || '—',
          notes: '',
          durationMins: sub.dur,
          category: sub.label ? inferScheduleCategory(sub.label) : null,
          location: null,
          minor: true,
        })
        if (clock != null) clock += sub.dur
      }
    }
    pendingSubs = []
  }

  for (const rawLine of text.split('\n')) {
    if (!rawLine.trim()) continue
    const indented = /^[\s ]/.test(rawLine)
    const line = rawLine.replace(/^[\s ]*[-*•]?\s*/, '')

    const timed = parseTime(line)

    // ── Untimed sub-line: "60 mins / Setup" — buffered until the block ends ──
    if (!timed) {
      const segs = splitSegments(line)
      const dur = segs.length > 0 ? parseDurationMins(segs[0]) : null
      if (dur != null && lastMajor) {
        pendingSubs.push({ dur, label: segs.slice(1).join(' · ') })
        continue
      }
      // A plain untimed line: notes continuation for the block above.
      if (lastMajor && line.trim()) {
        lastMajor.notes = [lastMajor.notes, line.trim()].filter(Boolean).join(' ')
      }
      continue
    }

    // ── Timed line ──
    // A new major block closes the previous one's buffer first.
    if (!indented) flushSubs()

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
      // "LOCATION 1 - PHOTO & VIDEO": the dash splits a place from what
      // happens there.
      const dashSplit = !item.location && seg.includes(' - ') ? seg.split(/\s+-\s+/) : null
      if (dashSplit && dashSplit.length >= 2 && looksLikeLocation(dashSplit[0])) {
        item.location = dashSplit[0].trim()
        item.notes = [item.notes, dashSplit.slice(1).join(' - ').trim()].filter(Boolean).join(' · ')
      } else if (!item.location && looksLikeLocation(seg)) {
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

  flushSubs()
  return { callTimes, schedule }
}

// ── Derived buffers and overruns ────────────────────────────────────────────
//
// Unaccounted time between blocks, computed at render time and never stored.
// Storing buffer rows would strand them stale the moment someone edits a time;
// deriving them means the day always adds up against what's actually written.
//
// For each timed block with a duration, the gap to the next timed block is
// either a BUFFER (positive slack, shown as its own row so it reads as owned
// time rather than a silent hole) or an OVERRUN (the block runs past the next
// start — the thing a timekeeper most needs to see before it happens on set).
// Blocks without a duration make the gap unknowable, so nothing is invented.

export type DayRow = ScheduleItem & { synthetic?: 'buffer' | 'overrun' }

export function withDerivedBuffers(sorted: ScheduleItem[]): DayRow[] {
  const out: DayRow[] = []

  // Majors carry the occupancy; minors live inside their block's span.
  const majors = sorted.filter((s) => !s.minor && s.time)

  for (let i = 0; i < sorted.length; i++) {
    const item = sorted[i]
    out.push(item)

    if (item.minor || !item.time || item.durationMins == null) continue
    const mi = majors.indexOf(item)
    const next = mi >= 0 ? majors[mi + 1] : undefined
    if (!next) continue

    const start = timeToMins(item.time)
    const nextStart = timeToMins(next.time)
    if (start == null || nextStart == null) continue

    // A block occupies until the later of its own span and its trailing
    // minors' — an explicit "09:55 / Talent travel / 5 mins" sub-point fills
    // the slot it names, and flagging it as unaccounted would be crying wolf.
    let endsAt = start + item.durationMins
    for (let j = i + 1; j < sorted.length && sorted[j].minor; j++) {
      const m = sorted[j]
      const mStart = m.time ? timeToMins(m.time) : null
      if (mStart != null && m.durationMins != null) {
        endsAt = Math.max(endsAt, mStart + m.durationMins)
      }
    }
    const gap = nextStart - endsAt
    if (gap === 0) continue

    // Emit after the block's minors so the row sits where the time actually is.
    let insertAfter = i
    while (insertAfter + 1 < sorted.length && sorted[insertAfter + 1].minor) insertAfter++
    while (out[out.length - 1] !== sorted[insertAfter]) {
      out.push(sorted[++i])
    }

    if (gap > 0) {
      out.push({
        time: minsToTime(endsAt),
        description: 'Buffer',
        notes: `${gap} min unaccounted before ${next.description || next.time}`,
        durationMins: gap,
        category: 'BUFFER',
        location: null,
        minor: true,
        synthetic: 'buffer',
      })
    } else {
      out.push({
        time: next.time,
        description: 'Overrun',
        notes: `${item.description || 'the block above'} runs ${-gap} min past this start`,
        durationMins: -gap,
        category: null,
        location: null,
        minor: true,
        synthetic: 'overrun',
      })
    }
  }

  return out
}
