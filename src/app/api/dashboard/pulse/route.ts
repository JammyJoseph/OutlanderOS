import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withAuth } from '@/lib/auth'
import { ACTIVE_STAGES } from '@/lib/deal-stages'
import { getXeroStatus, getXeroBankBalance, getXeroInvoices } from '@/lib/xero-finance'

export const dynamic = 'force-dynamic'

// Payroll runs on the 25th of every month.
function nextPayroll(now: Date): { date: string; daysUntil: number } {
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let payday = new Date(now.getFullYear(), now.getMonth(), 25)
  if (payday < todayStart) payday = new Date(now.getFullYear(), now.getMonth() + 1, 25)
  const daysUntil = Math.round((payday.getTime() - todayStart.getTime()) / 86_400_000)
  return { date: payday.toISOString(), daysUntil }
}

// GET /api/dashboard/pulse — the four Business Pulse KPIs for /me.
// Pipeline value comes from local deals; receivables and bank balance come
// from Xero and degrade gracefully when Xero is not connected.
export const GET = withAuth(async () => {
  try {
    const now = new Date()

    const [pipeline, xeroStatus] = await Promise.all([
      prisma.campaign.aggregate({
        where: { status: { not: 'ARCHIVED' }, stage: { in: ACTIVE_STAGES } },
        _sum: { value: true },
        _count: true,
      }),
      getXeroStatus(),
    ])

    let outstandingReceivables = 0
    let receivableCount = 0
    let bankBalance = 0
    let bankAccountName = ''
    if (xeroStatus.connected) {
      const [invoices, bank] = await Promise.all([
        getXeroInvoices('AUTHORISED'),
        getXeroBankBalance(),
      ])
      outstandingReceivables = invoices.reduce((s, i) => s + i.amountDue, 0)
      receivableCount = invoices.length
      bankBalance = bank.balance
      bankAccountName = bank.accountName
    }

    return NextResponse.json({
      pipelineValue: pipeline._sum.value ?? 0,
      activeDealCount: pipeline._count,
      xeroConnected: xeroStatus.connected,
      outstandingReceivables,
      receivableCount,
      bankBalance,
      bankAccountName,
      payroll: nextPayroll(now),
    })
  } catch (err) {
    console.error('GET /api/dashboard/pulse', err)
    return NextResponse.json({ error: 'Failed to fetch pulse' }, { status: 500 })
  }
})
