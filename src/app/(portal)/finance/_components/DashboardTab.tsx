'use client'

import Link from 'next/link'
import { ArrowDownLeft, ArrowUpRight, Flag, Landmark } from 'lucide-react'
import { Avatar, Panel, Row, Rows, Split, Stat, StatGrid, Tag, TextLink, pill } from '@/components/os'
import PositionPanel from './PositionPanel'
import { StatusBadge, XeroDisconnectedBanner, ErrorBox, TabSkeleton, XeroStatusDot } from './FinanceBits'
import {
  useFinanceFetch,
  fmtGBP,
  fmtPct,
  fmtDate,
  daysUntil,
  marginPct,
  displayStatus,
  SUBMISSION_STATUS_STYLES,
  INVOICE_STATUS_STYLES,
  OVERAGE_STATUS_LABELS,
  type InvoicesResponse,
  type OverviewResponse,
  type ProjectsResponse,
} from './finance-utils'

// Redesign board 6.1: the cash figure and one row of actions, the year in
// four numbers, then the two lists finance acts on — what needs approving and
// who owes us — with the full provenance panel underneath.

interface AgedRow {
  contact: string
  total: number
  current: number
  period1: number
  period2: number
  period3: number
}

interface AgedResponse {
  xeroConnected: boolean
  rows: AgedRow[]
  total: number
  count: number
  error?: string
}

const APPROVABLE = new Set(['RECEIVED', 'UNDER_REVIEW', 'REVIEWED'])

function NeedsApproval() {
  const inv = useFinanceFetch<InvoicesResponse>('/api/finance/invoices')
  const proj = useFinanceFetch<ProjectsResponse>('/api/finance/projects')
  const projects = new Map((proj.data?.projects ?? []).map((p) => [p.id, p]))
  const queue = (inv.data?.invoices ?? []).filter((i) => APPROVABLE.has(i.status))

  return (
    <Panel
      title={`Needs your approval${queue.length ? ` · ${queue.length}` : ''}`}
      action={queue.length > 0 ? <TextLink href="/finance?tab=invoices">See all</TextLink> : undefined}
    >
      {inv.loading ? (
        <div className="h-40 animate-pulse rounded-xl bg-surface-2" />
      ) : inv.error || inv.data?.error ? (
        <p className="py-4 text-[15px] text-bad">Couldn&rsquo;t load supplier invoices.</p>
      ) : queue.length === 0 ? (
        <p className="py-4 text-[15px] text-muted-foreground">Nothing waiting. Every supplier invoice has been dealt with.</p>
      ) : (
        <Rows>
          {queue.slice(0, 5).map((i) => {
            const project = i.campaignBudgetId ? projects.get(i.campaignBudgetId) : null
            const days = daysUntil(i.paymentDeadline)
            return (
              <Row
                key={i.id}
                href={`/finance?tab=invoices&invoice=${i.id}`}
                lead={<Avatar name={i.supplierName} tone="card" />}
                title={
                  <span className="inline-flex items-center gap-1.5">
                    {i.flagged && <Flag className="size-3.5 shrink-0 text-bad" aria-label="Flagged" />}
                    {i.supplierName}
                  </span>
                }
                meta={
                  <span className="truncate">
                    {[project?.campaignName, i.description].filter(Boolean).join(' · ') || 'No project'}
                    {days !== null && days < 0 ? ` · ${Math.abs(days)} days overdue` : ''}
                  </span>
                }
                trail={<span className="shrink-0 font-semibold tabular-nums">{i.amount != null ? fmtGBP(i.amount) : '—'}</span>}
              />
            )
          })}
        </Rows>
      )}
    </Panel>
  )
}

