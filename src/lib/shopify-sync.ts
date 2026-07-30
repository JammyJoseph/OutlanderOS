// ═══════════════════════════════════════════════════════════════════════════
// Shopify → Postgres sync.
//
// Upsert, never replace. This started as a full delete-and-reinsert, on the
// reasoning that orders mutate after creation — refunds, cancellations,
// fulfilment — and re-reading everything is cheaper than tracking which rows
// went stale. That reasoning held only while the API was the sole source.
//
// It isn't. Without read_all_orders the API cannot see past 60 days, so history
// arrives by CSV export instead. A full replace would then delete thousands of
// imported orders and write back the 60 days of nothing the API can see. A sync
// must never destroy rows it is structurally incapable of re-fetching.
//
// Line items are still replaced per order, because a line can be removed from
// an order and leaving the old row would double-count it.
// ═══════════════════════════════════════════════════════════════════════════

import prisma from '@/lib/prisma'
import {
  runOrdersBulkQuery,
  streamJsonl,
  hasFullHistoryAccess,
  shopInfo,
  ShopifyError,
} from '@/lib/shopify'

export const SYNC_SOURCE = 'shopifyOrders'

const money = (v: unknown): number => {
  const n = Number((v as { shopMoney?: { amount?: string } })?.shopMoney?.amount)
  return Number.isFinite(n) ? n : 0
}

const currencyOf = (v: unknown): string =>
  (v as { shopMoney?: { currencyCode?: string } })?.shopMoney?.currencyCode ?? 'GBP'

interface StagedOrder {
  id: string
  name: string
  orderedAt: Date
  currency: string
  totalPrice: number
  subtotalPrice: number
  totalShipping: number
  totalTax: number
  totalDiscounts: number
  financialStatus: string | null
  fulfillmentStatus: string | null
  cancelledAt: Date | null
  isTest: boolean
  shipCountryCode: string | null
  shipProvinceCode: string | null
  shipCity: string | null
  customerId: string | null
}

interface StagedLine {
  id: string
  orderId: string
  sku: string | null
  title: string
  variantTitle: string | null
  quantity: number
  price: number
  productId: string | null
  variantId: string | null
}

export interface SyncResult {
  orders: number
  lineItems: number
  units: number
  fullHistory: boolean
  shopName: string
  currency: string
  objectCount: number
  warnings: string[]
}

