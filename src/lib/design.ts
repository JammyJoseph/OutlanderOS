/**
 * OutlanderOS design system tokens — "Paper Standard" theme.
 * Drop-in replacement for src/lib/design.ts. Same exports, same API —
 * only the values changed (muted editorial accents, hairline surfaces).
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
  commercial: "#9C7C2E",   // brass
  production: "#A93B2E",   // oxblood
  print: "#2E5E44",        // forest
  editorial: "#6B4E8E",    // aubergine
  finance: "#2F4B8F",      // royal
  "think-tank": "#B45A1F", // sienna
  contacts: "#2F4B8F",     // royal
  directory: "#5B6470",    // slate
  admin: "#4A4843",        // graphite
};

/** Resolve a portal accent from a pathname like "/finance/reports". */
export function portalAccent(pathname: string): string {
  const segment = (pathname.split("/")[1] ?? "") as PortalKey;
  return PORTAL_ACCENTS[segment] ?? "#111111";
}

/** Shared card surface — white, hairline border; border darkens on hover (no lift). */
export const cardClass =
  "rounded-lg border border-border bg-card transition-colors duration-200 hover:border-[#c9c9c6] dark:hover:border-[#3a3a3a]";

/** Static card (no hover) for containers/tables. */
export const panelClass = "rounded-lg border border-border bg-card";

/** Glass surface for key headers/banners. */
export const glassClass = "bg-card/90 backdrop-blur-md border border-border";

/** Small near-square status chip base — combine with a colour class. */
export const pillClass =
  "inline-flex items-center gap-1 rounded px-2.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase";
