'use client'

interface KPICardProps {
  label: string
  value: string
  accent?: 'default' | 'positive' | 'negative' | 'amber'
  sub?: string
  loading?: boolean
}

const ACCENT: Record<NonNullable<KPICardProps['accent']>, string> = {
  default: 'text-foreground',
  positive: 'text-ok',
  negative: 'text-bad',
  amber: 'text-warn',
}

export default function KPICard({ label, value, accent = 'default', sub, loading }: KPICardProps) {
  return (
    <div className="rounded-2xl bg-surface p-6">
      <p className="truncate text-sm text-muted-foreground">{label}</p>
      {loading ? (
        <div className="mt-2.5 h-8 w-28 animate-pulse rounded-md bg-surface-2" />
      ) : (
        <p className={`mt-2.5 truncate text-[30px] font-semibold leading-none tracking-[-0.01em] tabular-nums ${ACCENT[accent]}`}>{value}</p>
      )}
      {sub && !loading && <p className="mt-2 truncate text-sm text-muted-foreground">{sub}</p>}
    </div>
  )
}
