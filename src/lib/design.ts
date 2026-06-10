/**
 * OutlanderOS design system tokens.
 *
 * Light mode only. Manrope. Sharp, glassy, bright — strong portal accents.
 */

export type PortalKey =
  | "commercial"
  | "production"
  | "print"
  | "editorial"
  | "finance"
  | "think-tank"
  | "contacts"
  | "admin";

export const PORTAL_ACCENTS: Record<PortalKey, string> = {
  commercial: "#D4A853",
  production: "#E24B4A",
  print: "#1D9E75",
  editorial: "#7B5BD6",
  finance: "#378ADD",
  "think-tank": "#E67E22",
  contacts: "#2C3E50",
  admin: "#6C757D",
};

/** Resolve a portal accent from a pathname like "/finance/reports". */
export function portalAccent(pathname: string): string {
  const segment = (pathname.split("/")[1] ?? "") as PortalKey;
  return PORTAL_ACCENTS[segment] ?? "#D4A853";
}

/** Shared card surface — white, rounded, subtle border + shadow, lifts on hover. */
export const cardClass =
  "rounded-xl border border-[#E5E7EB] bg-white shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5";

/** Static card (no hover lift) for containers/tables. */
export const panelClass = "rounded-xl border border-[#E5E7EB] bg-white shadow-sm";

/** Glass surface for key headers/banners. */
export const glassClass = "bg-white/80 backdrop-blur-md border border-white/60 shadow-sm";

/** Small rounded-full status pill base — combine with a colour class. */
export const pillClass =
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold";
