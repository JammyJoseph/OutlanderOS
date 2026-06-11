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
// Role-aware: ADMIN (finance/admin) gets pipeline + Xero money cards;
// MEMBER (ops/production) gets projects, deliveries, and the next shoot.
// Everyone gets the payroll countdown.
export const GET = withAuth(async (_request, _ctx, authUser) => {
  try {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    // Role comes from the DB, not the JWT, so role changes apply without re-login.
    const dbUser = await prisma.user.findUnique({
      where: { id: authUser.userId },
      select: { role: true },
    })
    const role = dbUser?.role ?? authUser.role ?? 'MEMBER'

    if (role === 'ADMIN') {
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
        role: 'ADMIN',
        pipelineValue: pipeline._sum.value ?? 0,
        activeDealCount: pipeline._count,
        xeroConnected: xeroStatus.connected,
        outstandingReceivables,
        receivableCount,
        bankBalance,
        bankAccountName,
        payroll: nextPayroll(now),
      })
    }

    // MEMBER view — timelines, deliveries, to-dos. No finance round-trips.
    const horizon = new Date(todayStart.getTime() + 14 * 86_400_000)
    const activeProductionFilter = {
      status: { notIn: ['DELIVERED', 'ARCHIVED'] as ('DELIVERED' | 'ARCHIVED')[] },
    }

    const [
      activeDealCount,
      activeProductionCount,
      dealDeliverables,
      prodDeliverables,
      activeDeadlines,
      shootProductions,
      upcomingCallSheets,
    ] = await Promise.all([
      prisma.campaign.count({
        where: { status: { not: 'ARCHIVED' }, stage: { in: ACTIVE_STAGES } },
      }),
      prisma.production.count({ where: activeProductionFilter }),
      prisma.deliverable.count({
        where: {
          status: { not: 'DELIVERED' },
          dueDate: { gte: todayStart, lte: horizon },
          campaign: { status: { not: 'ARCHIVED' } },
        },
      }),
      prisma.productionDeliverable.count({
        where: {
          status: { notIn: ['DELIVERED', 'APPROVED'] },
          dueDate: { gte: todayStart, lte: horizon },
        },
      }),
      prisma.deadline.count({
        where: { status: 'ACTIVE', dueDate: { gte: todayStart, lte: horizon } },
      }),
      prisma.production.findMany({
        where: { ...activeProductionFilter, shootDates: { isEmpty: false } },
        select: { id: true, title: true, shootDates: true },
      }),
      prisma.callSheet.findFirst({
        where: { shootDate: { gte: todayStart }, production: activeProductionFilter },
        orderBy: { shootDate: 'asc' },
        select: {
          shootDate: true,
          production: { select: { id: true, title: true } },
        },
      }),
    ])

    // Next shoot — earliest future date across production shootDates and call sheets.
    let nextShoot: { date: string; title: string; productionId: string } | null = null
    for (const p of shootProductions) {
      for (const d of p.shootDates) {
        if (d < todayStart) continue
        if (!nextShoot || d < new Date(nextShoot.date)) {
          nextShoot = { date: d.toISOString(), title: p.title, productionId: p.id }
        }
      }
    }
    if (
      upcomingCallSheets &&
      (!nextShoot || upcomingCallSheets.shootDate < new Date(nextShoot.date))
    ) {
      nextShoot = {
        date: upcomingCallSheets.shootDate.toISOString(),
        title: upcomingCallSheets.production.title,
        productionId: upcomingCallSheets.production.id,
      }
    }

    return NextResponse.json({
      role: 'MEMBER',
      activeProjects: activeDealCount + activeProductionCount,
      activeDealCount,
      activeProductionCount,
      upcomingDeliveries: dealDeliverables + prodDeliverables + activeDeadlines,
      nextShoot,
      payroll: nextPayroll(now),
    })
  } catch (err) {
    console.error('GET /api/dashboard/pulse', err)
    return NextResponse.json({ error: 'Failed to fetch pulse' }, { status: 500 })
  }
})
