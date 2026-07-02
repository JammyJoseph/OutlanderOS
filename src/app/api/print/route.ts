import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { getToken, setToken } from '@/lib/token-store'
import { withAuth } from '@/lib/auth'

const SHEET_ID = '1INpLAczQSTp0RdLV2_bPHC_2xO_Jhwy6MUDR2aALjZw'
const CACHE_TTL_MS = 5 * 60 * 1000

type PrintData = {
  fetchedAt: string
  sheetTitle: string | null
  sheetNames: string[]
  issues: string[]
  timeline: TimelineMilestone[]
  features: Feature[]
  adSlots: AdSlot[]
  flatPlan: FlatPlanSpread[]
  paidFeatures: PaidFeature[]
  contentTracker: ContentTrackerRow[]
  error: string | null
  connected: boolean
}

type TimelineMilestone = {
  label: string
  issue: string
  date: string
  rawDate: string
  status: 'past' | 'today' | 'future'
}

type Feature = {
  iconType: string
  name: string
  description: string
  confirmed: string
  category: string
  status: string
  contact: string
  notes: string
}

type AdSlot = {
  slot: string
  brand: string
  format: string
  confirmed: string
  category: string
  status: string
  contact: string
  assetsReceived: string
  interviewDone: string
  readyForDesign: string
  notes: string
}

type FlatPlanSpread = {
  pages: string
  content: string
  category: string
}

type PaidFeature = {
  type: '360 Deal' | 'Advertorial'
  brand: string
  status: string
  notes: string
}

type ContentTrackerRow = {
  ad: string
  assetsReceived: string
  interviewDone: string
  readyForDesign: string
  notes: string
  status: string
}

let cache: { data: PrintData; expires: number } | null = null

function buildAuthClient(): { sheets: ReturnType<typeof google.sheets> | null; mode: 'oauth' | 'service' | 'none' } {
  // Prefer OAuth token from token store (matches existing dashboard pattern)
  const tokenData = getToken('google_primary') || getToken('google_billing') || getToken('google_operations')
  if (tokenData) {
    const client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    )
    client.setCredentials(tokenData)
    client.on('tokens', (newTokens) => {
      const updated = { ...tokenData, ...newTokens }
      setToken('google_primary', updated)
    })
    return { sheets: google.sheets({ version: 'v4', auth: client }), mode: 'oauth' }
  }

  // Fall back to service account if configured
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  if (email && key) {
    const jwt = new google.auth.JWT({
      email,
      key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    })
    return { sheets: google.sheets({ version: 'v4', auth: jwt }), mode: 'service' }
  }

  return { sheets: null, mode: 'none' }
}

function emptyData(error: string | null, connected: boolean): PrintData {
  return {
    fetchedAt: new Date().toISOString(),
    sheetTitle: null,
    sheetNames: [],
    issues: ['Issue 01', 'Issue 02'],
    timeline: [],
    features: [],
    adSlots: [],
    flatPlan: [],
    paidFeatures: [],
    contentTracker: [],
    error,
    connected,
  }
}

function parseDate(raw: string): { iso: string; status: 'past' | 'today' | 'future' } {
  if (!raw) return { iso: '', status: 'future' }
  const cleaned = raw.replace(/(st|nd|rd|th)/gi, '').trim()
  const d = new Date(cleaned)
  if (isNaN(d.getTime())) return { iso: '', status: 'future' }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(d)
  target.setHours(0, 0, 0, 0)
  if (target.getTime() < today.getTime()) return { iso: d.toISOString(), status: 'past' }
  if (target.getTime() === today.getTime()) return { iso: d.toISOString(), status: 'today' }
  return { iso: d.toISOString(), status: 'future' }
}

function findHeaderRow(rows: string[][], hints: string[]): number {
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const row = rows[i] || []
    const joined = row.join(' ').toLowerCase()
    if (hints.some((h) => joined.includes(h.toLowerCase()))) return i
  }
  return -1
}

function pickColumn(headers: string[], names: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    const h = (headers[i] || '').toLowerCase().trim()
    if (names.some((n) => h.includes(n.toLowerCase()))) return i
  }
  return -1
}

async function readRange(
  sheets: ReturnType<typeof google.sheets>,
  range: string
): Promise<string[][]> {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range,
    })
    return (res.data.values as string[][]) || []
  } catch {
    return []
  }
}

