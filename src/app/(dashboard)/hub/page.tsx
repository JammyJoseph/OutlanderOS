'use client'

import Link from 'next/link'
import {
  TrendingUp,
  Film,
  Newspaper,
  PenTool,
  BookUser,
  DollarSign,
  Shield,
  Bot,
  Lock,
} from 'lucide-react'

const PORTALS = [
  {
    name: 'Commercial',
    description: 'Pipeline, clients & media plans',
    href: '/commercial',
    icon: TrendingUp,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-100',
  },
  {
    name: 'Production',
    description: 'Briefs, call sheets & crew',
    href: '/production',
    icon: Film,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-100',
  },
  {
    name: 'Print',
    description: 'Issues, flat plans & distribution',
    href: '/print',
    icon: Newspaper,
    color: 'text-purple-600',
    bg: 'bg-purple-50',
    border: 'border-purple-100',
  },
  {
    name: 'Editorial',
    description: 'Writers, calendar & content pipeline',
    href: '/editorial',
    icon: PenTool,
    color: 'text-green-600',
    bg: 'bg-green-50',
    border: 'border-green-100',
  },
  {
    name: 'Contacts',
    description: 'Brands, press & creatives',
    href: '/contacts',
    icon: BookUser,
    color: 'text-teal-600',
    bg: 'bg-teal-50',
    border: 'border-teal-100',
  },
  {
    name: 'Finance',
    description: 'Deals, billing & cash flow',
    href: '/finance',
    icon: DollarSign,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-100',
    restricted: true,
  },
  {
    name: 'Admin',
    description: 'Team, system & settings',
    href: '/admin',
    icon: Shield,
    color: 'text-red-600',
    bg: 'bg-red-50',
    border: 'border-red-100',
    restricted: true,
  },
  {
    name: 'Ask OS',
    description: 'AI assistant for your business',
    href: '/ask-os',
    icon: Bot,
    color: 'text-gray-600',
    bg: 'bg-gray-50',
    border: 'border-gray-200',
  },
]

export default function HubPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-full py-16 px-6">
      <div className="w-full max-w-3xl">
        {/* Header */}
        <div className="text-center mb-10">
          <p className="text-xs font-semibold tracking-[0.3em] text-gray-400 uppercase mb-2">
            OutlanderOS
          </p>
          <h1 className="text-3xl font-bold text-gray-900">Choose your workspace</h1>
        </div>

        {/* Portal grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {PORTALS.map((portal) => {
            const Icon = portal.icon
            return (
              <Link
                key={portal.href}
                href={portal.href}
                className={`group relative flex flex-col gap-3 rounded-xl border ${portal.border} bg-white p-5 transition-all hover:shadow-md hover:-translate-y-0.5`}
              >
                {/* Lock badge */}
                {portal.restricted && (
                  <span className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
                    <Lock className="h-2.5 w-2.5" />
                    Admin Only
                  </span>
                )}

                {/* Icon */}
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${portal.bg}`}>
                  <Icon className={`h-5 w-5 ${portal.color}`} />
                </div>

                {/* Text */}
                <div>
                  <p className="font-semibold text-gray-900 text-sm leading-tight flex items-center gap-1.5">
                    {portal.name}
                    {portal.restricted && <Lock className="h-3 w-3 text-gray-400" />}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5 leading-tight">
                    {portal.description}
                  </p>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
