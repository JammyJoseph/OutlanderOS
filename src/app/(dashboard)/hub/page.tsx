'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getJson } from '@/lib/session-fetch'
import {
  TrendingUp,
  Film,
  Newspaper,
  DollarSign,
  Lock,
  Contact,
} from 'lucide-react'

interface PortalStats {
  commercial?: number
  production?: number
  print?: number
  finance?: string
  directory?: number
}

const PORTALS = [
  {
    name: 'Commercial',
    description: 'Deal pipeline, clients & media plans',
    href: '/commercial',
    icon: TrendingUp,
    accent: '#9C7C2E',
    statKey: 'commercial' as keyof PortalStats,
    statLabel: 'campaigns',
  },
  {
    name: 'Production',
    description: 'Briefs, call sheets & crew',
    href: '/production',
    icon: Film,
    accent: '#A93B2E',
    statKey: 'production' as keyof PortalStats,
    statLabel: 'productions',
  },
  {
    name: 'Finance',
    description: 'Deals, billing & cash flow',
    href: '/finance',
    icon: DollarSign,
    accent: '#2F4B8F',
    restricted: true,
    statKey: 'finance' as keyof PortalStats,
    statLabel: 'booked',
  },
  {
    name: 'Print',
    description: 'Issues, flat plans & distribution',
    href: '/print',
    icon: Newspaper,
    accent: '#2E5E44',
    statKey: 'print' as keyof PortalStats,
    statLabel: 'issues',
  },
  {
    name: 'Directory',
    description: 'Contacts, collaborators & talent',
    href: '/directory',
    icon: Contact,
    accent: '#5B6470',
    statKey: 'directory' as keyof PortalStats,
    statLabel: 'contacts',
  },
]

function StatBadge({ value, label, loading }: { value?: number | string; label: string | null; loading: boolean }) {
  if (!label) return null
  if (loading) {
    return <div className="mt-2 h-3 w-16 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
  }
  if (value === undefined || value === null) return null
  return (
    <p className="mt-2 text-[10px] font-semibold text-gray-400 dark:text-gray-500">
      {typeof value === 'number' ? `${value} ${label}` : value}
    </p>
  )
}

export default function HubPage() {
  const [stats, setStats] = useState<PortalStats>({})
  const [loadingStats, setLoadingStats] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      try {
        // Stats are decorative — a single failure just hides that tile. But a 401
        // means the session lapsed while this tab sat open, and getJson bounces to
        // /login rather than leaving the hub showing blank counts.
        const [campaigns, productions, printIssues, dashboard, contacts] = await Promise.allSettled([
          getJson<unknown>('/api/campaigns'),
          getJson<unknown>('/api/productions'),
          getJson<unknown>('/api/print-issues'),
          // bookedRevenue arrives preformatted for display ('£1,234' or '—').
          getJson<{ billingTracker?: { bookedRevenue?: string } }>('/api/dashboard'),
          getJson<unknown>('/api/contacts?radar=false'),
        ])

        const next: PortalStats = {}
        if (campaigns.status === 'fulfilled' && Array.isArray(campaigns.value)) {
          next.commercial = campaigns.value.length
        }
        if (productions.status === 'fulfilled' && Array.isArray(productions.value)) {
          next.production = productions.value.length
        }
        if (printIssues.status === 'fulfilled' && Array.isArray(printIssues.value)) {
          next.print = printIssues.value.length
        }
        if (dashboard.status === 'fulfilled' && dashboard.value?.billingTracker?.bookedRevenue) {
          next.finance = dashboard.value.billingTracker.bookedRevenue
        }
        if (contacts.status === 'fulfilled') {
          // /api/contacts answers with a bare array, a {data:[]} envelope, or a
          // {total} count depending on the query — accept all three.
          const v = contacts.value as { total?: number; data?: unknown[] } | unknown[]
          if (Array.isArray(v)) next.directory = v.length
          else if (typeof v?.total === 'number') next.directory = v.total
          else if (Array.isArray(v?.data)) next.directory = v.data.length
        }
        setStats(next)
      } catch {
        // Non-fatal — stats just won't show
      } finally {
        setLoadingStats(false)
      }
    }
    fetchStats()
  }, [])

  return (
    <div className="flex flex-col items-center justify-center min-h-full py-16 px-6">
      <div className="w-full max-w-5xl">
        <div className="text-center mb-10">
          <p className="text-xs font-semibold tracking-[0.3em] text-gray-400 dark:text-gray-500 uppercase mb-2">
            OutlanderOS
          </p>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Choose your workspace</h1>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {PORTALS.map((portal) => {
            const Icon = portal.icon
            const statValue = portal.statKey ? stats[portal.statKey] : undefined
            return (
              <Link
                key={portal.href}
                href={portal.href}
                className="group relative flex flex-col gap-3 overflow-hidden rounded-lg border border-border bg-white dark:bg-gray-900 p-5 transition-colors duration-200 hover:border-[#c9c9c6] dark:hover:border-[#3a3a3a]"
              >
                {portal.restricted && (
                  <span className="absolute top-3 right-3 flex items-center gap-1 rounded bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 dark:text-gray-400">
                    <Lock className="h-2.5 w-2.5" />
                    Admin Only
                  </span>
                )}

                <div
                  className="flex h-10 w-10 items-center justify-center rounded-md"
                  style={{ backgroundColor: `${portal.accent}14` }}
                >
                  <Icon className="h-5 w-5" style={{ color: portal.accent }} />
                </div>

                <div>
                  <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm leading-tight flex items-center gap-1.5">
                    <span className="h-2 w-2 shrink-0" style={{ backgroundColor: portal.accent }} />
                    {portal.name}
                    {portal.restricted && <Lock className="h-3 w-3 text-gray-400 dark:text-gray-500" />}
                  </p>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 leading-tight">
                    {portal.description}
                  </p>
                  <StatBadge value={statValue} label={portal.statLabel ?? null} loading={loadingStats && portal.statKey !== null} />
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
