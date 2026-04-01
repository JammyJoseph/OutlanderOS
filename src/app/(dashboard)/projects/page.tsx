'use client'

import { useEffect, useState } from 'react'
import { Loader2, LayoutGrid, List, Search, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react'

interface Deal {
  ioNumber: string
  client: string
  campaign: string
  dateBooked: string
  q1: string
  q2: string
  q3: string
  q4: string
  annualTotal: string
  margin: string
}

interface BillingRow {
  signed: boolean
  invoiceSent: boolean
  ioNumber: string
  brand: string
}

interface BillingTracker {
  deals: Deal[]
  allDeals: Deal[]
  billingRows?: string[][]
}

interface DashboardData {
  connected: { billing: boolean; primary: boolean }
  billingTracker?: BillingTracker
}

type ProjectStatus = 'Active' | 'Pending Invoice' | 'In Pipeline'
type FilterStatus = 'All' | ProjectStatus

interface Project {
  ioNumber: string
  client: string
  campaign: string
  dateBooked: string
  budget: string
  margin: string
  q1: string
  q2: string
  q3: string
  q4: string
  status: ProjectStatus
  signed: boolean
  invoiceSent: boolean
}

function parseNum(s: string): number {
  if (!s) return 0
  return parseFloat(s.replace(/[£€$,\s%]/g, '')) || 0
}

function marginColor(margin: string): string {
  const pct = parseNum(margin)
  if (pct > 20) return 'text-emerald-400'
  if (pct >= 10) return 'text-amber-400'
  return 'text-red-400'
}

const STATUS_STYLES: Record<ProjectStatus, string> = {
  'Active': 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  'Pending Invoice': 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  'In Pipeline': 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
}

function deriveStatus(signed: boolean, invoiceSent: boolean): ProjectStatus {
  if (!signed) return 'In Pipeline'
  if (!invoiceSent) return 'Pending Invoice'
  return 'Active'
}

function buildProjects(bt: BillingTracker): Project[] {
  const deals = bt.allDeals?.length ? bt.allDeals : bt.deals ?? []
  const billingRows = bt.billingRows ?? []

  // Build a lookup of billing status by IO number
  const billingMap: Record<string, { signed: boolean; invoiceSent: boolean }> = {}
  for (const row of billingRows) {
    const ioNum = (row[1] ?? '').trim()
    if (ioNum) {
      billingMap[ioNum] = {
        signed: row[0] === 'TRUE',
        invoiceSent: row[7] === 'TRUE',
      }
    }
  }

  return deals
    .filter(d => parseNum(d.annualTotal) > 0 || d.client)
    .map(d => {
      const billing = billingMap[d.ioNumber?.trim()] ?? { signed: false, invoiceSent: false }
      return {
        ioNumber: d.ioNumber,
        client: d.client,
        campaign: d.campaign,
        dateBooked: d.dateBooked,
        budget: d.annualTotal,
        margin: d.margin,
        q1: d.q1,
        q2: d.q2,
        q3: d.q3,
        q4: d.q4,
        status: deriveStatus(billing.signed, billing.invoiceSent),
        signed: billing.signed,
        invoiceSent: billing.invoiceSent,
      }
    })
}

function ProjectCard({ project }: { project: Project }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden hover:border-zinc-700 transition-colors">
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="text-base font-bold text-zinc-100 leading-tight">{project.client || '—'}</h3>
          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLES[project.status]}`}>
            {project.status}
          </span>
        </div>
        <p className="text-xs text-zinc-500 mb-3 truncate">{project.campaign || '—'}</p>

        <div className="flex flex-wrap gap-3 mb-3">
          <div>
            <p className="text-[10px] text-zinc-600 uppercase tracking-wide">Budget</p>
            <p className="font-mono text-sm font-semibold text-zinc-100">{project.budget || '—'}</p>
          </div>
          <div>
            <p className="text-[10px] text-zinc-600 uppercase tracking-wide">Margin</p>
            <p className={`font-mono text-sm font-semibold ${marginColor(project.margin)}`}>{project.margin || '—'}</p>
          </div>
          {project.ioNumber && (
            <div>
              <p className="text-[10px] text-zinc-600 uppercase tracking-wide">IO #</p>
              <p className="font-mono text-sm text-zinc-400">{project.ioNumber}</p>
            </div>
          )}
          {project.dateBooked && (
            <div>
              <p className="text-[10px] text-zinc-600 uppercase tracking-wide">Booked</p>
              <p className="text-sm text-zinc-400">{project.dateBooked}</p>
            </div>
          )}
        </div>

        <button
          onClick={() => setExpanded(p => !p)}
          className="flex items-center gap-1 text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors"
        >
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {expanded ? 'Hide details' : 'Show details'}
        </button>
      </div>

      {expanded && (
        <div className="border-t border-zinc-800 px-4 py-3 bg-zinc-950/50 space-y-2">
          <div className="grid grid-cols-4 gap-2">
            {(['Q1', 'Q2', 'Q3', 'Q4'] as const).map(q => {
              const key = q.toLowerCase() as 'q1' | 'q2' | 'q3' | 'q4'
              return (
                <div key={q} className="text-center">
                  <p className="text-[10px] text-zinc-600">{q}</p>
                  <p className="font-mono text-xs text-zinc-300">{project[key] || '—'}</p>
                </div>
              )
            })}
          </div>
          <div className="flex gap-4 pt-1">
            <div className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${project.signed ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
              <span className="text-xs text-zinc-500">{project.signed ? 'Signed' : 'Unsigned'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${project.invoiceSent ? 'bg-emerald-400' : 'bg-red-400'}`} />
              <span className="text-xs text-zinc-500">{project.invoiceSent ? 'Invoice sent' : 'Invoice pending'}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ProjectRow({ project, onClick }: { project: Project; onClick: () => void }) {
  return (
    <tr
      className="hover:bg-zinc-800/60 transition-colors cursor-pointer"
      onClick={onClick}
    >
      <td className="px-3 py-2.5 font-mono text-zinc-400 text-xs">{project.ioNumber || '—'}</td>
      <td className="px-3 py-2.5 font-semibold text-zinc-100 text-sm">{project.client}</td>
      <td className="px-3 py-2.5 text-zinc-400 text-xs hidden md:table-cell truncate max-w-[200px]">{project.campaign}</td>
      <td className="px-3 py-2.5">
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLES[project.status]}`}>
          {project.status}
        </span>
      </td>
      <td className="px-3 py-2.5 font-mono text-zinc-200 text-xs text-right">{project.budget || '—'}</td>
      <td className={`px-3 py-2.5 font-mono font-semibold text-xs text-right ${marginColor(project.margin)}`}>{project.margin || '—'}</td>
      <td className="px-3 py-2.5 text-zinc-500 text-xs hidden lg:table-cell">{project.dateBooked || '—'}</td>
    </tr>
  )
}

const FILTER_TABS: FilterStatus[] = ['All', 'Active', 'Pending Invoice', 'In Pipeline']

export default function ProjectsPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [filter, setFilter] = useState<FilterStatus>('All')
  const [search, setSearch] = useState('')
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(setData)
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex items-center gap-2 text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading projects…</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center px-4">
        <div className="text-center">
          <AlertCircle className="mx-auto mb-3 h-6 w-6 text-red-400" />
          <p className="text-sm text-zinc-400">{error}</p>
          <button onClick={() => window.location.reload()} className="mt-4 rounded-lg bg-zinc-800 px-4 py-2 text-xs text-zinc-300 hover:bg-zinc-700 transition-colors">
            Retry
          </button>
        </div>
      </div>
    )
  }

  const bt = data?.billingTracker
  const projects = bt ? buildProjects(bt) : []

  const filtered = projects.filter(p => {
    const matchesFilter = filter === 'All' || p.status === filter
    const matchesSearch = !search || p.client.toLowerCase().includes(search.toLowerCase())
    return matchesFilter && matchesSearch
  })

  const counts: Record<FilterStatus, number> = {
    All: projects.length,
    Active: projects.filter(p => p.status === 'Active').length,
    'Pending Invoice': projects.filter(p => p.status === 'Pending Invoice').length,
    'In Pipeline': projects.filter(p => p.status === 'In Pipeline').length,
  }

  return (
    <div className="flex flex-col gap-5 py-6 px-4 sm:px-6">
      <div className="mx-auto w-full max-w-6xl space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Projects</h1>
            <p className="text-xs text-zinc-500 mt-0.5">{projects.length} deals from billing tracker</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setView('grid')}
              className={`rounded-lg p-1.5 transition-colors ${view === 'grid' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView('list')}
              className={`rounded-lg p-1.5 transition-colors ${view === 'list' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900 p-1">
            {FILTER_TABS.map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  filter === f ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {f}
                <span className={`ml-1.5 text-[10px] ${filter === f ? 'text-zinc-400' : 'text-zinc-700'}`}>
                  {counts[f]}
                </span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-1 min-w-[160px] max-w-xs rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5">
            <Search className="h-3.5 w-3.5 text-zinc-600 shrink-0" />
            <input
              type="text"
              placeholder="Search by client…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-xs text-zinc-300 placeholder-zinc-600 outline-none"
            />
          </div>
        </div>

        {/* Content */}
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-6 py-12 text-center">
            <p className="text-sm text-zinc-500">No projects match your filter.</p>
          </div>
        ) : view === 'grid' ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p, i) => (
              <ProjectCard key={p.ioNumber || i} project={p} />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-zinc-950 border-b border-zinc-800">
                  <th className="px-3 py-2.5 text-left font-medium text-zinc-500">IO #</th>
                  <th className="px-3 py-2.5 text-left font-medium text-zinc-500">Client</th>
                  <th className="px-3 py-2.5 text-left font-medium text-zinc-500 hidden md:table-cell">Campaign</th>
                  <th className="px-3 py-2.5 text-left font-medium text-zinc-500">Status</th>
                  <th className="px-3 py-2.5 text-right font-medium text-zinc-500">Budget</th>
                  <th className="px-3 py-2.5 text-right font-medium text-zinc-500">Margin</th>
                  <th className="px-3 py-2.5 text-left font-medium text-zinc-500 hidden lg:table-cell">Booked</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800 bg-zinc-900">
                {filtered.map((p, i) => (
                  <ProjectRow
                    key={p.ioNumber || i}
                    project={p}
                    onClick={() => setExpandedRow(expandedRow === (p.ioNumber || String(i)) ? null : (p.ioNumber || String(i)))}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </div>
  )
}
