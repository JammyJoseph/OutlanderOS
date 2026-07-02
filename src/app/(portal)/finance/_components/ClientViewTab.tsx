'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ArrowUpRight, Briefcase, Clapperboard, Users } from 'lucide-react'
import { StatusBadge, ErrorBox, TabSkeleton, EmptyState } from './FinanceBits'
import {
  useFinanceFetch,
  fmtGBP,
  fmtDate,
  displayStatus,
  rollupByClient,
  BUDGET_STATUS_STYLES,
  type ProjectsResponse,
  type ProjectSummary,
  type ClientRollup,
} from './finance-utils'

function StatTile({ label, value, cls }: { label: string; value: string; cls?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
      <p className={`font-mono text-lg font-bold tabular-nums ${cls ?? 'text-gray-900'}`}>{value}</p>
    </div>
  )
}

// Horizontal breakdown bar: media spend vs production cost vs margin.
function BreakdownBar({ media, production, margin }: { media: number; production: number; margin: number }) {
  const total = media + production + margin
  if (total <= 0) return null
  const seg = [
    { label: 'Media spend', value: media, color: 'bg-[#4d9fff]' },
    { label: 'Production cost', value: production, color: 'bg-[#ff4444]' },
    { label: 'Margin', value: margin, color: 'bg-[#ffd700]' },
  ].filter((s) => s.value > 0)
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-gray-100">
        {seg.map((s) => (
          <div key={s.label} className={`h-full ${s.color}`} style={{ width: `${(s.value / total) * 100}%` }} title={`${s.label}: ${fmtGBP(s.value)}`} />
        ))}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-gray-500">
        {seg.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1">
            <span className={`h-2 w-2 rounded-full ${s.color}`} /> {s.label} <span className="font-mono text-gray-700">{fmtGBP(s.value)}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

function ClientCard({ r, onOpen }: { r: ClientRollup; onOpen: () => void }) {
  return (
    <div
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onOpen()
      }}
      className="cursor-pointer rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="truncate text-sm font-semibold text-gray-900">{r.clientName}</p>
        <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">
          {r.dealCount} project{r.dealCount === 1 ? '' : 's'}
        </span>
      </div>
      <dl className="mb-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
        <div>
          <dt className="text-gray-400">Budget (exc. VAT)</dt>
          <dd className="font-mono font-semibold text-gray-900">{fmtGBP(r.totalBudget)}</dd>
        </div>
        <div>
          <dt className="text-gray-400">Spent</dt>
          <dd className={`font-mono font-semibold ${r.totalSpent > r.totalBudget ? 'text-red-500' : 'text-gray-900'}`}>{fmtGBP(r.totalSpent)}</dd>
        </div>
        <div>
          <dt className="text-gray-400">Outstanding</dt>
          <dd className={`font-mono ${r.totalOutstanding < 0 ? 'text-red-500' : 'text-gray-700'}`}>{fmtGBP(r.totalOutstanding)}</dd>
        </div>
        <div>
          <dt className="text-gray-400">Margin</dt>
          <dd className="font-mono text-[#e6c200]">{fmtGBP(r.margin)}</dd>
        </div>
      </dl>
      <BreakdownBar media={r.mediaSpend} production={r.productionCost} margin={r.margin} />
    </div>
  )
}

