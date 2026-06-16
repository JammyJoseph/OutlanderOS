/**
 * OutlanderOS design system tokens.
 *
 * Dark monochrome. Manrope. Editorial, magazine-quality — luminous portal accents.
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
  commercial: "#ffd700",
  production: "#ff4444",
  print: "#00ff88",
  editorial: "#c77dff",
  finance: "#4d9fff",
  "think-tank": "#ffaa00",
  contacts: "#4d9fff",
  admin: "#999999",
};

/** Resolve a portal accent from a pathname like "/finance/reports". */
export function portalAccent(pathname: string): string {
  const segment = (pathname.split("/")[1] ?? "") as PortalKey;
  return PORTAL_ACCENTS[segment] ?? "#ffd700";
}

/** Shared card surface — dark, rounded, subtle border; brightens on hover. */
export const cardClass =
  "rounded-xl border border-[#2a2a2a] bg-[#141414] transition-all duration-200 hover:border-[#3a3a3a] hover:-translate-y-0.5";

/** Static card (no hover lift) for containers/tables. */
export const panelClass = "rounded-xl border border-[#2a2a2a] bg-[#141414]";

/** Glass surface for key headers/banners. */
export const glassClass = "bg-[#141414]/80 backdrop-blur-md border border-[#2a2a2a]";

/** Small rounded-full status pill base — combine with a colour class. */
export const pillClass =
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold";