export async function syncShopifyOrders(
  onProgress?: (msg: string) => void
): Promise<SyncResult> {
  const warnings: string[] = []

  const shop = await shopInfo()
  const fullHistory = await hasFullHistoryAccess()
  if (!fullHistory) {
    warnings.push(
      'The app does not hold read_all_orders, so Shopify only returned the last 60 days — for an annual drop, usually nothing. This is not a fault. Use Import CSV to load the full history now (Shopify admin → Orders → Export → All orders), or request the read_all_orders scope to make syncing automatic.'
    )
  }

  onProgress?.('Asking Shopify to export orders…')
  const { url, objectCount } = await runOrdersBulkQuery({
    onProgress: (status, count) => onProgress?.(`Shopify export ${status.toLowerCase()} — ${count} objects`),
  })

  // No URL means the export completed with nothing in it. That is a real,
  // reportable state — not a failure — and conflating the two would send
  // someone debugging a working sync.
  if (!url) {
    return {
      orders: 0,
      lineItems: 0,
      units: 0,
      fullHistory,
      shopName: shop.name,
      currency: shop.currencyCode,
      objectCount: 0,
      warnings: [
        ...warnings,
        fullHistory
          ? 'Shopify returned no orders at all for this store.'
          : 'Nothing sold in the last 60 days, which is all the API can see. Everything older is still reachable via Import CSV.',
      ],
    }
  }

  onProgress?.('Downloading export…')
  const orders = new Map<string, StagedOrder>()
  const lines: StagedLine[] = []

  for await (const row of streamJsonl(url)) {
    const id = String(row.id ?? '')
    const parentId = row.__parentId ? String(row.__parentId) : null

    if (parentId) {
      // Line item: bulk output is flat, so children arrive as their own rows.
      lines.push({
        id,
        orderId: parentId,
        sku: (row.sku as string) ?? null,
        title: String(row.title ?? ''),
        variantTitle: (row.variantTitle as string) ?? null,
        quantity: Number(row.quantity ?? 0),
        price: money(row.originalUnitPriceSet),
        productId: (row.product as { id?: string })?.id ?? null,
        variantId: (row.variant as { id?: string })?.id ?? null,
      })
      continue
    }

    const addr = (row.shippingAddress ?? {}) as Record<string, string | null>
    orders.set(id, {
      id,
      name: String(row.name ?? ''),
      orderedAt: new Date(String(row.createdAt)),
      currency: currencyOf(row.currentTotalPriceSet),
      totalPrice: money(row.currentTotalPriceSet),
      subtotalPrice: money(row.currentSubtotalPriceSet),
      totalShipping: money(row.totalShippingPriceSet),
      totalTax: money(row.currentTotalTaxSet),
      totalDiscounts: money(row.currentTotalDiscountsSet),
      financialStatus: (row.displayFinancialStatus as string) ?? null,
      fulfillmentStatus: (row.displayFulfillmentStatus as string) ?? null,
      cancelledAt: row.cancelledAt ? new Date(String(row.cancelledAt)) : null,
      isTest: Boolean(row.test),
      shipCountryCode: addr.countryCodeV2 ?? null,
      shipProvinceCode: addr.provinceCode ?? null,
      shipCity: addr.city ?? null,
      customerId: (row.customer as { id?: string })?.id ?? null,
    })
  }

  // A line whose parent never appeared would violate the foreign key and abort
  // the whole write. Drop and report rather than fail the sync.
  const orphans = lines.filter((l) => !orders.has(l.orderId))
  if (orphans.length > 0) {
    warnings.push(`${orphans.length} line item(s) had no matching order and were skipped.`)
  }
  const keep = lines.filter((l) => orders.has(l.orderId))

  onProgress?.(`Writing ${orders.size} orders…`)

  // One transaction: a partially-written sync is worse than no sync, because
  // the dashboard would show totals that reconcile to nothing.
  const all = [...orders.values()]
  const fetchedIds = all.map((o) => o.id)

  await prisma.$transaction(
    async (tx) => {
      // Only the fetched orders' lines are cleared — a blanket delete would
      // orphan every CSV-imported order's line items.
      if (fetchedIds.length > 0) {
        await tx.shopifyOrderLine.deleteMany({ where: { orderId: { in: fetchedIds } } })
      }

      const CHUNK = 500
      for (const o of all) {
        await tx.shopifyOrder.upsert({
          where: { id: o.id },
          create: { ...o, source: 'API' },
          // `source` is deliberately not updated: an order first seen in a CSV
          // import stays labelled CSV, so the provenance of the backfill
          // survives a later API sync touching the same row.
          update: o,
        })
      }
      for (let i = 0; i < keep.length; i += CHUNK) {
        await tx.shopifyOrderLine.createMany({ data: keep.slice(i, i + CHUNK) })
      }
    },
    { timeout: 180_000 }
  )

  return {
    orders: orders.size,
    lineItems: keep.length,
    units: keep.reduce((s, l) => s + l.quantity, 0),
    fullHistory,
    shopName: shop.name,
    currency: shop.currencyCode,
    objectCount,
    warnings,
  }
}

/** Records the run against the existing sync engine so it shows in /api/health. */
export async function runSyncWithLogging(): Promise<SyncResult> {
  const started = Date.now()
  await prisma.syncStatus.upsert({
    where: { source: SYNC_SOURCE },
    update: { state: 'running', lastSyncAt: new Date() },
    create: {
      source: SYNC_SOURCE,
      state: 'running',
      lastSyncAt: new Date(),
      intervalMs: 24 * 60 * 60 * 1000,
    },
  })

  try {
    const result = await syncShopifyOrders()
    await prisma.syncStatus.update({
      where: { source: SYNC_SOURCE },
      data: {
        state: 'idle',
        lastSuccessAt: new Date(),
        lastError: null,
        recordsSynced: result.orders,
        totalRuns: { increment: 1 },
      },
    })
    await prisma.syncLog.create({
      data: {
        source: SYNC_SOURCE,
        finishedAt: new Date(),
        durationMs: Date.now() - started,
        ok: true,
        recordCount: result.orders,
        message: result.warnings.join(' ') || null,
        meta: result as unknown as object,
      },
    })
    return result
  } catch (err) {
    const message = err instanceof ShopifyError ? err.message : String(err)
    await prisma.syncStatus.update({
      where: { source: SYNC_SOURCE },
      data: {
        state: 'error',
        lastError: message,
        errorCount24h: { increment: 1 },
        totalRuns: { increment: 1 },
      },
    })
    await prisma.syncLog.create({
      data: {
        source: SYNC_SOURCE,
        finishedAt: new Date(),
        durationMs: Date.now() - started,
        ok: false,
        message,
      },
    })
    throw err
  }
}
