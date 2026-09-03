// ═══════════════════════════════════════════════════════════════════════════
// The live credit sheet — two tabs, rewritten whenever a credit is signed.
//
//   Tracker  every person on the list, whether they have answered or not, with
//            a tick box for who has. This is the working view: who to chase,
//            what they confirmed, where the gaps are.
//   Credits  only the signed ones, only the columns that print. This is what
//            the designer needs and nothing else.
//
// Both live in one file because one URL is easier to hand over than two, and
// because the print view has to be derivable from the tracker at a glance —
// if they disagree, the tracker is right.
//
// Five decisions worth knowing:
//
//  1. **It writes with one person's Google grant, remembered on the row.** A
//     contributor confirming their credit is an anonymous request — there is no
//     user to borrow tokens from — so the setup user's grant is stored and
//     reused. If they disconnect Google, syncing stops and says so rather than
//     reaching for somebody else's Drive.
//
//  2. **Rewrite, never append.** Both tabs are projections of the ledger: rows
//     below the header are cleared and rewritten each time, so a withdrawn
//     credit actually leaves and a corrected name actually changes. An
//     append-only sheet would print somebody who pulled out.
//
//  3. **Confirmed values win, and gaps stay visible.** Each cell shows what the
//     contributor confirmed; where they haven't answered, it shows what the
//     sheet believed, and where nobody knows, it stays empty. A blank
//     description is information — it is the thing still outstanding.
//
//  4. **Postal addresses are never written here.** The agreement promises the
//     address is used for delivery and never shared, and this file gets shared.
//     Emails are included: chasing 35 people with no usable address is the
//     work this tab exists to support.
//
//  5. **Sheets needs its own scope.** A token holding only `auth/drive` gets
//     403 "insufficient authentication scopes", so `auth/spreadsheets` is in
//     GOOGLE_USER_SCOPES and a 403 here is reported as "reconnect Google",
//     never as a server fault.
// ═══════════════════════════════════════════════════════════════════════════

import { google, type sheets_v4 } from 'googleapis'
import prisma from '@/lib/prisma'
import { bioLimitForTier } from '@/lib/credit-consent'
import { createUserOAuthClient, getUserGoogleTokens } from '@/lib/google-user-auth'

const SHEET_TITLE = 'Outlander Directory — Issue 02 credits'
const PRINT_TAB = 'Credits'
const TRACKER_TAB = 'Tracker'

const PRINT_HEADERS = ['Tier', 'Name in print', 'Discipline', 'Instagram', 'Description', 'Characters']
const TRACKER_HEADERS = [
  'Submitted',
  'Status',
  'Tier',
  'Name in print',
  'Discipline',
  'Instagram',
  'Description',
  'Characters',
  'Limit',
  'Email',
  'Invited',
  'Opened',
  'Confirmed',
]

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Not sent',
  QUEUED: 'Queued',
  SENDING: 'Sending',
  SENT: 'Sent',
  OPENED: 'Opened',
  CONFIRMED: 'Confirmed',
  DECLINED: 'Declined',
  FAILED: 'Send failed',
}

export class GoogleNotConnectedError extends Error {
  constructor(message = 'That account has not connected Google, or the connection has expired.') {
    super(message)
    this.name = 'GoogleNotConnectedError'
  }
}

/** A missing scope and a revoked grant are the same instruction: reconnect. */
function asConnectionProblem(err: unknown): GoogleNotConnectedError | null {
  const e = err as { code?: number; status?: number; message?: string }
  const code = e?.code ?? e?.status
  const message = String(e?.message ?? '')
  if (code === 403 && /insufficient authentication scopes/i.test(message)) {
    return new GoogleNotConnectedError(
      'Your Google connection predates the Sheets permission. Reconnect Google in Settings → Google Account, then try again.'
    )
  }
  if (code === 401 || /invalid_grant/i.test(message)) {
    return new GoogleNotConnectedError(
      'Google rejected the stored credentials. Reconnect Google in Settings → Google Account.'
    )
  }
  return null
}

async function sheetsFor(userId: string) {
  let tokens
  try {
    tokens = await getUserGoogleTokens(userId)
  } catch (err) {
    throw (
      asConnectionProblem(err) ??
      new GoogleNotConnectedError(
        `Google refused the stored credentials (${String((err as Error).message).slice(0, 120)}).`
      )
    )
  }
  if (!tokens) throw new GoogleNotConnectedError()

  const client = createUserOAuthClient()
  client.setCredentials({ access_token: tokens.accessToken })
  return google.sheets({ version: 'v4', auth: client })
}