function parseTimeline(rows: string[][]): TimelineMilestone[] {
  if (!rows.length) return []
  // Find the row with "Issue 01" / "Issue 02" headers
  let issueColRow = -1
  let issue01Col = -1
  let issue02Col = -1
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const row = rows[i] || []
    for (let j = 0; j < row.length; j++) {
      const cell = (row[j] || '').toString().toUpperCase()
      if (cell.includes('ISSUE 01') || cell.includes('ISSUE 1')) {
        issue01Col = j
        issueColRow = i
      }
      if (cell.includes('ISSUE 02') || cell.includes('ISSUE 2')) {
        issue02Col = j
        if (issueColRow === -1) issueColRow = i
      }
    }
    if (issue01Col >= 0 || issue02Col >= 0) break
  }

  const milestones: TimelineMilestone[] = []
  if (issueColRow === -1) {
    // Fallback: assume column 0 = label, column 1 = Issue 01, column 2 = Issue 02
    issueColRow = 0
    issue01Col = 1
    issue02Col = 2
  }

  for (let i = issueColRow + 1; i < rows.length; i++) {
    const row = rows[i] || []
    // Find label - first non-empty cell before the issue cols
    let label = ''
    for (let j = 0; j < Math.max(issue01Col, issue02Col); j++) {
      if (row[j] && row[j].toString().trim()) {
        label = row[j].toString().trim()
        break
      }
    }
    if (!label) continue
    if (issue01Col >= 0 && row[issue01Col]) {
      const raw = row[issue01Col].toString().trim()
      const { iso, status } = parseDate(raw)
      milestones.push({ label, issue: 'Issue 01', date: iso, rawDate: raw, status })
    }
    if (issue02Col >= 0 && row[issue02Col]) {
      const raw = row[issue02Col].toString().trim()
      const { iso, status } = parseDate(raw)
      milestones.push({ label, issue: 'Issue 02', date: iso, rawDate: raw, status })
    }
  }

  return milestones
}

function parseFeatures(rows: string[][]): Feature[] {
  if (!rows.length) return []
  const headerRow = findHeaderRow(rows, ['feature name', 'feature', 'icon type'])
  if (headerRow === -1) return []
  const headers = rows[headerRow] || []
  const idx = {
    iconType: pickColumn(headers, ['icon type', 'type']),
    name: pickColumn(headers, ['feature name', 'name', 'title']),
    description: pickColumn(headers, ['description', 'desc']),
    confirmed: pickColumn(headers, ['confirmed', 'confirm']),
    category: pickColumn(headers, ['category']),
    status: pickColumn(headers, ['status']),
    contact: pickColumn(headers, ['contact']),
    notes: pickColumn(headers, ['notes', 'note']),
  }
  const features: Feature[] = []
  for (let i = headerRow + 1; i < rows.length; i++) {
    const row = rows[i] || []
    const name = idx.name >= 0 ? (row[idx.name] || '').toString().trim() : ''
    const iconType = idx.iconType >= 0 ? (row[idx.iconType] || '').toString().trim() : ''
    if (!name && !iconType) continue
    if (!name) continue
    features.push({
      iconType,
      name,
      description: idx.description >= 0 ? (row[idx.description] || '').toString().trim() : '',
      confirmed: idx.confirmed >= 0 ? (row[idx.confirmed] || '').toString().trim() : '',
      category: idx.category >= 0 ? (row[idx.category] || '').toString().trim() : '',
      status: idx.status >= 0 ? (row[idx.status] || '').toString().trim() : '',
      contact: idx.contact >= 0 ? (row[idx.contact] || '').toString().trim() : '',
      notes: idx.notes >= 0 ? (row[idx.notes] || '').toString().trim() : '',
    })
  }
  return features
}

