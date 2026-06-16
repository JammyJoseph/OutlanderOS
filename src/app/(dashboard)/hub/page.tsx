'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
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
    accent: '#ffd700',
    statKey: 'commercial' as keyof PortalStats,
    statLabel: 'campaigns',
  },
  {
    name: 'Production',
    description: 'Briefs, call sheets & crew',
    href: '/production',
    icon: Film,
    accent: '#ff4444',
    statKey: 'production' as keyof PortalStats,
    statLabel: 'productions',
  },
  {
    name: 'Finance',
    description: 'Deals, billing & cash flow',
    href: '/finance',
    icon: DollarSign,
    accent: '#4d9fff',
    restricted: true,
    statKey: 'finance' as keyof PortalStats,
    statLabel: 'booked',
  },
  {
    name: 'Print',
    description: 'Issues, flat plans & distribution',
    href: '/print',
    icon: Newspaper,
    accent: '#00ff88',
    statKey: 'print' as keyof PortalStats,
    statLabel: 'issues',
  },
  {
    name: 'Directory',
    description: 'Contacts, collaborators & talent',
    href: '/directory',
    icon: Contact,
    accent: '#e0e0e0',
    statKey: 'directory' as keyof PortalStats,
    statLabel: 'contacts',
  },
]

function StatBadge({ value, label, loading }: { value?: number | string; label: string | null; loading: boolean }) {
  if (!label) return null
  if (loading) {
    return <div className="mt-2 h-3 w-16 rounded bg-gray-200 animate-pulse" />
  }
  if (value === undefined || value === null) return null
  return (
    <p className="mt-2 text-[10px] font-semibold text-gray-400">
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
        const [campaigns, productions, printIssues, dashboard, contacts] = await Promise.allSettled([
          fetch('/api/campaigns').then(r => r.json()),
          fetch('/api/productions').then(r => r.json()),
          fetch('/api/print-issues').then(r => r.json()),
          fetch('/api/dashboard').then(r => r.json()),
          fetch('/api/contacts?radar=false').then(r => r.json()),
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
        if (contacts.status === 'fulfilled' && Array.isArray(contacts.value)) {
          next.directory = contacts.value.length
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
          <p className="text-xs font-semibold tracking-[0.3em] text-gray-400 uppercase mb-2">
            OutlanderOS
          </p>
          <h1 className="text-3xl font-bold text-gray-900">Choose your workspace</h1>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {PORTALS.map((portal) => {
            const Icon = portal.icon
            const statValue = portal.statKey ? stats[portal.statKey] : undefined
            return (
              <Link
                key={portal.href}
                href={portal.href}
                className="group relative flex flex-col gap-3 overflow-hidden rounded-xl border border-[#2a2a2a] bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
                style={{ borderTop: `3px solid ${portal.accent}` }}
              >
                {portal.restricted && (
                  <span className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
                    <Lock className="h-2.5 w-2.5" />
                    Admin Only
                  </span>
                )}

                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-110"
                  style={{ backgroundColor: `${portal.accent}14` }}
                >
                  <Icon className="h-5 w-5" style={{ color: portal.accent }} />
                </div>

                <div>
                  <p className="font-semibold text-gray-900 text-sm leading-tight flex items-center gap-1.5">
                    {portal.name}
                    {portal.restricted && <Lock className="h-3 w-3 text-gray-400" />}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5 leading-tight">
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
