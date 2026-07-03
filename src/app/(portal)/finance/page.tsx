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
const ClientViewTab = dynamic(() => import('./_components/ClientViewTab'), { loading: () => <TabSkeleton />, ssr: false })
const InvoicesApprovalsTab = dynamic(() => import('./_components/InvoicesApprovalsTab'), { loading: () => <TabSkeleton />, ssr: false })
const ExpensesTab = dynamic(() => import('./_components/ExpensesTab'), { loading: () => <TabSkeleton />, ssr: false })
const PLHistoryTab = dynamic(() => import('./_components/PLHistoryTab'), { loading: () => <TabSkeleton />, ssr: false })
const PrintPLTab = dynamic(() => import('./_components/PrintPLTab'), { loading: () => <TabSkeleton />, ssr: false })

type TabId = 'dashboard' | 'projects' | 'clients' | 'invoices' | 'expenses' | 'pl' | 'print'

const TABS: { id: TabId; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'projects', label: 'Project Folders' },
  { id: 'clients', label: 'Client View' },
  { id: 'invoices', label: 'Invoices & Approvals' },
  { id: 'expenses', label: 'Expenses' },
  { id: 'pl', label: 'P&L & History' },
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
    <div className="flex flex-col py-6 px-4 sm:px-6">
      <div className="mx-auto w-full max-w-6xl space-y-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#4d9fff]">
            OutlanderOS · Finance
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Finance</h1>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Budgets, costs, invoices &amp; the company P&amp;L — one source of truth</p>
        </div>

        <div className="flex overflow-x-auto border-b border-border">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => switchTab(tab.id)}
              className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                active === tab.id
                  ? 'border-[#4d9fff] font-semibold text-[#4d9fff]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div>
          {active === 'dashboard' && <DashboardTab />}
          {active === 'projects' && <ProjectFoldersTab />}
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
