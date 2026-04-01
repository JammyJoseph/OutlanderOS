'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, Loader2, RefreshCw, TrendingUp, FileText } from 'lucide-react'

interface Deal {
  ioNumber: string
  client: string
  campaign: string
  dateBooked: string
  annualTotal: string
  margin: string
}

interface InvoiceSummary {
  signed: number
  unsigned: number
  invoicesSent: number
  invoicesNotSent: number
}

interface BillingTracker {
  bookedRevenue: string
  gapToTarget: string
  totalDeals: number
  deals: Deal[]
  allDeals: Deal[]
  invoiceSummary: InvoiceSummary
  invoicingRows?: string[][]
  error?: string
}

interface DashboardData {
  connected: { billing: boolean; primary: boolean }
  billingTracker?: BillingTracker
}

function StatTile({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${accent ? 'border-[#D4A853]/30 bg-[#D4A853]/5' : 'border-zinc-800 bg-zinc-900'}`}>
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${accent ? 'text-[#D4A853]' : 'text-white'}`}>{value}</p>
      {sub && <p className="text-xs text-zinc-500 mt-0.5">{sub}</p>}
    </div>
  )
}

export default function FinancePage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  async function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const res = await fetch('/api/dashboard')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json)
      setError(null)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex items-center gap-2 text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading finance data…</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center px-4">
        <div className="text-center">
          <AlertCircle className="mx-auto mb-3 h-6 w-6 text-red-400" />
          <p className="text-sm text-zinc-300">{error}</p>
          <button onClick={() => load()} className="mt-4 rounded-lg bg-zinc-800 px-4 py-2 text-xs text-zinc-300 hover:bg-zinc-700 transition-colors">
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!data?.connected.primary) {
    return (
      <div className="flex h-full items-center justify-center px-4">
        <div className="text-center">
          <TrendingUp className="mx-auto mb-3 h-6 w-6 text-zinc-600" />
          <p className="text-sm font-medium text-zinc-400">Primary account not connected</p>
          <p className="mt-1 text-xs text-zinc-600">Connect q@outlandermag.com to access the billing tracker.</p>
          <a href="/api/google/connect?label=primary" className="mt-4 inline-block rounded-lg bg-[#D4A853] px-4 py-2 text-xs font-medium text-zinc-900 hover:bg-[#C49843] transition-colors">
            Connect
          </a>
        </div>
      </div>
    )
  }

  const bt = data.billingTracker
  const allDeals = bt?.allDeals?.length ? bt.allDeals : bt?.deals ?? []

  return (
    <div className="relative flex flex-col gap-8 py-8 px-4 sm:px-6">
      <div className="mx-auto w-full max-w-4xl space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Finance</h1>
            <p className="text-xs text-zinc-500 mt-0.5">2026 Master Billing Tracker</p>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {bt?.error ? (
          <div className="flex items-center gap-2 rounded-lg border border-red-900/40 bg-red-900/10 px-4 py-3 text-sm text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Failed to load billing tracker: {bt.error}
          </div>
        ) : bt ? (
          <>
            {/* Revenue summary */}
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Revenue Summary</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatTile label="Booked Revenue YTD" value={bt.bookedRevenue} accent />
                <StatTile label="Gap to Target" value={bt.gapToTarget} />
                <StatTile label="Total Deals" value={bt.totalDeals} />
                <StatTile label="Outstanding Invoices" value={bt.invoiceSummary.unsigned + bt.invoiceSummary.invoicesNotSent} sub="unsigned + unsent" />
              </div>
            </section>

            {/* Invoice status */}
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Invoice Status</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-emerald-800/30 bg-emerald-900/10 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span className="text-xs text-zinc-500">Signed</span>
                  </div>
                  <p className="text-2xl font-bold text-white">{bt.invoiceSummary.signed}</p>
                </div>
                <div className="rounded-xl border border-amber-800/30 bg-amber-900/10 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-2 w-2 rounded-full bg-amber-500" />
                    <span className="text-xs text-zinc-500">Unsigned</span>
                  </div>
                  <p className="text-2xl font-bold text-white">{bt.invoiceSummary.unsigned}</p>
                </div>
                <div className="rounded-xl border border-emerald-800/30 bg-emerald-900/10 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span className="text-xs text-zinc-500">Invoices Sent</span>
                  </div>
                  <p className="text-2xl font-bold text-white">{bt.invoiceSummary.invoicesSent}</p>
                </div>
                <div className="rounded-xl border border-red-800/30 bg-red-900/10 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-2 w-2 rounded-full bg-red-500" />
                    <span className="text-xs text-zinc-500">Not Sent</span>
                  </div>
                  <p className="text-2xl font-bold text-white">{bt.invoiceSummary.invoicesNotSent}</p>
                </div>
              </div>
            </section>

            {/* Full deals table */}
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                All Deals ({allDeals.length})
              </h2>
              {allDeals.length === 0 ? (
                <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-8 text-center">
                  <FileText className="mx-auto mb-2 h-5 w-5 text-zinc-700" />
                  <p className="text-sm text-zinc-500">No deals found in tracker.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-zinc-800">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-900">
                        <th className="px-4 py-2.5 text-left font-medium text-zinc-500">IO #</th>
                        <th className="px-4 py-2.5 text-left font-medium text-zinc-500">Client</th>
                        <th className="px-4 py-2.5 text-left font-medium text-zinc-500 hidden md:table-cell">Campaign</th>
                        <th className="px-4 py-2.5 text-left font-medium text-zinc-500 hidden lg:table-cell">Date Booked</th>
                        <th className="px-4 py-2.5 text-right font-medium text-zinc-500">Annual Total</th>
                        <th className="px-4 py-2.5 text-right font-medium text-zinc-500 hidden sm:table-cell">Margin</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800 bg-zinc-900/50">
                      {allDeals.map((deal, i) => (
                        <tr key={i} className="hover:bg-zinc-800/50 transition-colors">
                          <td className="px-4 py-2.5 text-zinc-400 font-mono">{deal.ioNumber || '—'}</td>
                          <td className="px-4 py-2.5 font-medium text-zinc-100">{deal.client}</td>
                          <td className="px-4 py-2.5 text-zinc-400 hidden md:table-cell">{deal.campaign}</td>
                          <td className="px-4 py-2.5 text-zinc-500 hidden lg:table-cell">{deal.dateBooked}</td>
                          <td className="px-4 py-2.5 text-right text-zinc-100">{deal.annualTotal}</td>
                          <td className="px-4 py-2.5 text-right text-zinc-400 hidden sm:table-cell">{deal.margin}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
            {/* INVOICING 2026 raw data */}
            {bt.invoicingRows && bt.invoicingRows.length > 0 && (
              <section>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  INVOICING 2026
                </h2>
                <div className="overflow-x-auto rounded-xl border border-zinc-800">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-900">
                        {bt.invoicingRows[0].map((header, i) => (
                          <th key={i} className="px-3 py-2.5 text-left font-medium text-zinc-500 whitespace-nowrap">{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800 bg-zinc-900/50">
                      {bt.invoicingRows.slice(1).filter(r => r.some(c => c)).map((row, i) => (
                        <tr key={i} className="hover:bg-zinc-800/50 transition-colors">
                          {bt.invoicingRows![0].map((_, j) => (
                            <td key={j} className="px-3 py-2 text-zinc-300 whitespace-nowrap">{row[j] ?? ''}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        ) : (
          <p className="text-sm text-zinc-500">No billing data available.</p>
        )}
      </div>
    </div>
  )
}
