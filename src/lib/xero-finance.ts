import { getToken, setToken } from './token-store'
import type { InvoiceSubmission } from '@prisma/client'

// Deep Xero integration for the finance portal (F2).
// All calls degrade gracefully: if Xero is disconnected or the token cannot be
// refreshed, callers get safe defaults and `getXeroStatus()` reports the reason
// rather than the request crashing.

const XERO_API_BASE = 'https://api.xero.com/api.xro/2.0'

interface XeroTokens {
  access_token: string
  refresh_token?: string
  expires_at?: number
  [key: string]: unknown
}

export class XeroDisconnectedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'XeroDisconnectedError'
  }
}

async function refreshXeroTokens(tokens: XeroTokens): Promise<XeroTokens | null> {
  if (!tokens.refresh_token) return null
  const res = await fetch('https://identity.xero.com/connect/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization:
        'Basic ' +
        Buffer.from(
          `${process.env.XERO_CLIENT_ID}:${process.env.XERO_CLIENT_SECRET}`
        ).toString('base64'),
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tokens.refresh_token,
    }),
  })
  if (!res.ok) {
    console.error('Xero token refresh failed:', res.status, await res.text())
    return null
  }
  const next = await res.json()
  return {
    ...tokens,
    access_token: next.access_token,
    refresh_token: next.refresh_token || tokens.refresh_token,
    id_token: next.id_token || tokens.id_token,
    expires_at: Date.now() + next.expires_in * 1000,
  }
}

async function getXeroConnections(accessToken: string) {
  const res = await fetch('https://api.xero.com/connections', {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`Xero connections ${res.status}`)
  return res.json() as Promise<Array<{ tenantId: string; tenantName: string }>>
}

interface XeroContext {
  tokens: XeroTokens
  tenantId: string
  tenantName: string
}

// Loads tokens from the store, refreshes + persists if needed, and resolves the
// active tenant. Throws XeroDisconnectedError when Xero is unavailable.
async function getXeroContext(): Promise<XeroContext> {
  const stored = getToken('xero') as XeroTokens | null
  if (!stored?.access_token) {
    throw new XeroDisconnectedError('Xero not connected — connect it in Settings')
  }
  let tokens = stored
  const needsRefresh = !tokens.expires_at || Date.now() > tokens.expires_at - 60000
  if (needsRefresh) {
    const refreshed = await refreshXeroTokens(tokens)
    if (!refreshed) {
      throw new XeroDisconnectedError('Xero token expired — please reconnect Xero in Settings')
    }
    tokens = refreshed
    setToken('xero', tokens)
  }
  const connections = await getXeroConnections(tokens.access_token)
  if (!connections.length) {
    throw new XeroDisconnectedError('No Xero organisation connected')
  }
  return { tokens, tenantId: connections[0].tenantId, tenantName: connections[0].tenantName }
}

async function xeroGet(endpoint: string, ctx: XeroContext) {
  const res = await fetch(`${XERO_API_BASE}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${ctx.tokens.access_token}`,
      'Xero-Tenant-Id': ctx.tenantId,
      Accept: 'application/json',
    },
  })
  if (!res.ok) throw new Error(`Xero API ${res.status}: ${await res.text()}`)
  return res.json()
}

// Lightweight connection check for routes/UI overlays.
export async function getXeroStatus(): Promise<{ connected: boolean; organisation?: string; error?: string }> {
  try {
    const ctx = await getXeroContext()
    return { connected: true, organisation: ctx.tenantName }
  } catch (e) {
    return { connected: false, error: e instanceof Error ? e.message : String(e) }
  }
}

function lastCellValue(row: { Cells?: Array<{ Value?: string }> }): number {
  const cells = row.Cells ?? []
  return parseFloat(cells[cells.length - 1]?.Value ?? '0') || 0
}

