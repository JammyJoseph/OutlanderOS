import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import prisma from '@/lib/prisma'
import { withAuth } from '@/lib/auth'
import {
  headline,
  basketProfile,
  coverMix,
  coverSkuSet,
  territoryDemand,
  coastSplit,
  repeatBuyers,
  type OrderRow,
} from '@/lib/sales-analysis'

export const maxDuration = 60

const MODEL = 'claude-sonnet-5'

// GET /api/shopify/roundup
//
// A written summary of what the sales data says, shown at the top of the page.
//
// The model is given ONLY pre-computed figures — never raw orders. That keeps
// the payload small, keeps customer data out of the request entirely, and means
// every number it can cite has already been derived by code that's testable.
// It is told not to invent figures, and the panels underneath show the same
// numbers, so anything it gets wrong is visible rather than authoritative.
//
// Cached against a signature of the underlying data. Regenerating on every page
// load would cost a model call per visit and, worse, produce slightly different
// wording each time for identical data — which reads as instability.

let cached: { signature: string; text: string; generatedAt: string } | null = null

export const GET = withAuth(async () => {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ available: false, reason: 'ANTHROPIC_API_KEY is not set on this server.' })
    }

    const [orders, plan] = await Promise.all([
      prisma.shopifyOrder.findMany({ include: { lineItems: true }, orderBy: { orderedAt: 'asc' } }),
      prisma.rolloutPlan.findFirst({
        orderBy: { createdAt: 'desc' },
        include: {
          covers: { orderBy: { sortOrder: 'asc' } },
          territories: { orderBy: { sortOrder: 'asc' } },
          magazinePlan: { select: { issueNumber: true, issueName: true } },
        },
      }),
    ])

    const rows = orders as unknown as OrderRow[]
    if (rows.length === 0) {
      return NextResponse.json({ available: false, reason: 'No orders synced yet.' })
    }

    const plannedShares = plan?.covers.map((c) => ({ sku: c.sku, sharePct: c.sharePct, name: c.name }))
    const skus = coverSkuSet(plannedShares)
    const h = headline(rows)
    const mix = coverMix(rows, plannedShares)
    const basket = basketProfile(rows, plan?.covers.length, skus)
    const territories = territoryDemand(
      rows,
      plan?.territories.map((t) => ({ name: t.name, b2cUnits: t.b2cUnits })),
      skus
    )
    const coast = coastSplit(rows, plan?.eastCoastShare)
    const repeat = repeatBuyers(rows)
    const years = new Set(rows.map((o) => new Date(o.orderedAt).getUTCFullYear()))

    // Changes whenever anything that could alter the summary changes.
    const signature = JSON.stringify({
      o: h.orders, u: h.units, r: Math.round(h.revenue),
      c: mix.covers.map((c) => [c.sku, c.units]),
      t: territories.map((t) => [t.territory, t.units]),
      b: basket.averageBasket.toFixed(3),
      p: plan?.id ?? null,
    })

    if (cached?.signature === signature) {
      return NextResponse.json({ available: true, cached: true, ...cached })
    }

    const facts = {
      issue: plan?.magazinePlan
        ? `Issue ${plan.magazinePlan.issueNumber} — ${plan.magazinePlan.issueName}`
        : null,
      sellingPeriodsObserved: years.size,
      totals: {
        orders: h.orders,
        magazinesSold: mix.coverUnits,
        otherItemsSold: mix.otherUnits,
        revenue: Math.round(h.revenue),
        currency: h.currency,
        averageOrderValue: Number(h.averageOrderValue.toFixed(2)),
        firstOrder: h.firstOrderAt,
        lastOrder: h.lastOrderAt,
        cancelledOrTestExcluded: h.excludedOrders,
      },
      basket: {
        averageMagazinesPerOrder: Number(basket.averageBasket.toFixed(2)),
        pctOrdersTakingTwoOrMore: Number(basket.multiCoverShare.toFixed(1)),
        pctOrdersTakingFullSet: basket.fullSetShare == null ? null : Number(basket.fullSetShare.toFixed(1)),
        note: 'The rollout plan assumes an average basket of two when claiming its bundling saving.',
      },
      coversVsPlan: mix.noSkuMatch
        ? 'NO MATCH: no sold line item used a SKU the rollout plan knows about, so cover-level analysis is unavailable.'
        : mix.covers.map((c) => ({
            cover: c.title,
            unitsSold: c.units,
            pctOfMagazinesSold: Number(c.soldSharePct.toFixed(1)),
            pctOfPrintRunAllocated: c.plannedSharePct,
          })),
      territoriesVsPlan: territories.map((t) => ({
        territory: t.territory,
        unitsSold: t.units,
        pctOfSales: Number(t.soldSharePct.toFixed(1)),
        pctPlanned: t.plannedSharePct == null ? null : Number(t.plannedSharePct.toFixed(1)),
      })),
      usCoastSplit: coast.eastSharePct == null
        ? null
        : {
            actualEastPct: Number(coast.eastSharePct.toFixed(1)),
            planAssumesEastPct: coast.assumedEastSharePct,
          },
      repeatBuyers: {
        identified: repeat.identifiedCustomers,
        boughtMoreThanOnce: repeat.repeat,
        guestOrdersUncountable: repeat.guestOrders,
      },
    }

    const client = new Anthropic({ apiKey })
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 700,
      system: [
        'You write the standing summary at the top of an internal sales dashboard for Outlander, an independent magazine that publishes once a year with multiple collectable covers.',
        'The reader is the small team deciding how much of each cover to print next time and where to ship it.',
        '',
        'Rules:',
        '- Use ONLY the figures provided. Never invent, estimate or extrapolate a number.',
        '- Lead with the single most decision-relevant thing, not a recap of totals.',
        '- Say what it implies for the next print run where the data supports it.',
        '- If sellingPeriodsObserved is 1, say plainly that this is one selling period and the signals are directional, not a trend.',
        '- If coversVsPlan reports NO MATCH, lead with that: it means the SKUs need fixing before cover analysis works at all.',
        '- Never claim a saving, forecast or trend the figures do not contain.',
        '',
        'Format: 3 to 5 short paragraphs, plain sentences, no headings, no bullet points, no markdown. British English. Never open with "Here is" or similar.',
      ].join('\n'),
      messages: [{ role: 'user', content: JSON.stringify(facts, null, 2) }],
    })

    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim()

    if (!text) {
      return NextResponse.json({ available: false, reason: 'The model returned nothing.' })
    }

    cached = { signature, text, generatedAt: new Date().toISOString() }
    return NextResponse.json({ available: true, cached: false, ...cached })
  } catch (err) {
    console.error('GET /api/shopify/roundup', err)
    // The dashboard is fully usable without the summary, so a model failure
    // must never take the page down with it.
    return NextResponse.json({ available: false, reason: 'Could not generate the summary.' })
  }
})