function parseAdBookings(rows: string[][]): AdSlot[] {
  if (!rows.length) return []
  const headerRow = findHeaderRow(rows, ['brand', 'format', 'confirmed'])
  if (headerRow === -1) return []
  const headers = rows[headerRow] || []
  const idx = {
    brand: pickColumn(headers, ['brand']),
    format: pickColumn(headers, ['format']),
    confirmed: pickColumn(headers, ['confirmed', 'confirm']),
    category: pickColumn(headers, ['category']),
    status: pickColumn(headers, ['status']),
    contact: pickColumn(headers, ['contact']),
    notes: pickColumn(headers, ['notes', 'note']),
  }
  const slots: AdSlot[] = []
  let n = 1
  for (let i = headerRow + 1; i < rows.length; i++) {
    const row = rows[i] || []
    const brand = idx.brand >= 0 ? (row[idx.brand] || '').toString().trim() : ''
    if (!brand) continue
    slots.push({
      slot: `Ad #${n++}`,
      brand,
      format: idx.format >= 0 ? (row[idx.format] || '').toString().trim() : '',
      confirmed: idx.confirmed >= 0 ? (row[idx.confirmed] || '').toString().trim() : '',
      category: idx.category >= 0 ? (row[idx.category] || '').toString().trim() : '',
      status: idx.status >= 0 ? (row[idx.status] || '').toString().trim() : '',
      contact: idx.contact >= 0 ? (row[idx.contact] || '').toString().trim() : '',
      assetsReceived: '',
      interviewDone: '',
      readyForDesign: '',
      notes: idx.notes >= 0 ? (row[idx.notes] || '').toString().trim() : '',
    })
  }
  return slots
}

function parseFlatPlan(rows: string[][]): FlatPlanSpread[] {
  if (!rows.length) return []
  const spreads: FlatPlanSpread[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    if (!row) continue
    const cells = row.map((c) => (c == null ? '' : c.toString().trim())).filter(Boolean)
    for (const cell of cells) {
      // Match patterns like "FOB: RICK RUBIN 132-137" or just "page 102-105" + content
      const pageMatch = cell.match(/(\d+)\s*[-–]\s*(\d+)/)
      if (!pageMatch) continue
      const pages = `${pageMatch[1]}-${pageMatch[2]}`
      const content = cell.replace(pageMatch[0], '').trim().replace(/^[:\-–\s]+|[:\-–\s]+$/g, '')
      if (!content) continue
      const key = `${pages}:${content}`
      if (seen.has(key)) continue
      seen.add(key)
      const upper = content.toUpperCase()
      let category = 'Other'
      if (upper.includes('FOB')) category = 'FOB'
      else if (upper.includes('FASHION')) category = 'Fashion'
      else if (upper.includes('COMMUNITY')) category = 'Community'
      else if (upper.includes('SPONSOR') || upper.includes('AD') || upper.includes('SP/DPS')) category = 'Sponsored'
      else if (upper.includes('FEATURE')) category = 'Feature'
      else if (upper.includes('CULINARY')) category = 'Culinary'
      else if (upper.includes('COVER')) category = 'Cover'
      spreads.push({ pages, content, category })
    }
  }
  // Sort by starting page number
  spreads.sort((a, b) => parseInt(a.pages) - parseInt(b.pages))
  return spreads
}

function parsePaidFeatures(rows: string[][]): PaidFeature[] {
  if (!rows.length) return []
  const out: PaidFeature[] = []
  let currentSection: '360 Deal' | 'Advertorial' = '360 Deal'
  for (const row of rows) {
    if (!row || !row.length) continue
    const first = (row[0] || '').toString().trim()
    const upper = first.toUpperCase()
    if (upper.includes('360')) {
      currentSection = '360 Deal'
      continue
    }
    if (upper.includes('ADVERTORIAL')) {
      currentSection = 'Advertorial'
      continue
    }
    if (!first || upper === 'BRAND' || upper === 'STATUS') continue
    // skip header rows
    if (upper === 'NAME' || upper.includes('SECTION')) continue
    const status = (row[1] || row[2] || '').toString().trim()
    if (!status) continue
    out.push({
      type: currentSection,
      brand: first,
      status,
      notes: (row[3] || row[2] || '').toString().trim(),
    })
  }
  return out
}

