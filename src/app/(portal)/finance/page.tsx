'use client'

import { Suspense } from 'react'
import dynamic from 'next/dynamic'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { TabSkeleton } from './_components/FinanceBits'

// Lazy-load each tab so only the active one fetches and ships its JS.
// next/dynamic requires the options arg to be an inline object literal.
const OverviewTab = dynamic(() => import('./_components/OverviewTab'), { loading: () => <TabSkeleton />, ssr: false })
const ProjectPLTab = dynamic(() => import('./_components/ProjectPLTab'), { loading: () => <TabSkeleton />, ssr: false })
const InvoicingTab = dynamic(() => import('./_components/InvoicingTab'), { loading: () => <TabSkeleton />, ssr: false })
const BudgetSubmissionsTab = dynamic(() => import('./_components/BudgetSubmissionsTab'), { loading: () => <TabSkeleton />, ssr: false })
const CompanyHistoryTab = dynamic(() => import('./_components/CompanyHistoryTab'), { loading: () => <TabSkeleton />, ssr: false })

type TabId = 'overview' | 'project-pl' | 'invoicing' | 'budgets' | 'history'

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'project-pl', label: 'Project P&L' },
  { id: 'invoicing', label: 'Invoicing' },
  { id: 'budgets', label: 'Budget Submissions' },
  { id: 'history', label: 'Company History' },
]

const VALID = new Set<TabId>(TABS.map((t) => t.id))

function FinanceInner() {
  const router = useRouter()
  const params = useSearchParams()
  const raw = (params.get('tab') as TabId) || 'overview'
  const active: TabId = VALID.has(raw) ? raw : 'overview'

  function switchTab(tab: TabId) {
    router.push(`/finance?tab=${tab}`)
  }

  return (
    <div className="flex flex-col py-6 px-4 sm:px-6">
      <div className="mx-auto w-full max-w-6xl space-y-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Finance</h1>
          <p className="mt-0.5 text-xs text-gray-500">Revenue, projects, invoicing &amp; company history</p>
        </div>

        <div className="flex overflow-x-auto border-b border-gray-200">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => switchTab(tab.id)}
              className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                active === tab.id
                  ? 'border-[#D4A853] text-[#D4A853]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div>
          {active === 'overview' && <OverviewTab />}
          {active === 'project-pl' && <ProjectPLTab />}
          {active === 'invoicing' && <InvoicingTab />}
          {active === 'budgets' && <BudgetSubmissionsTab />}
          {active === 'history' && <CompanyHistoryTab />}
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
          <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
        </div>
      }
    >
      <FinanceInner />
    </Suspense>
  )
}