const stamp = (d: Date | null) =>
  d
    ? new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/London',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
        .format(d)
        .replace(',', '')
    : ''

async function ledger() {
  return prisma.creditRequest.findMany({
    orderBy: [{ tier: 'asc' }, { name: 'asc' }],
    select: {
      tier: true,
      name: true,
      role: true,
      instagram: true,
      email: true,
      status: true,
      sentAt: true,
      openedAt: true,
      respondedAt: true,
      printConsent: true,
      confirmedName: true,
      confirmedRole: true,
      confirmedBio: true,
      confirmedInstagram: true,
      confirmedEmail: true,
    },
  })
}

type Row = Awaited<ReturnType<typeof ledger>>[number]

/** Confirmed value if they gave one, otherwise what the sheet believed. */
const best = (confirmed: string | null, prefill: string | null) =>
  (confirmed ?? '') || (prefill ?? '')

function trackerRow(r: Row): (string | number | boolean)[] {
  const limit = bioLimitForTier(r.tier)
  const bio = r.confirmedBio ?? ''
  return [
    // Ticked when they have answered at all — a decline is a submission, and
    // "who still hasn't replied" is the question this column exists to answer.
    // Whether they said yes is the Status column's job.
    r.respondedAt !== null,
    STATUS_LABEL[r.status] ?? r.status,
    r.tier ?? '',
    best(r.confirmedName, r.name),
    best(r.confirmedRole, r.role),
    (() => {
      const h = best(r.confirmedInstagram, r.instagram)
      return h ? `@${h}` : ''
    })(),
    bio,
    bio ? [...bio].length : '',
    limit ?? '—',
    best(r.confirmedEmail, r.email),
    stamp(r.sentAt),
    stamp(r.openedAt),
    stamp(r.respondedAt),
  ]
}

function printRow(r: Row): (string | number)[] {
  const bio = r.confirmedBio ?? ''
  return [
    r.tier ?? '',
    r.confirmedName ?? r.name,
    r.confirmedRole ?? '',
    r.confirmedInstagram ? `@${r.confirmedInstagram}` : '',
    bio,
    bio ? [...bio].length : '',
  ]
}

/**
 * Turns the Submitted column into actual tick boxes.
 *
 * `showCustomUi` is the difference between a checkbox and the words TRUE and
 * FALSE — a boolean validation without it validates fine and looks like a
 * spreadsheet nobody styled. Applied on every sync rather than at creation, so
 * a sheet made before this existed heals itself and someone clearing formatting
 * by hand doesn't permanently lose the boxes.
 */
async function ensureTickBoxes(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  trackerSheetId: number
) {
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          setDataValidation: {
            range: {
              sheetId: trackerSheetId,
              startRowIndex: 1,
              startColumnIndex: 0,
              endColumnIndex: 1,
            },
            rule: { condition: { type: 'BOOLEAN' }, strict: true, showCustomUi: true },
          },
        },
      ],
    },
  })
}

/**
 * Makes sure both tabs exist, with a frozen header and a bold header row.
 * Idempotent — a sheet created before the tracker existed gains it on the next
 * sync rather than needing to be rebuilt.
 */
async function ensureTabs(sheets: sheets_v4.Sheets, spreadsheetId: string) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId })
  const have = new Map(
    (meta.data.sheets ?? []).map((s) => [s.properties?.title ?? '', s.properties?.sheetId ?? 0])
  )
  const missing = [TRACKER_TAB, PRINT_TAB].filter((t) => !have.has(t))
  if (missing.length === 0) return have

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: missing.map((title) => ({
        addSheet: { properties: { title, gridProperties: { frozenRowCount: 1 } } },
      })),
    },
  })

  const after = await sheets.spreadsheets.get({ spreadsheetId })
  const ids = new Map(
    (after.data.sheets ?? []).map((s) => [s.properties?.title ?? '', s.properties?.sheetId ?? 0])
  )

  // Bold headers on both tabs, and real tick boxes on the tracker's first
  // column. Applied once at creation: reapplying on every sync would fight
  // whatever the designer does to the file.
  const requests: sheets_v4.Schema$Request[] = []
  for (const title of missing) {
    const sheetId = ids.get(title)
    if (sheetId == null) continue
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
        cell: { userEnteredFormat: { textFormat: { bold: true } } },
        fields: 'userEnteredFormat.textFormat.bold',
      },
    })
  }
  if (requests.length > 0) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } })
  }
  return ids
}

