import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withAuth } from '@/lib/auth'
import { isShopifyConfigured } from '@/lib/shopify'
import { SYNC_SOURCE } from '@/lib/shopify-sync'
import {
  headline,
  basketProfile,
  coverMix,
  coverSkuSet,
  territoryDemand,
  coastSplit,
  salesCurve,
  repeatBuyers,
  recommendations,
  type OrderRow,
} from '@/lib/sales-analysis'

// GET /api/shopify/sales
//
// Analysis is computed here, not on the client. The rollout page ships raw rows
// and derives in the browser because a plan is a few hundred numbers; an order
// history is tens of thousands, and sending all of it to render eight summary
// panels would be slow for no benefit.
export const GET = withAuth(async () => {
  try {
    if (!isShopifyConfigured()) {
      return NextResponse.json({ configured: false, connected: false, plan: null, data: null })
    }

    const [orders, sync, plan] = await Promise.all([
      prisma.shopifyOrder.findMany({
        include: { lineItems: true },
        orderBy: { orderedAt: 'asc' },
      }),
      prisma.syncStatus.findUnique({ where: { source: SYNC_SOURCE } }),
      // The most recent plan is the one we're positioning stock for, so its
      // shares and territories are what last year's sales get read against.
      prisma.rolloutPlan.findFirst({
        orderBy: { createdAt: 'desc' },
        include: {
          covers: { orderBy: { sortOrder: 'asc' } },
          territories: { orderBy: { sortOrder: 'asc' } },
          drops: { orderBy: { sortOrder: 'asc' } },
          magazinePlan: { select: { issueNumber: true, issueName: true } },
        },
      }),
    ])

    const rows = orders as unknown as OrderRow[]

    if (rows.length === 0) {
      return NextResponse.json({
        configured: true,
        connected: true,
        neverSynced: sync == null,
        sync,
        plan: null,
        data: null,
      })
    }

    const plannedShares = plan?.covers.map((c) => ({ sku: c.sku, sharePct: c.sharePct, name: c.name }))
    const plannedTerritories = plan?.territories.map((t) => ({ name: t.name, b2cUnits: t.b2cUnits }))

    // Cover SKUs gate every magazine-level figure. Without them a print or a
    // t-shirt would count as a unit sold, which would put posters into the
    // cover mix and inflate the basket the fulfilment economics rest on.
    const skus = coverSkuSet(plannedShares)
    const mix = coverMix(rows, plannedShares)
    const territories = territoryDemand(rows, plannedTerritories, skus)
    const basket = basketProfile(rows, plan?.covers.length, skus)
    const coast = coastSplit(rows, plan?.eastCoastShare)

    // Distinct calendar years containing a sale, as a rough count of how many
    // drops we've observed. It's what decides whether recommendations are
    // presented as directional or indicative, so it must not overstate.
    const years = new Set(
      rows.filter((o) => !o.cancelledAt && !o.isTest).map((o) => new Date(o.orderedAt).getUTCFullYear())
    )

    return NextResponse.json({
      configured: true,
      connected: true,
      neverSynced: false,
      sync,
      plan: plan
        ? {
            issueNumber: plan.magazinePlan?.issueNumber ?? null,
            issueName: plan.magazinePlan?.issueName ?? null,
            eastCoastShare: plan.eastCoastShare,
            covers: plan.covers.map((c) => ({ name: c.name, sku: c.sku, sharePct: c.sharePct })),
          }
        : null,
      data: {
        headline: headline(rows),
        basket,
        covers: mix.covers,
        otherProducts: mix.other,
        coverUnits: mix.coverUnits,
        otherUnits: mix.otherUnits,
        otherRevenue: mix.otherRevenue,
        noSkuMatch: mix.noSkuMatch,
        territories,
        coast,
        curve: salesCurve(rows),
        repeat: repeatBuyers(rows),
        dropsObserved: years.size,
        recommendations: recommendations({
          covers: mix.covers,
          territories,
          basket,
          coast,
          dropsObserved: years.size,
        }),
      },
    })
  } catch (err) {
    console.error('GET /api/shopify/sales', err)
    return NextResponse.json({ error: 'Failed to load sales data' }, { status: 500 })
  }
})