function ClientDetail({ r, onBack, onOpenProject }: { r: ClientRollup; onBack: () => void; onOpenProject: (p: ProjectSummary) => void }) {
  return (
    <div className="space-y-5">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 transition-colors hover:text-gray-800">
        <ArrowLeft className="h-3.5 w-3.5" /> All clients
      </button>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{r.clientName}</h2>
          <p className="text-xs text-gray-500">{r.dealCount} project{r.dealCount === 1 ? '' : 's'} · last active {fmtDate(r.updatedAt)}</p>
        </div>
        {r.clientId && (
          <Link
            href={`/commercial/clients/${r.clientId}`}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-[#4d9fff] hover:text-[#3d8fef]"
          >
            <Briefcase className="h-3 w-3" /> View in Commercial <ArrowUpRight className="h-3 w-3" />
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Total Budget (exc. VAT)" value={fmtGBP(r.totalBudget)} />
        <StatTile label="Total Spent" value={fmtGBP(r.totalSpent)} cls={r.totalSpent > r.totalBudget ? 'text-red-500' : 'text-gray-900'} />
        <StatTile label="Outstanding" value={fmtGBP(r.totalOutstanding)} cls={r.totalOutstanding < 0 ? 'text-red-500' : 'text-gray-900'} />
        <StatTile label="Margin" value={fmtGBP(r.margin)} cls="text-[#e6c200]" />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Spending Breakdown</p>
        <BreakdownBar media={r.mediaSpend} production={r.productionCost} margin={r.margin} />
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 bg-gray-50/70 px-4 py-2.5">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-700">Projects</p>
        </div>
        <div className="hidden grid-cols-12 gap-2 border-b border-gray-100 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400 sm:grid">
          <div className="col-span-4">Project</div>
          <div className="col-span-2 text-right">Budget (exc. VAT)</div>
          <div className="col-span-2 text-right">Spent</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2 text-right">Updated</div>
        </div>
        <ul className="divide-y divide-gray-50">
          {r.projects.map((p) => (
            <li
              key={p.id}
              onClick={() => onOpenProject(p)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') onOpenProject(p)
              }}
              className={`grid cursor-pointer grid-cols-2 gap-2 px-4 py-2.5 text-xs transition-colors hover:bg-gray-50/70 sm:grid-cols-12 ${p.archived ? 'opacity-60' : ''}`}
            >
              <div className="col-span-2 min-w-0 sm:col-span-4">
                <p className="flex items-center gap-1.5 truncate font-semibold text-gray-900">
                  {p.source === 'production' ? <Clapperboard className="h-3 w-3 shrink-0 text-[#ff4444]" /> : <Briefcase className="h-3 w-3 shrink-0 text-gray-400" />}
                  <span className="truncate">{p.campaignName}</span>
                </p>
                {p.shootDate && <p className="text-[10px] text-gray-400">Shoot {fmtDate(p.shootDate)}</p>}
              </div>
              <div className="text-right font-mono text-gray-900 sm:col-span-2">
                <span className="text-gray-400 sm:hidden">Budget </span>{fmtGBP(p.budgetExVat)}
              </div>
              <div className={`text-right font-mono sm:col-span-2 ${p.spent > p.budgetExVat ? 'text-red-500' : 'text-gray-700'}`}>
                <span className="text-gray-400 sm:hidden">Spent </span>{fmtGBP(p.spent)}
              </div>
              <div className="sm:col-span-2">
                <StatusBadge status={displayStatus(p.status)} rawKey={p.status} map={BUDGET_STATUS_STYLES} />
              </div>
              <div className="text-right font-mono text-[10px] text-gray-400 sm:col-span-2">{fmtDate(p.updatedAt)}</div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export default function ClientViewTab() {
  const router = useRouter()
  const res = useFinanceFetch<ProjectsResponse>('/api/finance/projects')
  const [showArchived, setShowArchived] = useState(false)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  const clients = useMemo(() => {
    const projects = (res.data?.projects ?? []).filter((p) => showArchived || !p.archived)
    return rollupByClient(projects)
  }, [res.data, showArchived])

  function keyOf(r: ClientRollup): string {
    return r.clientId ?? r.clientName.trim().toLowerCase()
  }

  function openProject(p: ProjectSummary) {
    if (p.source === 'production' && p.productionId) {
      router.push(`/production/${p.productionId}`)
    } else {
      router.push(`/finance?tab=projects&project=${p.id}`)
    }
  }

  if (res.loading) return <TabSkeleton />
  if (res.error || res.data?.error) return <ErrorBox message={`Failed to load clients: ${res.error ?? res.data?.error}`} />

  const selected = selectedKey ? clients.find((r) => keyOf(r) === selectedKey) ?? null : null
  if (selected) return <ClientDetail r={selected} onBack={() => setSelectedKey(null)} onOpenProject={openProject} />

  const totalBudget = clients.reduce((s, r) => s + r.totalBudget, 0)
  const totalSpent = clients.reduce((s, r) => s + r.totalSpent, 0)
  const archivedCount = (res.data?.projects ?? []).filter((p) => p.archived).length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[11px] text-gray-400">
          <Users className="h-3.5 w-3.5" />
          {clients.length} client{clients.length === 1 ? '' : 's'} · {fmtGBP(totalBudget)} budget (exc. VAT) · {fmtGBP(totalSpent)} spent
        </p>
        {archivedCount > 0 && (
          <button
            onClick={() => setShowArchived((v) => !v)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${showArchived ? 'bg-gray-300 text-gray-800' : 'border border-gray-200 bg-white text-gray-500 hover:bg-gray-50'}`}
          >
            {showArchived ? 'Hide archived' : `Include archived (${archivedCount})`}
          </button>
        )}
      </div>

      {clients.length === 0 ? (
        <EmptyState message="No client spending yet — budgets from Commercial and production appear here grouped by client." />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((r) => (
            <ClientCard key={keyOf(r)} r={r} onOpen={() => setSelectedKey(keyOf(r))} />
          ))}
        </div>
      )}
    </div>
  )
}