export async function getCreditSheet() {
  return prisma.creditSheet.findUnique({ where: { id: 'singleton' } })
}

/**
 * Creates the sheet in the acting user's Drive and records them as its owner.
 * Idempotent: if one already exists it is returned untouched — a second sheet
 * would mean two links, and one of them silently going stale.
 */
export async function createCreditSheet(userId: string) {
  const existing = await getCreditSheet()
  if (existing) return existing

  const sheets = await sheetsFor(userId)
  let created
  try {
    created = await sheets.spreadsheets.create({
      requestBody: {
        properties: { title: SHEET_TITLE },
        sheets: [TRACKER_TAB, PRINT_TAB].map((title) => ({
          properties: { title, gridProperties: { frozenRowCount: 1 } },
        })),
      },
    })
  } catch (err) {
    throw asConnectionProblem(err) ?? err
  }

  const spreadsheetId = created.data.spreadsheetId
  if (!spreadsheetId) throw new Error('Google created no spreadsheet id.')

  await prisma.creditSheet.create({
    data: {
      id: 'singleton',
      spreadsheetId,
      spreadsheetUrl:
        created.data.spreadsheetUrl ?? `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
      ownerUserId: userId,
    },
  })

  const first = await syncCreditSheet()
  if (!first.synced) throw new Error(first.error ?? 'The sheet was made but the first write failed.')
  return getCreditSheet()
}

/**
 * Rewrites both tabs from the ledger. Best effort by design when called after a
 * contributor confirms: the signature is already recorded, and a Google outage
 * must never fail the submission that triggered it. Failures land on
 * `lastError` for the panel to show.
 */
export async function syncCreditSheet(): Promise<{
  synced: boolean
  rows?: number
  confirmed?: number
  error?: string
}> {
  const sheet = await getCreditSheet()
  if (!sheet) return { synced: false, error: 'No sheet has been created yet.' }

  try {
    const sheets = await sheetsFor(sheet.ownerUserId)
    const tabIds = await ensureTabs(sheets, sheet.spreadsheetId)
    const trackerId = tabIds.get(TRACKER_TAB)
    if (trackerId != null) await ensureTickBoxes(sheets, sheet.spreadsheetId, trackerId)

    const rows = await ledger()
    const confirmed = rows.filter((r) => r.status === 'CONFIRMED' && r.printConsent)

    // Clear below the headers first: fewer rows than last time has to mean
    // fewer rows in the sheet, not stale ones left under the new bottom.
    await sheets.spreadsheets.values.batchClear({
      spreadsheetId: sheet.spreadsheetId,
      requestBody: { ranges: [`${TRACKER_TAB}!A2:M`, `${PRINT_TAB}!A2:F`] },
    })
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: sheet.spreadsheetId,
      requestBody: {
        valueInputOption: 'RAW',
        data: [
          {
            range: `${TRACKER_TAB}!A1`,
            values: [TRACKER_HEADERS, ...rows.map(trackerRow)],
          },
          {
            range: `${PRINT_TAB}!A1`,
            values: [PRINT_HEADERS, ...confirmed.map(printRow)],
          },
        ],
      },
    })

    await prisma.creditSheet.update({
      where: { id: 'singleton' },
      data: { lastSyncedAt: new Date(), rowsWritten: confirmed.length, lastError: null },
    })
    return { synced: true, rows: rows.length, confirmed: confirmed.length }
  } catch (err) {
    const connection = asConnectionProblem(err)
    const message = (connection ?? (err as Error)).message.slice(0, 400)
    await prisma.creditSheet
      .update({ where: { id: 'singleton' }, data: { lastError: message } })
      .catch(() => {})
    console.error('[credit-sheet] sync failed', message)
    return { synced: false, error: message }
  }
}

/** Fire-and-forget, for the confirmation path. Never throws. */
export function syncCreditSheetInBackground(): void {
  void syncCreditSheet().catch((e) => console.error('[credit-sheet] background sync', e))
}