function OwedToUs() {
  const res = useFinanceFetch<AgedResponse>('/api/finance/aged-receivables')
  const rows = (res.data?.rows ?? []).slice().sort((a, b) => b.period3 + b.period2 + b.period1 - (a.period3 + a.period2 + a.period1) || b.total - a.total)

  return (
    <Panel title="Owed to us" action={<span className="text-sm text-muted-foreground">By age</span>}>
      {res.loading ? (
        <div className="h-40 animate-pulse rounded-xl bg-surface-2" />
      ) : res.error || res.data?.error ? (
        <p className="py-4 text-[15px] text-bad">Couldn&rsquo;t load receivables.</p>
      ) : !res.data?.xeroConnected ? (
        <p className="py-4 text-[15px] text-muted-foreground">Xero isn&rsquo;t connected, so client invoices can&rsquo;t be shown.</p>
      ) : rows.length === 0 ? (
        <p className="py-4 text-[15px] text-muted-foreground">Nothing outstanding. Everything is collected.</p>
      ) : (
        <Rows>
          {rows.slice(0, 5).map((r) => {
            const overdue = r.period1 + r.period2 + r.period3
            const worst = r.period3 > 0 ? '60+ days' : r.period2 > 0 ? '31–60 days' : r.period1 > 0 ? '1–30 days' : null
            return (
              <Row
                key={r.contact}
                lead={<Avatar name={r.contact} tone="card" />}
                title={r.contact || '—'}
                meta={overdue > 0 ? `${fmtGBP(overdue)} overdue` : 'Not yet due'}
                trail={
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className="font-semibold tabular-nums">{fmtGBP(r.total)}</span>
                    {worst ? <Tag tone={r.period3 > 0 || r.period2 > 0 ? 'bad' : 'warn'}>Overdue {worst}</Tag> : <Tag tone="plain">Current</Tag>}
                  </span>
                }
              />
            )
          })}
        </Rows>
      )}
      {rows.length > 5 && (
        <TextLink href="/finance?tab=invoices&section=outgoing" className="mt-3 inline-block">
          All {rows.length} clients
        </TextLink>
      )}
    </Panel>
  )
}

function OverageAlerts({ o }: { o: OverviewResponse }) {
  const alerts = o.overageAlerts ?? []
  if (alerts.length === 0) return null
  return (
    <Panel title={`Budget alerts · ${alerts.length}`}>
      <Rows>
        {alerts.map((a) => (
          <Row
            key={a.id}
            href={`/finance?tab=projects&project=${a.id}`}
            title={a.campaignName}
            meta={
              <span className="truncate">
                {a.clientName} · {fmtGBP(a.totalCosts)} of {fmtGBP(a.totalBudget)}
              </span>
            }
            trail={
              <Tag tone={a.overageStatus === 'OVERAGE' ? 'bad' : 'warn'}>
                {a.overageStatus === 'OVERAGE' ? `${fmtGBP(Math.abs(a.overBy))} over` : OVERAGE_STATUS_LABELS[a.overageStatus]}
              </Tag>
            }
          />
        ))}
      </Rows>
    </Panel>
  )
}

