'use client'

import { CreditCard, FolderKanban, Image as ImageIcon, ReceiptText, Tags } from 'lucide-react'

// MOSS card-spend integration placeholder. The layout below is the real
// structure expenses will render into once the MOSS API is connected —
// no mock rows, just the empty frame.

function SkeletonExpenseCard() {
  return (
    <div className="rounded-xl border border-dashed border-gray-200 bg-white p-4">
      <div className="flex items-start gap-3">
        {/* Receipt thumbnail slot */}
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 text-gray-300">
          <ImageIcon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-gray-300">Merchant · cardholder</span>
            <span className="font-mono text-[11px] text-gray-300">£0.00</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-gray-300">
            <Tags className="h-3 w-3" /> Category
            <span className="text-gray-200">·</span>
            <FolderKanban className="h-3 w-3" /> Project coding
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ExpensesTab() {
  return (
    <div className="space-y-5">
      {/* Connect empty state */}
      <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-white to-amber-50/50 p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#D4A853]/15 text-[#D4A853]">
          <CreditCard className="h-6 w-6" />
        </div>
        <h2 className="mb-1 text-sm font-bold text-gray-900">Connect MOSS</h2>
        <p className="mx-auto mb-4 max-w-md text-xs leading-relaxed text-gray-500">
          Link your MOSS account to see team card spend, receipts, and expense categorisation coded to projects — all
          reconciled against project budgets automatically.
        </p>
        <button
          disabled
          title="MOSS integration coming soon"
          className="cursor-not-allowed rounded-lg bg-[#D4A853]/50 px-4 py-2 text-xs font-semibold text-white"
        >
          Connect MOSS
        </button>
        <p className="mt-2 text-[10px] text-gray-400">Integration coming soon</p>
      </div>

      {/* Ready-made structure for when MOSS connects */}
      <div>
        <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          <ReceiptText className="h-3 w-3" /> Team Card Spend — waiting for MOSS
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <SkeletonExpenseCard />
          <SkeletonExpenseCard />
          <SkeletonExpenseCard />
        </div>
      </div>
    </div>
  )
}
