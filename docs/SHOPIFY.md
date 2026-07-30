# Shopify — sales reporting

Powers `/print/sales-reports`. Read-only: nothing in this integration can write
to the store.

## Why it exists

Shopify Analytics already answers "how much did we sell". It cannot answer the
question this tab is for: **what should the next rollout's numbers be.**

Every panel maps onto a specific input in `/print/distribution`:

| Panel | Rollout input it informs |
|---|---|
| Basket profile | The average basket the fulfilment economics assume |
| Sell-through by cover | `RolloutCover.sharePct` |
| Demand by territory | `RolloutTerritory.b2cUnits` |
| US coast split | `RolloutPlan.eastCoastShare` |

The basket one matters most. The rollout plan claims an $11,588 bundling saving
based on an *assumed* average basket of two. This measures the real attach rate,
which either supports that number or kills it.

## Configuration

Four variables in prod `.env.local`:

```bash
SHOPIFY_SHOP_DOMAIN=outlander-mag.myshopify.com
SHOPIFY_CLIENT_ID=<client id>
SHOPIFY_CLIENT_SECRET=<client secret>
SHOPIFY_API_VERSION=2026-07
```

Note the shop domain has a **hyphen** — `outlander-mag`, not `outlandermag`.

`SHOPIFY_API_VERSION` is pinned deliberately. Shopify releases quarterly and
retires versions after roughly twelve months, so this needs bumping about once a
year; leaving it unpinned would let an upstream release change our numbers
without a deploy.

## Auth — this is not a static token

Shopify retired the old "custom app → reveal token once" flow. Custom apps are
now created in the **Dev Dashboard** and authenticate with the **client
credentials grant**:

```
POST https://{shop}/admin/oauth/access_token
{ "grant_type": "client_credentials", "client_id": …, "client_secret": … }
```

**The token expires after 24 hours.** So the environment holds a client
ID/secret, not a token, and `src/lib/shopify.ts` mints tokens on demand and
caches them in memory with a 60-second safety margin. A pm2 restart just
re-mints — one extra request, no configuration to update.

## The 60-day trap

By default an app can only read **the last 60 days of orders**. We drop once a
year, so without lifting that limit a sync legitimately returns nothing — which
looks exactly like a broken integration.

Lifting it requires the `read_all_orders` scope, which Shopify grants by manual
review (Dev Dashboard → app → API access → Request access).

`hasFullHistoryAccess()` checks the granted scopes and the UI says which of the
two situations you're in, rather than reporting "0 orders" either way.

## Required scopes

| Scope | Why |
|---|---|
| `read_orders` | The order and line-item data |
| `read_all_orders` | Beyond 60 days — **needs Shopify approval** |
| `read_products` | Variant/SKU metadata |
| `read_inventory` | Stock remaining per cover |
| `read_locations` | Ties Shopify locations to fulfilment hubs |
| `read_customers` | Repeat-buyer counts only |

Scopes take effect only after **Release** in the Dev Dashboard, and the app must
be **installed** on the store — registering it via the CLI is not enough. An app
that's registered but not installed fails token exchange with
`app_not_installed`, which the client turns into a message naming the fix.

## How the sync works

`bulkOperationRunQuery` rather than paginated queries. A bulk operation runs
server-side and returns a JSONL file with no page ceiling, instead of hundreds
of round trips against a cost-based rate limit.

Two things about bulk output that the code has to handle:

- **It's flat.** Line items arrive as their own rows carrying `__parentId`, not
  nested inside orders. `shopify-sync.ts` stitches them back.
- **One bulk query per shop at a time.** A run that finds one already in flight
  cancels it, so a single abandoned job can't block syncing until it times out.

The sync is a **full replace**, not incremental. Orders mutate after creation —
refunds, cancellations, fulfilment — so "everything since the last watermark"
silently leaves stale rows behind. Re-reading a magazine store's whole history
is cheaper than reasoning about which rows went out of date.

It runs inside one transaction. A half-written sync is worse than none, because
the dashboard would show totals that reconcile to nothing.

## Cover attribution

Cover-level analysis joins `ShopifyOrderLine.sku` to `RolloutCover.sku`. If the
Shopify variants use the same codes as the print plan (`OUT02-C1`, `OUT02-C3B`),
it works with no configuration.

Lines with no SKU are bucketed under a visible `(no SKU)` row rather than
dropped, so unit totals still tie and the gap is obvious.

## Data stored

Orders and line items only, in `ShopifyOrder` / `ShopifyOrderLine`. Amounts are
**shopMoney** (store currency), never presentment — mixing a customer paying in
USD with one paying in GBP produces a total that means nothing.

Customer data is limited to a pseudonymous `customerId`, used only to count
repeat buyers. No names, emails or addresses beyond city/province/country, which
are needed for territory and coast analysis.

Cancelled and test orders are stored but excluded from every figure.

## Reading the output honestly

`recommendations()` marks everything `directional` until at least two selling
periods exist. With one drop, sell-through and attach rate are real signals but
a single observation, and the UI says so before any number is read. A
confident-sounding recommendation off n=1 is worse than none, because it gets
acted on.

Covers within 3 points and territories within 5 points of plan are treated as
noise and produce no recommendation.
