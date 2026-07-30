import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withAuth } from '@/lib/auth'
import { parseShopifyOrdersCsv } from '@/lib/shopify-csv'

// POST /api/shopify/import  (multipart/form-data, field "file")
//
// Backfills order history from a Shopify admin CSV export — the only way to get
// past the 60-day API window without the read_all_orders scope.
//
// Imported rows are marked source=CSV and are never deleted by an API sync;
// see the header of shopify-sync.ts for why that mattered enough to change the
// sync's write strategy.

// A full order history for a magazine store is a few MB. Anything far beyond
// that is a mistake, and parsing it would hold the whole string in memory.
const MAX_BYTES = 20 * 1024 * 1024

export const POST = withAuth(async (request: NextRequest) => {
  try {
    const form = await request.formData().catch(() => null)
    const file = form?.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file uploaded.' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `That file is ${(file.size / 1_048_576).toFixed(1)}MB. The limit is 20MB.` },
        { status: 400 }
      )
    }

    const text = await file.text()
    const parsed = parseShopifyOrdersCsv(text)

    if (parsed.orders.length === 0) {
      return NextResponse.json(
        {
          error:
            parsed.problems[0] ?? 'No orders could be read from that file.',
          problems: parsed.problems,
        },
        { status: 400 }
      )
    }

    let created = 0
    let updated = 0
    let units = 0

    // Chunked rather than one transaction: a 5,000-order import would hold a
    // write transaction open long enough to matter on a single-CPU box, and a
    // partial import is recoverable here because re-running is idempotent —
    // orders are keyed by name, so the same file imported twice updates rather
    // than duplicates.
    const CHUNK = 200
    for (let i = 0; i < parsed.orders.length; i += CHUNK) {
      const batch = parsed.orders.slice(i, i + CHUNK)
      await prisma.$transaction(
        async (tx) => {
          for (const o of batch) {
            const { lines, ...order } = o
            const existing = await tx.shopifyOrder.findUnique({
              where: { id: order.id },
              select: { id: true },
            })
            if (existing) updated++
            else created++

            await tx.shopifyOrder.upsert({
              where: { id: order.id },
              create: { ...order, source: 'CSV' },
              update: order,
            })
            await tx.shopifyOrderLine.deleteMany({ where: { orderId: order.id } })
            if (lines.length > 0) {
              await tx.shopifyOrderLine.createMany({
                data: lines.map((l) => ({ ...l, orderId: order.id })),
              })
            }
            units += lines.reduce((s, l) => s + l.quantity, 0)
          }
        },
        { timeout: 120_000 }
      )
    }

    const dates = parsed.orders.map((o) => o.orderedAt.getTime()).sort((a, b) => a - b)

    return NextResponse.json({
      ok: true,
      result: {
        rows: parsed.rows,
        orders: parsed.orders.length,
        created,
        updated,
        units,
        earliest: new Date(dates[0]).toISOString(),
        latest: new Date(dates[dates.length - 1]).toISOString(),
        problems: parsed.problems,
      },
    })
  } catch (err) {
    console.error('POST /api/shopify/import', err)
    return NextResponse.json({ error: 'The import failed unexpectedly.' }, { status: 500 })
  }
})
