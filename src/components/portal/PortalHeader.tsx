"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { portalAccent } from "@/lib/design";
import { PortalSwitcher } from "@/components/portal/PortalSwitcher";
import { BrandLogo } from "@/components/portal/BrandLogo";
import { ThemeToggle } from "@/components/ThemeToggle";

// Maps the parent path segment of a detail route to a human singular label,
// used when the final segment is a raw database id (CUID/UUID) rather than a
// readable slug.
const ENTITY_LABELS: Record<string, string> = {
  deals: "Deal",
  clients: "Client",
  production: "Project",
  projects: "Project",
  directory: "Contact",
  contacts: "Contact",
  "media-plans": "Media Plan",
  "call-sheets": "Call Sheet",
  print: "Issue",
  "think-tank": "Signal",
};

// A path segment that looks like a generated id: a CUID (c… 20+ alphanumerics),
// a UUID, or any long alphanumeric token containing digits. These should never
// be shown raw in a breadcrumb.
function looksLikeId(segment: string): boolean {
  if (/^c[a-z0-9]{20,}$/i.test(segment)) return true;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment))
    return true;
  return segment.length >= 16 && /\d/.test(segment) && !segment.includes("-");
}

function breadcrumbLabel(segments: string[]): string {
  const last = segments[segments.length - 1];
  if (looksLikeId(last)) {
    const parent = segments[segments.length - 2];
    return ENTITY_LABELS[parent] ?? "Details";
  }
  return last
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function PortalHeader() {
  const pathname = usePathname();

  const breadcrumb = pathname.split("/").filter(Boolean);
  const accent = portalAccent(pathname);

  return (
    <header
      className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card/80 backdrop-blur-md px-5 sticky top-0 z-30"
      style={{ boxShadow: `inset 0 -2px 0 0 ${accent}` }}
    >
      {/* Left: Logo + breadcrumb */}
      <div className="flex items-center gap-3">
        <BrandLogo />
        <span className="text-gray-300">/</span>
        <Link
          href="/me"
          className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
        >
          My Dashboard
        </Link>
        <span className="text-gray-300">/</span>

        {/* Portal switcher dropdown (shared with PersonalHeader) */}
        <PortalSwitcher />

        {/* Sub-breadcrumb */}
        {breadcrumb.length > 1 && (
          <>
            <span className="text-gray-300">/</span>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {breadcrumbLabel(breadcrumb)}
            </span>
          </>
        )}
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <NotificationBell />

        <Link
          href="/me"
          className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-400 px-2 py-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          My Dashboard
        </Link>
        <Link
          href="/me/calendar"
          className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-400 px-2 py-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          Calendar
        </Link>
      </div>
    </header>
  );
}
