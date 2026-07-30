import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { isShopifyConfigured, ShopifyError, ShopifyNotConfiguredError } from '@/lib/shopify'
import { runSyncWithLogging } from '@/lib/shopify-sync'

// POST /api/shopify/sync
//
// Runs inline rather than as a background job. A bulk export of a magazine
// store's order history finishes in seconds to a couple of minutes, and doing
// it inline means the person who pressed the button sees the actual error
// instead of a job id and a shrug. If volume ever makes this too slow, move it
// behind the existing sync engine rather than hiding it in a fire-and-forget.
export const POST = withAuth(async () => {
  if (!isShopifyConfigured()) {
    return NextResponse.json(
      {
        error:
          'Shopify is not configured on this server. SHOPIFY_SHOP_DOMAIN, SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET need to be set.',
      },
      { status: 400 }
    )
  }

  try {
    const result = await runSyncWithLogging()
    return NextResponse.json({ ok: true, result })
  } catch (err) {
    // Shopify's own errors are already written for a human — pass them through
    // rather than replacing them with a generic failure, because they name the
    // fix (install the app, request the scope, check the secret).
    if (err instanceof ShopifyError || err instanceof ShopifyNotConfiguredError) {
      return NextResponse.json({ error: err.message }, { status: 502 })
    }
    console.error('POST /api/shopify/sync', err)
    return NextResponse.json({ error: 'The Shopify sync failed unexpectedly.' }, { status: 500 })
  }
})
