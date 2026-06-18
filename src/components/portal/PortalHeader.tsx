"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { portalAccent } from "@/lib/design";
import { PortalSwitcher } from "@/components/portal/PortalSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";

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
        <Link
          href="/me"
          className="text-sm font-bold text-gray-900 hover:text-[#ffd700] transition-colors"
        >
          Outlander<span className="text-[#ffd700]">OS</span>
        </Link>
        <span className="text-gray-300">/</span>
        <Link
          href="/me"
          className="text-xs text-gray-500 hover:text-gray-800 transition-colors"
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
            <span className="text-sm text-gray-500">
              {breadcrumb[breadcrumb.length - 1]
                .split("-")
                .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                .join(" ")}
            </span>
          </>
        )}
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <NotificationBell tone="dark" />

        <Link
          href="/me"
          className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors"
        >
          My Dashboard
        </Link>
        <Link
          href="/"
          className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors"
        >
          Calendar
        </Link>
      </div>
    </header>
  );
}
