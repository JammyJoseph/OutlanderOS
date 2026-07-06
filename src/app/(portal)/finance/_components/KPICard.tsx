'use client'

interface KPICardProps {
  label: string
  value: string
  accent?: 'default' | 'positive' | 'negative' | 'amber'
  sub?: string
  loading?: boolean
}

const ACCENT: Record<NonNullable<KPICardProps['accent']>, string> = {
  default: 'text-gray-900 dark:text-gray-100',
  positive: 'text-[#2E5E44] dark:text-[#4E8F6C]',
  negative: 'text-[#c33b2a] dark:text-red-400',
  amber: 'text-[#9C7C2E] dark:text-[#C9A44A]',
}

const ACCENT_MARK: Record<NonNullable<KPICardProps['accent']>, string> = {
  default: '#2F4B8F',
  positive: '#2E5E44',
  negative: '#c33b2a',
  amber: '#9C7C2E',
}

export default function KPICard({ label, value, accent = 'default', sub, loading }: KPICardProps) {
  return (
    <div className="rounded-lg border border-border bg-card px-5 py-4 transition-colors duration-200 hover:border-[#c9c9c6] dark:hover:border-[#3a3a3a]">
      <p className="mb-1.5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500 truncate">
        <span className="h-2 w-2 shrink-0" style={{ backgroundColor: ACCENT_MARK[accent] }} />
        {label}
      </p>
      {loading ? (
        <div className="h-7 w-24 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
      ) : (
        <p className={`font-mono text-2xl font-bold tabular-nums truncate ${ACCENT[accent]}`}>{value}</p>
      )}
      {sub && !loading && <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500 truncate">{sub}</p>}
    </div>
  )
}
