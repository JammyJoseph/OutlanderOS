'use client'

import { Suspense } from 'react'
import dynamic from 'next/dynamic'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { TabSkeleton } from './_components/FinanceBits'

// Lazy-load each tab so only the active one fetches and ships its JS.
// next/dynamic requires the options arg to be an inline object literal.
const DashboardTab = dynamic(() => import('./_components/DashboardTab'), { loading: () => <TabSkeleton />, ssr: false })
const ProjectFoldersTab = dynamic(() => import('./_components/ProjectFoldersTab'), { loading: () => <TabSkeleton />, ssr: false })
const BudgetVsActualsTab = dynamic(() => import('./_components/BudgetVsActualsTab'), { loading: () => <TabSkeleton />, ssr: false })
const ClientViewTab = dynamic(() => import('./_components/ClientViewTab'), { loading: () => <TabSkeleton />, ssr: false })
const InvoicesApprovalsTab = dynamic(() => import('./_components/InvoicesApprovalsTab'), { loading: () => <TabSkeleton />, ssr: false })
const ExpensesTab = dynamic(() => import('./_components/ExpensesTab'), { loading: () => <TabSkeleton />, ssr: false })
const PLHistoryTab = dynamic(() => import('./_components/PLHistoryTab'), { loading: () => <TabSkeleton />, ssr: false })
const PrintPLTab = dynamic(() => import('./_components/PrintPLTab'), { loading: () => <TabSkeleton />, ssr: false })

type TabId = 'dashboard' | 'projects' | 'budget' | 'clients' | 'invoices' | 'expenses' | 'pl' | 'print'

const TABS: { id: TabId; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'projects', label: 'Project folders' },
  { id: 'budget', label: 'Budget vs actuals' },
  { id: 'clients', label: 'Client view' },
  { id: 'invoices', label: 'Invoices and approvals' },
  { id: 'expenses', label: 'Expenses' },
  { id: 'pl', label: 'P&L and history' },
  { id: 'print', label: 'Print P&L' },
]

const VALID = new Set<TabId>(TABS.map((t) => t.id))

function FinanceInner() {
  const router = useRouter()
  const params = useSearchParams()
  const raw = (params.get('tab') as TabId) || 'dashboard'
  const active: TabId = VALID.has(raw) ? raw : 'dashboard'

  function switchTab(tab: TabId) {
    router.push(`/finance?tab=${tab}`)
  }

  return (
    <div className="px-4 pb-20 pt-6 sm:px-8 lg:px-12">
      <div className="flex max-w-[1080px] flex-col gap-8">
        <nav aria-label="Finance sections" className="-mx-1 overflow-x-auto px-1">
          <div className="flex w-max gap-1">
            {TABS.map((tab) => {
              const on = active === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  aria-current={on ? 'page' : undefined}
                  onClick={() => switchTab(tab.id)}
                  className={`inline-flex min-h-9 items-center whitespace-nowrap rounded-full px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground ${
                    on ? 'bg-foreground text-background' : 'text-ink-2 hover:bg-surface'
                  }`}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>
        </nav>

        <div>
          {active === 'dashboard' && <DashboardTab />}
          {active === 'projects' && <ProjectFoldersTab />}
          {active === 'budget' && <BudgetVsActualsTab />}
          {active === 'clients' && <ClientViewTab />}
          {active === 'invoices' && <InvoicesApprovalsTab />}
          {active === 'expenses' && <ExpensesTab />}
          {active === 'pl' && <PLHistoryTab />}
          {active === 'print' && <PrintPLTab />}
        </div>
      </div>
    </div>
  )
}

export default function FinancePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-gray-400 dark:text-gray-500" />
        </div>
      }
    >
      <FinanceInner />
    </Suspense>
  )
}
