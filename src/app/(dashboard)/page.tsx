import { cookies } from 'next/headers'
import Link from 'next/link'
import { CheckCircle2, Circle, Mail, Calendar, TableProperties, ArrowRight, Zap } from 'lucide-react'

const ACCOUNT_META: Record<string, { label: string; email: string; description: string }> = {
  primary: {
    label: 'Primary Account',
    email: 'q@outlandermag.com',
    description: 'Gmail · Calendar · Drive',
  },
  billing: {
    label: 'Billing Account',
    email: 'billing@outlandermag.com',
    description: 'Gmail · Invoices · Finance emails',
  },
}

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

export default async function DashboardPage() {
  const cookieStore = await cookies()
  const primaryConnected = cookieStore.has('google_primary_token')
  const billingConnected = cookieStore.has('google_billing_token')
  const bothConnected = primaryConnected && billingConnected
  const anyConnected = primaryConnected || billingConnected

  const primaryToken = cookieStore.get('google_primary_token')
  const billingToken = cookieStore.get('google_billing_token')

  // Try to get emails from token cookies (they may be JSON-encoded with email info)
  // Fall back to known emails
  const primaryEmail = 'q@outlandermag.com'
  const billingEmail = 'billing@outlandermag.com'

  if (bothConnected) {
    return (
      <div className="flex min-h-full flex-col py-10 px-4 sm:px-6">
        <div className="mx-auto w-full max-w-2xl space-y-6">
          {/* Connected banner */}
          <div className="flex items-start gap-4 rounded-xl border border-emerald-800/40 bg-emerald-900/10 p-5">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
              <Zap className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-emerald-300">OutlanderOS is connected</h1>
              <p className="mt-0.5 text-sm text-emerald-600">
                Both Google accounts are linked. Your agents are ready.
              </p>
            </div>
          </div>

          {/* Connected accounts */}
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Connected Accounts
            </h2>
            <div className="space-y-2">
              {[
                { id: 'primary', label: ACCOUNT_META.primary.label, email: primaryEmail, description: ACCOUNT_META.primary.description },
                { id: 'billing', label: ACCOUNT_META.billing.label, email: billingEmail, description: ACCOUNT_META.billing.description },
              ].map((account) => (
                <div
                  key={account.id}
                  className="flex items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-4"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-emerald-500/10 text-sm font-bold text-emerald-400">
                    G
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-100">{account.label}</p>
                    <p className="text-xs text-zinc-500">{account.email} · {account.description}</p>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-full border border-emerald-800/50 bg-emerald-900/20 px-2.5 py-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="text-[11px] font-medium text-emerald-400">Connected</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Setup checklist — all green */}
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Setup Complete
            </h2>
            <div className="space-y-2">
              {steps.map((step) => {
                const Icon = step.icon
                return (
                  <div
                    key={step.id}
                    className="flex items-center gap-3 rounded-xl border border-zinc-800/50 bg-zinc-900/60 px-4 py-3"
                  >
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-300">{step.label}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {/* Quick actions */}
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Quick Actions
            </h2>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'View Emails', href: '/email', description: 'Read & manage' },
                { label: 'Open Finance', href: '/finance', description: 'Invoices & cash flow' },
                { label: 'Agent Office', href: '/office', description: 'Your AI team' },
              ].map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="group flex flex-col gap-1 rounded-xl border border-zinc-800 bg-zinc-900 p-4 transition-colors hover:border-[#D4A853]/40 hover:bg-zinc-800"
                >
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

  // Partial or no connection — setup wizard with progress
  const stepStatus = {
    primary: primaryConnected,
    billing: billingConnected,
    sheets: false,
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center py-16 px-4">
      <div className="w-full max-w-xl">
        {/* Heading */}
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

        {/* Setup steps */}
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

        {/* Helper link */}
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
