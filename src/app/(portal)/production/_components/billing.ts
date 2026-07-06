// Editorial vs Paid colour coding, shared across the Production dashboard.
// EDITORIAL → green, PAID (incl. COMMERCIAL) → gold. Colours are exposed as raw
// hex for inline styles (calendar dots) plus Tailwind class bundles for chips.

export interface BillingTheme {
  key: "EDITORIAL" | "PAID";
  label: string;
  hex: string; // dot / accent colour
  chip: string; // Tailwind bg+text for a pill
  ring: string; // Tailwind border/ring accent
  dotText: "black" | "white"; // legible text colour on top of the hex
}

export const EDITORIAL_HEX = "#00c853";
export const PAID_HEX = "#9C7C2E";

const EDITORIAL: BillingTheme = {
  key: "EDITORIAL",
  label: "Editorial",
  hex: EDITORIAL_HEX,
  chip: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300",
  ring: "border-emerald-300 dark:border-emerald-700",
  dotText: "black",
};

const PAID: BillingTheme = {
  key: "PAID",
  label: "Paid",
  hex: PAID_HEX,
  chip: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
  ring: "border-amber-300 dark:border-amber-700",
  dotText: "black",
};

// A production is "Paid" when its billingType says so, or when it's a
// COMMERCIAL project (created from the Commercial portal with a locked budget).
export function isPaid(p: { billingType?: string | null; type?: string | null }): boolean {
  return p.billingType === "PAID" || p.type === "COMMERCIAL";
}

export function billingTheme(p: { billingType?: string | null; type?: string | null }): BillingTheme {
  return isPaid(p) ? PAID : EDITORIAL;
}