// ===== P&L =====
export async function getXeroProfitAndLoss(
  fromDate: string,
  toDate: string
): Promise<{ revenue: number; expenses: number; profit: number; details: unknown }> {
  try {
    const ctx = await getXeroContext()
    const data = await xeroGet(
      `/Reports/ProfitAndLoss?fromDate=${fromDate}&toDate=${toDate}`,
      ctx
    )
    const report = data.Reports?.[0] || null
    let revenue = 0
    let expenses = 0
    for (const section of report?.Rows ?? []) {
      const title = (section.Title || '').toLowerCase()
      if (section.RowType !== 'Section') continue
      for (const row of section.Rows ?? []) {
        if (row.RowType !== 'SummaryRow') continue
        const val = lastCellValue(row)
        if (title.includes('income') || title.includes('revenue')) revenue = val
        else if (title.includes('expense') || title.includes('cost')) expenses = Math.abs(val)
      }
    }
    return { revenue, expenses, profit: revenue - expenses, details: report }
  } catch (e) {
    console.error('getXeroProfitAndLoss:', e)
    return { revenue: 0, expenses: 0, profit: 0, details: null }
  }
}

// ===== BANK BALANCE =====
export async function getXeroBankBalance(): Promise<{ balance: number; accountName: string }> {
  try {
    const ctx = await getXeroContext()
    const data = await xeroGet('/Reports/BankSummary', ctx)
    const report = data.Reports?.[0] || null
    let balance = 0
    let accountName = 'All bank accounts'
    for (const section of report?.Rows ?? []) {
      if (section.RowType !== 'Section') continue
      for (const row of section.Rows ?? []) {
        if (row.RowType === 'Row' && row.Cells?.[0]?.Value && accountName === 'All bank accounts') {
          accountName = row.Cells[0].Value
        }
        if (row.RowType === 'SummaryRow') balance = lastCellValue(row)
      }
    }
    return { balance, accountName }
  } catch (e) {
    console.error('getXeroBankBalance:', e)
    return { balance: 0, accountName: '' }
  }
}

interface XeroInvoiceShape {
  id: string
  contact: string
  amount: number
  amountDue: number
  amountPaid: number
  status: string
  date: string
  dueDate: string
}

function mapInvoices(invoices: unknown[]): XeroInvoiceShape[] {
  return (invoices as Array<Record<string, any>>).map((inv) => ({
    id: inv.InvoiceID,
    contact: inv.Contact?.Name || '',
    amount: inv.Total || 0,
    amountDue: inv.AmountDue || 0,
    amountPaid: inv.AmountPaid || 0,
    status: inv.Status || '',
    date: inv.DateString || inv.Date || '',
    dueDate: inv.DueDateString || inv.DueDate || '',
  }))
}

// ===== INVOICES (receivables, ACCREC) =====
export async function getXeroInvoices(status?: string): Promise<XeroInvoiceShape[]> {
  try {
    const ctx = await getXeroContext()
    const q = status ? `&Statuses=${encodeURIComponent(status)}` : ''
    const data = await xeroGet(`/Invoices?where=Type%3D%3D%22ACCREC%22${q}&order=Date%20DESC`, ctx)
    return mapInvoices(data.Invoices || []).slice(0, 200)
  } catch (e) {
    console.error('getXeroInvoices:', e)
    return []
  }
}

// ===== BILLS (payables, ACCPAY) =====
export async function getXeroBills(status?: string): Promise<XeroInvoiceShape[]> {
  try {
    const ctx = await getXeroContext()
    const q = status ? `&Statuses=${encodeURIComponent(status)}` : ''
    const data = await xeroGet(`/Invoices?where=Type%3D%3D%22ACCPAY%22${q}&order=Date%20DESC`, ctx)
    return mapInvoices(data.Invoices || []).slice(0, 200)
  } catch (e) {
    console.error('getXeroBills:', e)
    return []
  }
}

interface AgedRow {
  contact: string
  total: number
  current: number
  period1: number
  period2: number
  period3: number
}