function parseContentTracker(rows: string[][]): ContentTrackerRow[] {
  if (!rows.length) return []
  const headerRow = findHeaderRow(rows, ['assets received', 'ready for design', 'interview'])
  if (headerRow === -1) return []
  const headers = rows[headerRow] || []
  const idx = {
    ad: pickColumn(headers, ['ad', 'name', 'section']),
    assetsReceived: pickColumn(headers, ['assets received', 'assets']),
    interviewDone: pickColumn(headers, ['interview']),
    readyForDesign: pickColumn(headers, ['ready for design', 'ready']),
    notes: pickColumn(headers, ['notes']),
    status: pickColumn(headers, ['status']),
  }
  const out: ContentTrackerRow[] = []
  for (let i = headerRow + 1; i < rows.length; i++) {
    const row = rows[i] || []
    const ad = idx.ad >= 0 ? (row[idx.ad] || '').toString().trim() : (row[0] || '').toString().trim()
    if (!ad) continue
    out.push({
      ad,
      assetsReceived: idx.assetsReceived >= 0 ? (row[idx.assetsReceived] || '').toString().trim() : '',
      interviewDone: idx.interviewDone >= 0 ? (row[idx.interviewDone] || '').toString().trim() : '',
      readyForDesign: idx.readyForDesign >= 0 ? (row[idx.readyForDesign] || '').toString().trim() : '',
      notes: idx.notes >= 0 ? (row[idx.notes] || '').toString().trim() : '',
      status: idx.status >= 0 ? (row[idx.status] || '').toString().trim() : '',
    })
  }
  return out
}

function pickSheetName(names: string[], hints: string[]): string | null {
  const lower = names.map((n) => n.toLowerCase())
  for (const hint of hints) {
    const match = lower.findIndex((n) => n.includes(hint.toLowerCase()))
    if (match >= 0) return names[match]
  }
  return null
}

async function fetchPrintData(): Promise<PrintData> {
  const { sheets, mode } = buildAuthClient()
  if (!sheets || mode === 'none') {
    return emptyData('Google Sheets not connected. Connect Google account in Admin → Settings.', false)
  }

  let meta
  try {
    const res = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID })
    meta = res.data
  } catch (err: unknown) {
    const msg = 'Failed to load sheet metadata'
    return emptyData(msg, true)
  }

  const sheetTitle = meta.properties?.title ?? null
  const sheetNames = (meta.sheets || []).map((s) => s.properties?.title || '').filter(Boolean)

  const tabs = {
    timeline: pickSheetName(sheetNames, ['proposed timeline', 'timeline', 'schedule']),
    features: pickSheetName(sheetNames, ['content plan', 'features', 'editorial']),
    ads: pickSheetName(sheetNames, ['ad bookings', 'ads', 'advertising']),
    flatPlan: pickSheetName(sheetNames, ['flat plan', 'flatplan']),
    contentTracker: pickSheetName(sheetNames, ['content tracker', 'rate card', 'tracker']),
    paidFeatures: pickSheetName(sheetNames, ['paid features', '360', 'advertorial']),
  }

  const [timelineRows, featureRows, adRows, flatRows, trackerRows, paidRows] = await Promise.all([
    tabs.timeline ? readRange(sheets, `'${tabs.timeline}'!A1:Z200`) : Promise.resolve([] as string[][]),
    tabs.features ? readRange(sheets, `'${tabs.features}'!A1:Z500`) : Promise.resolve([] as string[][]),
    tabs.ads ? readRange(sheets, `'${tabs.ads}'!A1:Z200`) : Promise.resolve([] as string[][]),
    tabs.flatPlan ? readRange(sheets, `'${tabs.flatPlan}'!A1:Z500`) : Promise.resolve([] as string[][]),
    tabs.contentTracker ? readRange(sheets, `'${tabs.contentTracker}'!A1:Z200`) : Promise.resolve([] as string[][]),
    tabs.paidFeatures ? readRange(sheets, `'${tabs.paidFeatures}'!A1:Z200`) : Promise.resolve([] as string[][]),
  ])

  return {
    fetchedAt: new Date().toISOString(),
    sheetTitle,
    sheetNames,
    issues: ['Issue 01', 'Issue 02'],
    timeline: parseTimeline(timelineRows),
    features: parseFeatures(featureRows),
    adSlots: parseAdBookings(adRows),
    flatPlan: parseFlatPlan(flatRows),
    paidFeatures: parsePaidFeatures(paidRows),
    contentTracker: parseContentTracker(trackerRows),
    error: null,
    connected: true,
  }
}

export const GET = withAuth(async (request: Request) => {
  const url = new URL(request.url)
  const force = url.searchParams.get('refresh') === 'true'

  if (!force && cache && cache.expires > Date.now()) {
    return NextResponse.json({ ...cache.data, cached: true })
  }

  try {
    const data = await fetchPrintData()
    cache = { data, expires: Date.now() + CACHE_TTL_MS }
    return NextResponse.json({ ...data, cached: false })
  } catch (err: unknown) {
    const msg = 'Unknown error'
    return NextResponse.json({ ...emptyData(msg, false), cached: false }, { status: 200 })
  }
})
