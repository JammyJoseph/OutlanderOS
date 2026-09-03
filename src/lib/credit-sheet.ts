// ═══════════════════════════════════════════════════════════════════════════
// The live credit sheet.
//
// The designer needs one URL that is always current, not a CSV re-exported
// every time somebody confirms. So OutlanderOS owns a Google Sheet and rewrites
// it whenever a credit is signed.
//
// Three decisions worth knowing:
//
//  1. **It writes with one person's Google grant, remembered on the row.** A
//     contributor confirming their credit is an anonymous request — there is no
//     user to borrow tokens from — so the setup user's grant is stored and
//     reused. If they disconnect Google, syncing stops and says so rather than
//     reaching for somebody else's Drive.
//
//  2. **The sheet is created private.** Pre-announcement, the contributor list
//     *is* the confidential part of Issue 02, and every contributor has signed
//     an agreement to keep it quiet — publishing a link-shared sheet of their
//     names would be us breaking the side of the deal we wrote. Share it with
//     the designer explicitly, from Drive.
//
//  3. **Rewrite, never append.** The sheet is a projection of the ledger, so it
//     is cleared and rewritten each time. A withdrawn credit has to be able to
//     disappear from it; an append-only sheet would print somebody who pulled
//     out.
//
// Scope note: this uses the existing full-Drive scope in GOOGLE_USER_SCOPES,
// which the Sheets API accepts. Adding the narrower `spreadsheets` scope would
// invalidate every existing grant and force the whole team to reconnect.
// ═══════════════════════════════════════════════════════════════════════════

import { google } from 'googleapis'
import prisma from '@/lib/prisma'
import { createUserOAuthClient, getUserGoogleTokens } from '@/lib/google-user-auth'

const SHEET_TITLE = 'Outlander Directory — Issue 02 credits'
const TAB = 'Credits'
const HEADERS = ['Tier', 'Name in print', 'Discipline', 'Instagram', 'Description', 'Characters']

export class GoogleNotConnectedError extends Error {
  constructor(message = 'That account has not connected Google, or the connection has expired.') {
    super(message)
    this.name = 'GoogleNotConnectedError'
  }
}

async function sheetsFor(userId: string) {
  let tokens
  try {
    tokens = await getUserGoogleTokens(userId)
  } catch (err) {
    // getUserGoogleTokens throws on invalid_grant — a revoked or expired
    // refresh token. That is a reconnect, not a server fault, and it must not
    // surface as an unhandled 500 (ROADMAP 10.3).
    throw new GoogleNotConnectedError(
      `Google refused the stored credentials (${String((err as Error).message).slice(0, 120)}). Reconnect Google in Settings.`
    )
  }
  if (!tokens) throw new GoogleNotConnectedError()

  const client = createUserOAuthClient()
  client.setCredentials({ access_token: tokens.accessToken })
  return google.sheets({ version: 'v4', auth: client })
}

/** The printable payload, and only that. No email, no postal address. */
async function printableRows(): Promise<string[][]> {
  const rows = await prisma.creditRequest.findMany({
    where: { status: 'CONFIRMED', printConsent: true },
    select: {
      tier: true,
      name: true,
      confirmedName: true,
      confirmedRole: true,
      confirmedInstagram: true,
      confirmedBio: true,
    },
  })

  return rows
    .sort((a, b) => (a.tier ?? 9) - (b.tier ?? 9) || a.name.localeCompare(b.name))
    .map((r) => [
      r.tier != null ? String(r.tier) : '',
      r.confirmedName ?? r.name,
      r.confirmedRole ?? '',
      r.confirmedInstagram ? `@${r.confirmedInstagram}` : '',
      r.confirmedBio ?? '',
      r.confirmedBio ? String([...r.confirmedBio].length) : '',
    ])
}

export async function getCreditSheet() {
  return prisma.creditSheet.findUnique({ where: { id: 'singleton' } })
}

/**
 * Creates the sheet in the acting user's Drive and records them as its owner.
 * Idempotent: if one already exists, it is returned untouched — a second sheet
 * would mean two links and one of them silently going stale.
 */
export async function createCreditSheet(userId: string) {
  const existing = await getCreditSheet()
  if (existing) return existing

  const sheets = await sheetsFor(userId)
  const created = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: SHEET_TITLE },
      sheets: [
        {
          properties: {
            title: TAB,
            // The header stays visible however far the designer scrolls.
            gridProperties: { frozenRowCount: 1, columnCount: HEADERS.length },
          },
        },
      ],
    },
  })

  const spreadsheetId = created.data.spreadsheetId
  if (!spreadsheetId) throw new Error('Google created no spreadsheet id.')

  const row = await prisma.creditSheet.create({
    data: {
      id: 'singleton',
      spreadsheetId,
      spreadsheetUrl:
        created.data.spreadsheetUrl ?? `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
      ownerUserId: userId,
    },
  })

  await syncCreditSheet()
  return prisma.creditSheet.findUnique({ where: { id: row.id } })
}

/**
 * Rewrites the sheet from the ledger. Best effort by design: called after a
 * contributor confirms, and a Google outage must never fail the submission that
 * triggered it — the signature is the thing that matters and it is already
 * recorded. Failures land on `lastError` for the panel to show.
 */
export async function syncCreditSheet(): Promise<{ synced: boolean; rows?: number; error?: string }> {
  const sheet = await getCreditSheet()
  if (!sheet) return { synced: false, error: 'No sheet has been created yet.' }

  try {
    const sheets = await sheetsFor(sheet.ownerUserId)
    const values = await printableRows()

    // Clear first: this is a projection, so a credit withdrawn since the last
    // write has to actually leave the sheet.
    await sheets.spreadsheets.values.clear({
      spreadsheetId: sheet.spreadsheetId,
      range: `${TAB}!A2:F`,
    })
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheet.spreadsheetId,
      range: `${TAB}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [HEADERS, ...values] },
    })

    await prisma.creditSheet.update({
      where: { id: 'singleton' },
      data: { lastSyncedAt: new Date(), rowsWritten: values.length, lastError: null },
    })
    return { synced: true, rows: values.length }
  } catch (err) {
    const message = String((err as Error).message).slice(0, 400)
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
