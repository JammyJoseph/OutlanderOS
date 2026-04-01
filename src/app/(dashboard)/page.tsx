import { cookies } from 'next/headers'
import Link from 'next/link'
import { CheckCircle2, Mail, Calendar, TableProperties, ArrowRight, Zap, Clock, FolderOpen, FileText, Activity } from 'lucide-react'

const steps = [
  {
    id: 'primary',
    label: 'Connect primary Google account',
    description: 'q@outlandermag.com — Gmail, Calendar, Drive',
    icon: Mail,
    connectLabel: 'primary',
  },
  {
    id: 'billing',
    label: 'Connect billing Google account',
    description: 'billing@outlandermag.com — Gmail, invoices, finance emails',
    icon: Calendar,
    connectLabel: 'billing',
  },
  {
    id: 'sheets',
    label: 'Link billing tracker spreadsheet',
    description: 'Connect your 2026 Master Billing Tracker Google Sheet',
    icon: TableProperties,
    connectLabel: null,
  },
]

function SkeletonPulse() {
  return (
    <div className="h-7 w-16 animate-pulse rounded bg-zinc-800" />
  )
}

function StatCard({
  label,
  icon: Icon,
  syncing = true,
  value,
  sub,
}: {
  label: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: React.ComponentType<any>
  syncing?: boolean
  value?: string
  sub?: string
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-center gap-2 text-zinc-500">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="flex items-end gap-2">
        {syncing ? (
          <div className="flex items-center gap-2">
            <SkeletonPulse />
            <span className="text-[10px] text-zinc-600">Syncing…</span>
          </div>
        ) : (
          <>
            <span className="text-2xl font-bold text-white">{value}</span>
            {sub && <span className="mb-0.5 text-xs text-zinc-500">{sub}</span>}
          </>
        )}
      </div>
    </div>
  )
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function formatDate() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export default async function DashboardPage() {
  const cookieStore = await cookies()
  const primaryConnected = cookieStore.has('google_primary_token')
  const billingConnected = cookieStore.has('google_billing_token')
  const bothConnected = primaryConnected && billingConnected
  const anyConnected = primaryConnected || billingConnected

  if (bothConnected) {
    return (
      <div className="flex min-h-full flex-col py-8 px-4 sm:px-6">
        <div className="mx-auto w-full max-w-3xl space-y-8">

          {/* Greeting */}
          <div>
            <h1 className="text-2xl font-bold text-white">
              {getGreeting()}, <span className="text-[#D4A853]">Joe</span>
            </h1>
            <p className="mt-1 text-sm text-zinc-500">{formatDate()}</p>
          </div>

          {/* Quick stats */}
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Live Overview
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="Unread emails" icon={Mail} syncing />
              <StatCard label="Today's events" icon={Calendar} syncing />
              <StatCard label="Outstanding invoices" icon={FileText} syncing />
              <StatCard label="Active projects" icon={FolderOpen} syncing />
            </div>
            <p className="mt-2 text-[11px] text-zinc-600">
              Data will populate once your agents finish their first sync.
            </p>
          </section>

          {/* Priority actions */}
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Priority Actions
            </h2>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-8 text-center">
              <Zap className="mx-auto mb-3 h-6 w-6 text-zinc-700" />
              <p className="text-sm font-medium text-zinc-400">No actions yet</p>
              <p className="mt-1 text-xs text-zinc-600">
                Your agents will surface priorities here once fully connected and synced.
              </p>
            </div>
          </section>

          {/* Recent activity */}
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Recent Activity
            </h2>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-8 text-center">
              <Activity className="mx-auto mb-3 h-6 w-6 text-zinc-700" />
              <p className="text-sm font-medium text-zinc-400">No activity yet</p>
              <p className="mt-1 text-xs text-zinc-600">
                Activity will appear here as your agent team works.
              </p>
            </div>
          </section>

          {/* Quick nav */}
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Quick Links
            </h2>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Email', href: '/email', description: 'billing@outlandermag.com', icon: Mail },
                { label: 'Calendar', href: '/calendar', description: 'Schedule & events', icon: Calendar },
                { label: 'Agent Office', href: '/office', description: 'Your AI team', icon: Clock },
              ].map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="group flex flex-col gap-1 rounded-xl border border-zinc-800 bg-zinc-900 p-4 transition-colors hover:border-[#D4A853]/40 hover:bg-zinc-800"
                >
                  <action.icon className="mb-1 h-4 w-4 text-zinc-600 group-hover:text-[#D4A853] transition-colors" />
                  <span className="text-sm font-medium text-zinc-100 group-hover:text-[#D4A853] transition-colors">
                    {action.label}
                  </span>
                  <span className="text-xs text-zinc-600">{action.description}</span>
                  <ArrowRight className="mt-auto h-3.5 w-3.5 text-zinc-600 group-hover:text-[#D4A853] transition-colors" />
                </Link>
              ))}
            </div>
          </section>

        </div>
      </div>
    )
  }

  // Setup wizard — partial or no connection
  const stepStatus = {
    primary: primaryConnected,
    billing: billingConnected,
    sheets: false,
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center py-16 px-4">
      <div className="w-full max-w-xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-white">
            Welcome to <span className="text-[#D4A853]">OutlanderOS</span>
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            {anyConnected
              ? 'Almost there — complete setup to activate your dashboard.'
              : 'Connect your accounts to get started. Once set up, your dashboard will show live data.'}
          </p>
        </div>

        <div className="space-y-3">
          {steps.map((step, i) => {
            const Icon = step.icon
            const done = stepStatus[step.id as keyof typeof stepStatus]
            return (
              <div
                key={step.id}
                className={`flex items-center gap-4 rounded-xl border p-4 transition-colors ${
                  done
                    ? 'border-emerald-800/40 bg-emerald-900/10'
                    : 'border-zinc-800 bg-zinc-900'
                }`}
              >
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${
                  done
                    ? 'border-emerald-700/40 bg-emerald-900/20'
                    : 'border-zinc-700 bg-zinc-800'
                }`}>
                  {done ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  ) : (
                    <span className="text-sm font-bold text-zinc-400">{i + 1}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${done ? 'text-emerald-300' : 'text-zinc-100'}`}>
                    {step.label}
                  </p>
                  <p className="text-xs text-zinc-500 mt-0.5">{step.description}</p>
                </div>
                <div className="shrink-0">
                  {done ? (
                    <span className="text-xs text-emerald-500 font-medium">Done</span>
                  ) : step.connectLabel ? (
                    <a
                      href={`/api/google/connect?label=${step.connectLabel}`}
                      className="rounded-lg bg-[#D4A853] px-3 py-1.5 text-xs font-medium text-zinc-900 hover:bg-[#C49843] transition-colors"
                    >
                      Connect
                    </a>
                  ) : (
                    <Link
                      href="/settings"
                      className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
                    >
                      Go to Settings
                    </Link>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-8 flex items-center justify-center gap-6 text-xs text-zinc-600">
          <Link href="/settings" className="hover:text-zinc-400 transition-colors">
            Settings
          </Link>
          <span>·</span>
          <span>All data is read-only — OutlanderOS never modifies your accounts</span>
        </div>
      </div>
    </div>
  )
}
