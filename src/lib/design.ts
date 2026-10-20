/**
 * OutlanderOS design tokens — the 2026 redesign ("Foundations" board).
 *
 * One light blue accent on white, grey cards instead of borders, pill buttons
 * and big plain numbers. Workspace colours survive only as 8px marker dots.
 * Same exports as before, so existing imports keep working.
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

/** Workspace marker colours. Use for 8px dots, never for fills or text. */
export const PORTAL_ACCENTS: Record<PortalKey, string> = {
  commercial: "#9C7C2E",
  production: "#A93B2E",
  print: "#2E5E44",
  editorial: "#6B4E8E",
  finance: "#2F4B8F",
  "think-tank": "#B45A1F",
  contacts: "#2F4B8F",
  directory: "#5B6470",
  admin: "#4A4843",
};

/** Resolve a workspace marker colour from a pathname like "/finance/reports". */
export function portalAccent(pathname: string): string {
  const segment = (pathname.split("/")[1] ?? "") as PortalKey;
  return PORTAL_ACCENTS[segment] ?? "#0B1220";
}

/** The grey card: 24px radius, no border. Hover deepens the grey slightly. */
export const cardClass =
  "rounded-2xl bg-surface transition-colors duration-150 hover:bg-surface-2";

/** Static grey card for containers and tables. */
export const panelClass = "rounded-2xl bg-surface";

/** Frosted surface for sticky bars. */
export const glassClass = "bg-background/90 backdrop-blur-md";

/** Status tag base — a 24px pill. Pair with a tone from TAG_TONES. */
export const pillClass =
  "inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-semibold";

/** Status colours, used only for meaning. */
export const TAG_TONES = {
  ok: "bg-ok-bg text-ok",
  warn: "bg-warn-bg text-warn",
  bad: "bg-bad-bg text-bad",
  info: "bg-info-bg text-info",
  neutral: "bg-surface-2 text-ink-2",
} as const;
export type TagTone = keyof typeof TAG_TONES;
