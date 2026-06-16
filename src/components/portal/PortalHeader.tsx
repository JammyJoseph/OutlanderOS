"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { ChevronDown, Lock, LayoutGrid, Shield } from "lucide-react";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { portalAccent } from "@/lib/design";

const PORTALS = [
  { name: "Commercial", href: "/commercial" },
  { name: "Production", href: "/production" },
  { name: "Finance", href: "/finance", restricted: true },
  { name: "Print", href: "/print" },
  { name: "Directory", href: "/directory" },
];

// Sections that still route but live outside the main portal switcher.
const EXTRA_SECTIONS = [
  { name: "Admin", href: "/admin" },
];

function getPortalName(pathname: string): string {
  for (const p of [...PORTALS, ...EXTRA_SECTIONS]) {
    if (pathname.startsWith(p.href)) return p.name;
  }
  return "Portal";
}

export function PortalHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const portalName = getPortalName(pathname);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const breadcrumb = pathname.split("/").filter(Boolean);
  const accent = portalAccent(pathname);

  return (
    <header
      className="flex h-14 shrink-0 items-center justify-between border-b border-[#2a2a2a] bg-[#141414]/80 backdrop-blur-md px-5 sticky top-0 z-30"
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

        {/* Portal switcher dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-gray-800 hover:bg-gray-100 transition-colors"
          >
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: accent }} />
            {portalName}
            <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
          </button>

          {dropdownOpen && (
            <div className="absolute left-0 top-full mt-1 w-56 rounded-xl bg-[#1e1e1e] border border-[#2a2a2a] shadow-lg shadow-black/40 z-50 overflow-hidden">
              {/* Back to My Dashboard */}
              <button
                onClick={() => { router.push("/me"); setDropdownOpen(false); }}
                className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
              >
                <LayoutGrid className="h-3.5 w-3.5 text-gray-400" />
                ← My Dashboard
              </button>

              <div className="h-px bg-gray-100" />

              <div className="px-3 py-1.5">
                <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Switch Portal</span>
              </div>

              {PORTALS.map((p) => {
                const pAccent = portalAccent(p.href);
                const isCurrent = pathname.startsWith(p.href);
                return (
                  <button
                    key={p.href}
                    onClick={() => { router.push(p.href); setDropdownOpen(false); }}
                    className={`flex items-center justify-between w-full px-3 py-2 text-sm transition-colors ${
                      isCurrent ? "font-semibold text-gray-900" : "text-gray-700 hover:bg-gray-50"
                    }`}
                    style={isCurrent ? { backgroundColor: `${pAccent}14` } : undefined}
                  >
                    <span className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: pAccent }} />
                      {p.name}
                    </span>
                    {p.restricted && <Lock className="h-3 w-3 text-gray-400" />}
                  </button>
                );
              })}

              <div className="h-px bg-gray-100" />

              <button
                onClick={() => { router.push("/admin"); setDropdownOpen(false); }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
              >
                <Shield className="h-3.5 w-3.5 text-gray-400" />
                Admin & Settings
              </button>
            </div>
          )}
        </div>

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
