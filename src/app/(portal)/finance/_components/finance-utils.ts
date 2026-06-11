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

// InvoiceSubmission.status pipeline: RECEIVED → UNDER_REVIEW → APPROVED → PAID
// (REVIEWED is the legacy name for UNDER_REVIEW; kept for old rows.)
export const SUBMISSION_STATUS_STYLES: Record<string, string> = {
  RECEIVED: 'bg-gray-100 text-gray-600',
  UNDER_REVIEW: 'bg-blue-100 text-blue-700',
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
  'PARTIALLY PAID': 'bg-blue-100 text-blue-700',
}

// Project budget health
export const OVERAGE_STATUS_STYLES: Record<string, string> = {
  HEALTHY: 'bg-emerald-100 text-emerald-700',
  WARNING: 'bg-amber-100 text-amber-700',
  OVERAGE: 'bg-red-100 text-red-700',
  NO_BUDGET: 'bg-gray-100 text-gray-500',
}

export const OVERAGE_STATUS_LABELS: Record<string, string> = {
  HEALTHY: 'On budget',
  WARNING: 'Near budget',
  OVERAGE: 'Over budget',
  NO_BUDGET: 'No budget',
}

export function badgeClass(map: Record<string, string>, status?: string): string {
  return map[status ?? ''] ?? 'bg-gray-100 text-gray-600'
}

export function displayStatus(status?: string): string {
  if (!status) return '—'
  if (status === 'REVIEWED') return 'UNDER REVIEW'
  return status.replace(/_/g, ' ')
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

export interface OverageAlert {
  id: string
  campaignName: string
  clientName: string
  totalBudget: number
  totalCosts: number
  overBy: number
  overageStatus: string
}

export interface ActivityItem {
  type: 'incoming' | 'outgoing'
  id: string
  label: string
  detail: string | null
  amount: number | null
  status: string
  flagged: boolean
  date: string
}

export interface OverviewResponse {
  xeroConnected: boolean
  xeroError: string | null
  organisation: string | null
  profitAndLoss: XeroPL
  bankBalance: { balance: number; accountName: string }
  outstandingReceivables: number
  overdueReceivables: number
  outstandingPayables: number
  receivableCount: number
  payableCount: number
  pendingApprovals: number
  flaggedCount: number
  activeProjects: number
  overageAlerts: OverageAlert[]
  recentActivity: ActivityItem[]
  error?: string
}

export interface ProjectSummary {
  id: string
  campaignName: string
  clientName: string
  status: string
  productionId: string | null
  deal: { id: string; title: string; stage: string } | null
  targetMarginAmount: number | null
  targetMarginPercent: number | null
  budgetLocked: boolean
  totalBudget: number
  productionBudget: number
  mediaBudget: number
  internalBudget: number
  otherBudget: number
  totalCosts: number
  totalPaid: number
  remaining: number
  spendPct: number | null
  overageStatus: string
  pendingInvoices: number
  updatedAt: string
}

export interface ProjectsResponse {
  projects: ProjectSummary[]
  totalBudget: number
  totalCosts: number
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

export interface InvoiceSubmission {
  id: string
  supplierName: string
  supplierEmail: string
  amount: number | null
  currency: string
  description: string | null
  emailSubject: string | null
  attachmentUrl: string | null
  campaignBudgetId: string | null
  flagged: boolean
  flagNote: string | null
  receivedAt: string
  paymentDeadline: string
  status: string
  reviewedBy: string | null
  approvedBy: string | null
  approvedAt: string | null
  paidAt: string | null
  reminderSent: boolean
  notes: string | null
}

export interface InvoicesResponse {
  invoices: InvoiceSubmission[]
  totalOwed: number
  pendingApproval: number
  count: number
  error?: string
}

export interface ReceivablesResponse {
  xeroConnected: boolean
  xeroError: string | null
  invoices: XeroInvoice[]
  total: number
  totalDue: number
  count: number
  error?: string
}

export interface BudgetAllocation {
  name: string
  amount: number
  isProductionBudget: boolean
}

// The budget & margin waterfall: deal economics from Commercial, production
// budget vs actuals, and the resulting margin / P&L.
export interface ProjectEconomics {
  dealTotal: number
  targetMarginAmount: number | null
  targetMarginPercent: number | null
  allocations: BudgetAllocation[]
  budgetLocked: boolean
  productionAllocation: number
  productionBudgeted: number
  productionActuals: number
  productionSavings: number
  productionBudgetStatus: string | null
  actualMarginAmount: number | null
  actualMarginPercent: number | null
  finalPL: {
    revenue: number
    nonProductionAllocated: number
    productionActuals: number
    costs: number
    grossProfit: number
    grossMarginPercent: number | null
  }
}

export interface InvoiceTracking {
  invoicesTotal: number
  invoicesPaid: number
  invoicesUnpaid: number
  outstandingCount: number
  outstandingAmount: number
  vsProductionActuals: number
}

export interface ProjectDetailResponse {
  project: ProjectSummary & {
    notes: string | null
    trelloCardName: string | null
    createdAt: string
  }
  production: {
    id: string
    title: string
    status: string
    budgetTotal: number
    productionBudgetStatus: string | null
  } | null
  deal: {
    id: string
    title: string
    stage: string
    value: number | null
    marginPercent: number | null
    marginAmount: number | null
    budgetLocked: boolean
    client: { name: string } | null
  } | null
  economics: ProjectEconomics
  invoiceTracking: InvoiceTracking
  costsByCategory: { category: string; total: number; entries: CostEntry[] }[]
  invoices: InvoiceSubmission[]
  xero: {
    connected: boolean
    clientInvoices: XeroInvoice[]
    totalInvoiced: number
    totalPaid: number
  }
  error?: string
}
