import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withAuth } from '@/lib/auth'
import { sanitizeString } from '@/lib/validate'
import {
  extractSheetId,
  getSpreadsheetMetadata,
  readRange,
} from '@/lib/google-sheets'
import { CONTACT_CATEGORIES } from '@/lib/directory'

// The master contact list shared by the team.
const DEFAULT_SHEET =
  '1RJFla1KOPRWN0-ue9H6clQ5bWuYEuo1RSHD6K8Zy2hY'

// Maps a header cell to a contact field, trying common naming variations.
// Each entry lists substrings — the first header that matches wins for that field.
const FIELD_MATCHERS: { field: string; needles: string[] }[] = [
  { field: 'name', needles: ['full name', 'contact name', 'name'] },
  { field: 'company', needles: ['company', 'brand', 'agency', 'organisation', 'organization', 'studio'] },
  { field: 'role', needles: ['role', 'title', 'position', 'discipline', 'job'] },
  { field: 'email', needles: ['e-mail', 'email'] },
  { field: 'phone', needles: ['phone', 'mobile', 'tel', 'number', 'whatsapp', 'cell'] },
  { field: 'instagram', needles: ['instagram', 'insta', ' ig', 'ig ', 'ig handle', 'handle', '@'] },
  { field: 'category', needles: ['category', 'type', 'group'] },
  { field: 'location', needles: ['location', 'city', 'based', 'country', 'region'] },
  { field: 'website', needles: ['website', 'portfolio', 'site', 'url', 'web', 'link'] },
  { field: 'notes', needles: ['notes', 'note', 'comment', 'detail'] },
]

function normaliseHeader(h: string): string {
  return h.trim().toLowerCase()
}

// Builds { field -> column index } from the header row.
function mapColumns(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {}
  const used = new Set<number>()
  for (const { field, needles } of FIELD_MATCHERS) {
    let bestIdx = -1
    for (let i = 0; i < headers.length; i++) {
      if (used.has(i)) continue
      const h = normaliseHeader(headers[i])
      if (!h) continue
      if (needles.some((n) => h === n.trim() || h.includes(n.trim()))) {
        bestIdx = i
        break
      }
    }
    if (bestIdx >= 0) {
      map[field] = bestIdx
      used.add(bestIdx)
    }
  }
  return map
}

// Best-effort match of a free-text category to the canonical list.
function canonicalCategory(raw: string | undefined): string {
  if (!raw) return 'Other'
  const v = raw.trim()
  if (!v) return 'Other'
  const lower = v.toLowerCase()
  const exact = CONTACT_CATEGORIES.find((c) => c.toLowerCase() === lower)
  if (exact) return exact
  const partial = CONTACT_CATEGORIES.find(
    (c) => lower.includes(c.toLowerCase()) || c.toLowerCase().includes(lower)
  )
  return partial ?? v.slice(0, 80)
}

function cleanCell(v: string | undefined): string {
  return (v ?? '').toString().trim()
}

function dedupeKey(name: string, email: string): string {
  return `${name.trim().toLowerCase()}|${email.trim().toLowerCase()}`
}

// POST /api/directory/import-sheet
// Body: { sheetId?: string }  — reads the master contact sheet and upserts Contacts.
export const POST = withAuth(async (request: NextRequest, _ctx, user) => {
  let body: { sheetId?: string } = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const spreadsheetId = extractSheetId(
    (body.sheetId && body.sheetId.trim()) || DEFAULT_SHEET
  )

  let rows: string[][]
  let sheetTitle = 'Sheet1'
  try {
    const meta = await getSpreadsheetMetadata(spreadsheetId)
    sheetTitle = meta.sheetNames[0] || 'Sheet1'
    rows = await readRange(spreadsheetId, `${sheetTitle}!A1:Z`)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const hint = /credential|GOOGLE_|permission|denied|auth/i.test(message)
      ? 'Check the Google service-account credentials and that the sheet is shared with the service account.'
      : undefined
    return NextResponse.json(
      { error: `Could not read the Google Sheet: ${message}`, hint },
      { status: 502 }
    )
  }

  if (!rows.length) {
    return NextResponse.json(
      { error: 'The sheet appears to be empty.' },
      { status: 400 }
    )
  }

  const headers = rows[0]
  const cols = mapColumns(headers)
  if (cols.name === undefined) {
    return NextResponse.json(
      {
        error:
          'Could not find a "Name" column in the sheet. The first row must contain headers.',
        headersSeen: headers,
      },
      { status: 400 }
    )
  }

  // Existing contacts (directory only) for dedup by name+email.
  const existing = await prisma.contact.findMany({
    where: { isRadar: false },
    select: { id: true, name: true, email: true },
  })
  const byKey = new Map<string, string>() // dedupeKey -> contact id
  const byName = new Map<string, string>() // name only -> contact id (fallback)
  for (const c of existing) {
    byKey.set(dedupeKey(c.name, c.email ?? ''), c.id)
    if (!byName.has(c.name.trim().toLowerCase())) {
      byName.set(c.name.trim().toLowerCase(), c.id)
    }
  }

  let imported = 0
  let updated = 0
  let skipped = 0

  for (const row of rows.slice(1)) {
    const get = (field: string) =>
      cols[field] !== undefined ? cleanCell(row[cols[field]]) : ''

    const name = get('name')
    if (!name) {
      skipped++
      continue
    }

    const email = get('email')
    let instagram = get('instagram')
    if (instagram) {
      // Normalise IG handles: strip URL noise, keep @handle.
      instagram = instagram
        .replace(/https?:\/\/(www\.)?instagram\.com\//i, '@')
        .replace(/\/.*$/, '')
        .trim()
      if (instagram && !instagram.startsWith('@') && !instagram.includes('.'))
        instagram = `@${instagram}`
    }

    const data = {
      name: sanitizeString(name, 200),
      email: email ? sanitizeString(email, 320) : null,
      phone: get('phone') ? sanitizeString(get('phone'), 50) : null,
      company: get('company') ? sanitizeString(get('company'), 200) : null,
      role: get('role') ? sanitizeString(get('role'), 120) : null,
      category: canonicalCategory(get('category')),
      instagram: instagram ? sanitizeString(instagram, 120) : null,
      website: get('website') ? sanitizeString(get('website'), 300) : null,
      location: get('location') ? sanitizeString(get('location'), 160) : null,
      notes: get('notes') ? sanitizeString(get('notes'), 4000) : null,
    }

    const existingId =
      byKey.get(dedupeKey(name, email)) ??
      (email ? undefined : byName.get(name.trim().toLowerCase()))

    if (existingId) {
      // Update: only overwrite fields that have a value in the sheet,
      // so we never blank-out richer data already in the directory.
      const patch: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(data)) {
        if (k === 'category') {
          if (v && v !== 'Other') patch[k] = v
        } else if (v) {
          patch[k] = v
        }
      }
      await prisma.contact.update({ where: { id: existingId }, data: patch })
      updated++
    } else {
      const created = await prisma.contact.create({
        data: { ...data, isRadar: false, createdBy: user.userId },
        select: { id: true },
      })
      byKey.set(dedupeKey(name, email), created.id)
      byName.set(name.trim().toLowerCase(), created.id)
      imported++
    }
  }

  return NextResponse.json({
    ok: true,
    sheetTitle,
    imported,
    updated,
    skipped,
    total: imported + updated,
  })
})