// Derives an aged bucket report from unpaid invoices/bills. More robust than the
// per-contact Xero report (which requires a contactId) and works identically for
// receivables (ACCREC) and payables (ACCPAY).
function bucketAged(invoices: XeroInvoiceShape[]): AgedRow[] {
  const now = Date.now()
  const byContact = new Map<string, AgedRow>()
  for (const inv of invoices) {
    if (inv.amountDue <= 0) continue
    const row =
      byContact.get(inv.contact) ||
      { contact: inv.contact, total: 0, current: 0, period1: 0, period2: 0, period3: 0 }
    const due = inv.dueDate ? new Date(inv.dueDate).getTime() : now
    const daysOverdue = Math.floor((now - due) / (1000 * 60 * 60 * 24))
    row.total += inv.amountDue
    if (daysOverdue <= 0) row.current += inv.amountDue
    else if (daysOverdue <= 30) row.period1 += inv.amountDue
    else if (daysOverdue <= 60) row.period2 += inv.amountDue
    else row.period3 += inv.amountDue
    byContact.set(inv.contact, row)
  }
  return Array.from(byContact.values()).sort((a, b) => b.total - a.total)
}

// ===== AGED RECEIVABLES (who owes you) =====
export async function getXeroAgedReceivables(): Promise<AgedRow[]> {
  try {
    const invoices = await getXeroInvoices('AUTHORISED')
    return bucketAged(invoices)
  } catch (e) {
    console.error('getXeroAgedReceivables:', e)
    return []
  }
}

// ===== AGED PAYABLES (who you owe) =====
export async function getXeroAgedPayables(): Promise<AgedRow[]> {
  try {
    const bills = await getXeroBills('AUTHORISED')
    return bucketAged(bills)
  } catch (e) {
    console.error('getXeroAgedPayables:', e)
    return []
  }
}

interface XeroPaymentShape {
  id: string
  date: string
  amount: number
  reference: string
  contact: string
  invoiceNumber: string
}

// ===== PAYMENTS =====
export async function getXeroPayments(
  fromDate: string,
  toDate: string
): Promise<XeroPaymentShape[]> {
  try {
    const ctx = await getXeroContext()
    const [y, m, d] = fromDate.split('-').map((n) => parseInt(n, 10))
    const where = encodeURIComponent(`Date>=DateTime(${y},${m},${d})`)
    const data = await xeroGet(`/Payments?where=${where}&order=Date%20DESC`, ctx)
    const to = new Date(toDate).getTime()
    return (data.Payments || [])
      .map((p: Record<string, any>) => ({
        id: p.PaymentID,
        date: p.DateString || p.Date || '',
        amount: p.Amount || 0,
        reference: p.Reference || '',
        contact: p.Invoice?.Contact?.Name || p.Contact?.Name || '',
        invoiceNumber: p.Invoice?.InvoiceNumber || '',
      }))
      .filter((p: XeroPaymentShape) => {
        if (!p.date) return true
        const t = new Date(p.date).getTime()
        return Number.isNaN(t) || t <= to
      })
      .slice(0, 200)
  } catch (e) {
    console.error('getXeroPayments:', e)
    return []
  }
}

// ===== MATCH A PAYMENT TO AN INVOICE SUBMISSION =====
// Returns the matched InvoiceSubmission id, or null. Matches on amount (within
// 1p) and a fuzzy supplier/contact name overlap.
export async function matchPaymentToInvoice(
  payment: { amount?: number; contact?: string; reference?: string },
  invoices: InvoiceSubmission[]
): Promise<string | null> {
  const amount = payment.amount ?? 0
  const contact = (payment.contact || '').toLowerCase().trim()
  const ref = (payment.reference || '').toLowerCase()
  let best: { id: string; score: number } | null = null
  for (const inv of invoices) {
    if (inv.status === 'PAID') continue
    let score = 0
    if (inv.amount != null && Math.abs(inv.amount - amount) < 0.01) score += 2
    const supplier = (inv.supplierName || '').toLowerCase().trim()
    if (supplier && contact && (supplier.includes(contact) || contact.includes(supplier))) score += 2
    if (supplier && ref.includes(supplier)) score += 1
    if (score >= 2 && (!best || score > best.score)) best = { id: inv.id, score }
  }
  return best?.id ?? null
}