function ActivityFeed({ o }: { o: OverviewResponse }) {
  const items = o.recentActivity ?? []
  return (
    <Panel title="Recent invoice activity">
      {items.length === 0 ? (
        <p className="py-4 text-[15px] text-muted-foreground">No invoice activity yet.</p>
      ) : (
        <Rows>
          {items.map((a) => (
            <Row
              key={`${a.type}-${a.id}`}
              lead={
                <span
                  className="flex size-10 shrink-0 items-center justify-center rounded-full bg-background"
                  aria-label={a.type === 'incoming' ? 'Supplier invoice' : 'Client invoice'}
                >
                  {a.type === 'incoming' ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
                </span>
              }
              title={
                <span className="inline-flex items-center gap-1.5">
                  {a.label}
                  {a.flagged && <Flag className="size-3.5 shrink-0 text-bad" aria-label="Flagged" />}
                </span>
              }
              meta={
                <span className="truncate">
                  {a.type === 'incoming' ? 'Supplier invoice' : 'Client invoice'}
                  {a.detail ? ` · ${a.detail}` : ''} · {fmtDate(a.date)}
                </span>
              }
              trail={
                <span className="flex shrink-0 items-center gap-3">
                  <span className="font-semibold tabular-nums">{a.amount != null ? fmtGBP(a.amount) : '—'}</span>
                  <StatusBadge
                    status={displayStatus(a.status)}
                    map={a.type === 'incoming' ? SUBMISSION_STATUS_STYLES : INVOICE_STATUS_STYLES}
                    rawKey={a.status}
                  />
                </span>
              }
            />
          ))}
        </Rows>
      )}
    </Panel>
  )
}

export default function DashboardTab() {
  const ov = useFinanceFetch<OverviewResponse>('/api/finance/overview')

  if (ov.loading) return <TabSkeleton />
  if (ov.error || ov.data?.error) return <ErrorBox message={`Failed to load dashboard: ${ov.error ?? ov.data?.error}`} />

  const o = ov.data!
  const connected = o.xeroConnected
  const pl = o.profitAndLoss
  const margin = marginPct(pl.profit, pl.revenue)
  const approvals = o.pendingApprovals ?? 0

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-5">
        <div>
          <p className="mb-1.5 flex flex-wrap items-center gap-2.5 text-base text-muted-foreground">
            Cash in the bank
            <XeroStatusDot connected={connected} error={o.xeroError} organisation={o.organisation} />
          </p>
          <p
            className={`text-[36px] font-semibold leading-none tracking-[-0.02em] tabular-nums sm:text-[44px] ${
              connected && (o.bankBalance?.balance ?? 0) < 0 ? 'text-bad' : ''
            }`}
          >
            {connected ? fmtGBP(o.bankBalance?.balance, { decimals: true }) : '—'}
          </p>
          {connected && o.bankBalance?.accountName && (
            <p className="mt-2 text-sm text-muted-foreground">{o.bankBalance.accountName}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Link href="/finance?tab=invoices" className={pill(approvals > 0 ? 'primary' : 'secondary')}>
            {approvals > 0 ? `Review ${approvals} approval${approvals === 1 ? '' : 's'}` : 'Invoices and approvals'}
          </Link>
          <Link href="/finance?tab=expenses" className={pill('secondary')}>
            Expenses
          </Link>
          <Link href="/finance?tab=projects" className={pill('secondary')}>
            Project folders
          </Link>
          <Link href="/finance?tab=pl" className={pill('secondary')}>
            P&amp;L and history
          </Link>
        </div>
      </section>

      {!connected && (
        <XeroDisconnectedBanner message={`Xero is disconnected${o.xeroError ? ` (${o.xeroError})` : ''} — receivables, payables and P&L are unavailable.`} />
      )}

      <StatGrid aria-label="Year to date, from Xero">
        <Stat label="Revenue this year" value={connected ? fmtGBP(pl.revenue) : '—'} note="Year to date · Xero" />
        <Stat
          label="Owed to us"
          value={connected ? fmtGBP(o.outstandingReceivables) : '—'}
          note={connected && o.overdueReceivables > 0 ? `${fmtGBP(o.overdueReceivables)} overdue` : `${o.receivableCount ?? 0} invoices`}
          noteTone={connected && o.overdueReceivables > 0 ? 'bad' : undefined}
        />
        <Stat
          label="Bills to pay"
          value={connected ? fmtGBP(o.outstandingPayables) : '—'}
          note={`${o.payableCount ?? 0} bill${o.payableCount === 1 ? '' : 's'}`}
        />
        <Stat
          label="Margin this year"
          value={connected ? fmtPct(margin) : '—'}
          note={connected ? `${fmtGBP(pl.profit)} profit · ${fmtGBP(pl.expenses)} costs` : undefined}
          noteTone={connected && (margin ?? 0) < 0 ? 'bad' : undefined}
        />
      </StatGrid>

      <Split main={<NeedsApproval />} side={<OwedToUs />} />

      <OverageAlerts o={o} />

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Where the money stands</h2>
        <PositionPanel />
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-surface px-6 py-4">
          <p className="flex items-center gap-2 text-[15px] text-ink-2">
            <Landmark className="size-4 shrink-0" /> Wize multi-currency balances will show here once it&rsquo;s connected.
          </p>
          <button disabled className={pill('outline', 'sm')} title="Wize integration coming soon">
            Connect Wize
          </button>
        </div>
      </section>

      <ActivityFeed o={o} />
    </div>
  )
}
