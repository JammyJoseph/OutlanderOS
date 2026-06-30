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
  | "directory"
  | "admin";

export const PORTAL_ACCENTS: Record<PortalKey, string> = {
  commercial: "#D4A853",
  production: "#dc2626",
  print: "#16a34a",
  editorial: "#9333ea",
  finance: "#2563eb",
  "think-tank": "#ea580c",
  contacts: "#2563eb",
  directory: "#64748b",
  admin: "#6b7280",
};

/** Resolve a portal accent from a pathname like "/finance/reports". */
export function portalAccent(pathname: string): string {
  const segment = (pathname.split("/")[1] ?? "") as PortalKey;
  return PORTAL_ACCENTS[segment] ?? "#D4A853";
}

/** Shared card surface — theme-aware, rounded, subtle border; lifts on hover. */
export const cardClass =
  "rounded-xl border border-border bg-card transition-all duration-200 hover:border-[var(--ring)] hover:-translate-y-0.5";

/** Static card (no hover lift) for containers/tables. */
export const panelClass = "rounded-xl border border-border bg-card";

/** Glass surface for key headers/banners. */
export const glassClass = "bg-card/80 backdrop-blur-md border border-border";

/** Small rounded-full status pill base — combine with a colour class. */
export const pillClass =
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold";
