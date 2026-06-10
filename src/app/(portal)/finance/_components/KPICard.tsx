'use client'

interface KPICardProps {
  label: string
  value: string
  accent?: 'default' | 'positive' | 'negative' | 'amber'
  sub?: string
  loading?: boolean
}

const ACCENT: Record<NonNullable<KPICardProps['accent']>, string> = {
  default: 'text-gray-900',
  positive: 'text-emerald-600',
  negative: 'text-red-500',
  amber: 'text-[#D4A853]',
}

export default function KPICard({ label, value, accent = 'default', sub, loading }: KPICardProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 truncate">
        {label}
      </p>
      {loading ? (
        <div className="h-7 w-24 animate-pulse rounded bg-gray-100" />
      ) : (
        <p className={`font-mono text-2xl font-bold tabular-nums truncate ${ACCENT[accent]}`}>{value}</p>
      )}
      {sub && !loading && <p className="mt-1 text-[11px] text-gray-400 truncate">{sub}</p>}
    </div>
  )
}
