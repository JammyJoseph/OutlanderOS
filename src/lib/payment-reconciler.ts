/**
 * Payment reconciler — cross-portal connection #9 (STUB).
 *
 * When Xero confirms a payment for a deal, the matching Trello card should
 * auto-move from "Work Live" to "Work Paid".
 *
 * ⚠️  THIS IS DISABLED. It is blocked on Xero OAuth, which in turn is blocked
 * on the production domain being set up (Xero requires a fixed redirect URI).
 * The matching/move logic below is written out but gated behind a flag so it
 * can be switched on with zero further code changes once Xero is connected.
 *
 * TO ENABLE WHEN XERO COMES ONLINE:
 *   1. Complete Xero OAuth (the `xero` token must be present in token-store).
 *   2. Set env var PAYMENT_RECONCILER_ENABLED=true.
 *   3. Verify the Trello list names below match the live board
 *      (TRELLO_LIVE_LIST_NAME / TRELLO_PAID_LIST_NAME).
 *   4. Remove the early-return guard if you want it on regardless of the flag.
 */
import { getToken } from "./token-store";
import { buildSnapshot, moveCard, type PipelineStage } from "./trello";
import { fetchAllXeroData } from "./xero-api";

const LIVE_LIST_NAME = "WORK LIVE";
const PAID_LIST_NAME = "WORK PAID";

export interface ReconcileResult {
  enabled: boolean;
  reason?: string;
  paidInvoices: number;
  cardsMoved: number;
  matches: Array<{ invoice: string; card: string }>;
}

/** Normalise a company / contact name for fuzzy matching. */
function norm(s: string): string {
  return s.toLowerCase().replace(/\b(ltd|limited|inc|llc|co)\b/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * Reconcile Xero payments against the Trello pipeline.
 *
 * While disabled this performs no external calls and returns immediately.
 */
export async function reconcilePayments(): Promise<ReconcileResult> {
  const empty: ReconcileResult = { enabled: false, paidInvoices: 0, cardsMoved: 0, matches: [] };

  // ---- DISABLED GUARD — remove / flip when Xero is live -------------------
  if (process.env.PAYMENT_RECONCILER_ENABLED !== "true") {
    return { ...empty, reason: "disabled — set PAYMENT_RECONCILER_ENABLED=true once Xero OAuth is connected" };
  }

  const xeroToken = getToken("xero");
  if (!xeroToken) {
    return { ...empty, reason: "Xero not connected — OAuth blocked on production domain setup" };
  }
  // ------------------------------------------------------------------------

  // TODO(xero): the block below is the intended live behaviour. It is left
  // wired up but only runs once the guard above is satisfied.

  // 1. Pull paid invoices from Xero.
  const xero = await fetchAllXeroData(JSON.stringify(xeroToken));
  const data = xero.data as {
    connected?: boolean;
    recentPayments?: Array<{ contact?: string; reference?: string; total?: number }>;
  };
  if (!data?.connected) {
    return { ...empty, reason: "Xero returned not-connected" };
  }
  const payments = data.recentPayments ?? [];

  // 2. Load the Trello board and find the "Work Live" list.
  const snap = await buildSnapshot();
  const liveStage: PipelineStage | undefined = snap.stages.find(
    (s) => s.name.trim().toUpperCase() === LIVE_LIST_NAME
  );
  const paidStage: PipelineStage | undefined = snap.stages.find(
    (s) => s.name.trim().toUpperCase() === PAID_LIST_NAME
  );
  if (!liveStage || !paidStage) {
    return { ...empty, reason: `Trello lists "${LIVE_LIST_NAME}"/"${PAID_LIST_NAME}" not found` };
  }

  // 3. Match each paid invoice to a card by client name or reference.
  const matches: Array<{ invoice: string; card: string }> = [];
  let cardsMoved = 0;
  for (const pay of payments) {
    const contactNorm = norm(pay.contact ?? "");
    const refNorm = norm(pay.reference ?? "");
    const card = liveStage.cards.find((c) => {
      const cardClient = norm(c.client || "");
      const cardName = norm(c.name);
      return (
        (contactNorm && (cardClient.includes(contactNorm) || contactNorm.includes(cardClient))) ||
        (refNorm && (cardName.includes(refNorm) || refNorm.includes(cardName)))
      );
    });
    if (!card) continue;
    matches.push({ invoice: pay.reference || pay.contact || "?", card: card.name });
    // 4. Move the card to "Work Paid".
    try {
      await moveCard(card.id, paidStage.id, "top");
      cardsMoved++;
    } catch (err) {
      console.error("[payment-reconciler] moveCard failed:", err);
    }
  }

  return {
    enabled: true,
    paidInvoices: payments.length,
    cardsMoved,
    matches,
  };
}
