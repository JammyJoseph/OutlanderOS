'use client'

import { useCallback, useEffect, useState } from 'react'

// ===== Formatting =====

export function fmtGBP(n?: number | null, opts?: { decimals?: boolean }): string {
  if (typeof n !== 'number' || Number.isNaN(n)) return '—'
  const decimals = opts?.decimals ?? false
  return `£${n.toLocaleString('en-GB', {
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: decimals ? 2 : 0,
  })}`
}

export function fmtPct(n?: number | null): string {
  if (typeof n !== 'number' || Number.isNaN(n)) return '—'
  return `${n.toFixed(1)}%`
}

export function fmtDate(d?: string | null): string {
  if (!d) return '—'
  const date = new Date(d)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Whole days from now until the given date. Negative => overdue.
export function daysUntil(d?: string | null): number | null {
  if (!d) return null
  const target = new Date(d)
  if (Number.isNaN(target.getTime())) return null
  const ms = target.getTime() - Date.now()
  return Math.ceil(ms / (24 * 60 * 60 * 1000))
}

export function marginPct(profit: number, revenue: number): number | null {
  if (!revenue) return null
  return (profit / revenue) * 100
}

// ===== Status styling =====

// CampaignBudget.status: DRAFT, SUBMITTED, APPROVED, RECONCILED
export const BUDGET_STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  SUBMITTED: 'bg-blue-100 text-blue-700',
  APPROVED: 'bg-emerald-100 text-emerald-700',
  RECONCILED: 'bg-purple-100 text-purple-700',
  REJECTED: 'bg-red-100 text-red-700',
}

// InvoiceSubmission.status: RECEIVED, REVIEWED, APPROVED, PAID, REJECTED
export const SUBMISSION_STATUS_STYLES: Record<string, string> = {
  RECEIVED: 'bg-gray-100 text-gray-600',
  REVIEWED: 'bg-blue-100 text-blue-700',
  APPROVED: 'bg-amber-100 text-amber-700',
  PAID: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-red-100 text-red-700',
}

// Xero invoice status
export const INVOICE_STATUS_STYLES: Record<string, string> = {
  PAID: 'bg-emerald-100 text-emerald-700',
  AUTHORISED: 'bg-amber-100 text-amber-700',
  SENT: 'bg-blue-100 text-blue-700',
  DRAFT: 'bg-gray-100 text-gray-600',
  OVERDUE: 'bg-red-100 text-red-700',
  VOIDED: 'bg-gray-100 text-gray-400',
}

export function badgeClass(map: Record<string, string>, status?: string): string {
  return map[status ?? ''] ?? 'bg-gray-100 text-gray-600'
}

// ===== Data fetching =====

interface FetchState<T> {
  data: T | null
  loading: boolean
  error: string | null
  reload: () => void
}

// Lightweight per-tab fetcher. Each tab calls this so it loads independently
// the first time the tab mounts (lazy). `reload` bumps a counter to refetch.
export function useFinanceFetch<T>(url: string): FetchState<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(url)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((json) => {
        if (cancelled) return
        setData(json)
        setError(null)
      })
      .catch((e) => {
        if (cancelled) return
        setError(String(e))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [url, nonce])

  const reload = useCallback(() => setNonce((n) => n + 1), [])
  return { data, loading, error, reload }
}

// ===== Shared response types =====

export interface XeroPL {
  revenue: number
  expenses: number
  profit: number
}

export interface OverviewResponse {
  xeroConnected: boolean
  xeroError: string | null
  organisation: string | null
  profitAndLoss: XeroPL
  bankBalance: { balance: number; accountName: string }
  outstandingInvoices: number
  overdueTotal: number
  invoiceCount: number
  error?: string
}

export interface CampaignBudget {
  id: string
  trelloCardId: string | null
  trelloCardName: string | null
  clientName: string
  campaignName: string
  totalBudget: number
  productionBudget: number
  mediaBudget: number
  internalBudget: number
  otherBudget: number
  status: string
  submittedBy: string | null
  approvedBy: string | null
  notes: string | null
  productionId: string | null
  createdAt: string
  updatedAt: string
}

export interface CampaignBudgetsResponse {
  budgets: CampaignBudget[]
  totalBudget: number
  count: number
  error?: string
}

export interface CostEntry {
  id: string
  campaignBudgetId: string | null
  category: string
  description: string
  amount: number
  vendor: string | null
  date: string
  portal: string | null
  status: string
}

export interface CostEntriesResponse {
  entries: CostEntry[]
  total: number
  count: number
  error?: string
}

export interface XeroInvoice {
  id: string
  contact: string
  amount: number
  amountDue: number
  amountPaid: number
  status: string
  date: string
  dueDate: string
}

export interface InvoicesResponse {
  xeroConnected: boolean
  xeroError: string | null
  invoices: XeroInvoice[]
  total: number
  totalDue: number
  count: number
  error?: string
}

export interface InvoiceSubmission {
  id: string
  supplierName: string
  supplierEmail: string
  amount: number | null
  currency: string
  description: string | null
  emailSubject: string | null
  attachmentUrl: string | null
  receivedAt: string
  paymentDeadline: string
  status: string
  reviewedBy: string | null
  paidAt: string | null
  reminderSent: boolean
  notes: string | null
}

export interface InvoiceSubmissionsResponse {
  submissions: InvoiceSubmission[]
  totalOwed: number
  count: number
  error?: string
}
