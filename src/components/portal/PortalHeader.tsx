"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { Bell, ChevronDown, MessageCircle, Lock, LayoutGrid } from "lucide-react";

const PORTALS = [
  { name: "Commercial", href: "/commercial" },
  { name: "Production", href: "/production" },
  { name: "Print", href: "/print" },
  { name: "Editorial", href: "/editorial" },
  { name: "Contacts", href: "/contacts" },
  { name: "Finance", href: "/finance", restricted: true },
  { name: "Admin", href: "/admin", restricted: true },
  { name: "Ask OS", href: "/ask-os" },
];

function getPortalName(pathname: string): string {
  for (const p of PORTALS) {
    if (pathname.startsWith(p.href)) return p.name;
  }
  return "Portal";
}

export function PortalHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const portalName = getPortalName(pathname);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
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

  useEffect(() => {
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((d) => setUnreadCount(d.unreadCount ?? 0))
      .catch(() => setUnreadCount(0));
  }, [pathname]);

  const breadcrumb = pathname.split("/").filter(Boolean);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-gray-100 bg-white/80 backdrop-blur-md px-5 sticky top-0 z-30">
      {/* Left: Logo + breadcrumb */}
      <div className="flex items-center gap-3">
        <Link
          href="/me"
          className="text-sm font-bold text-gray-900 hover:text-[#D4A853] transition-colors"
        >
          Outlander<span className="text-[#D4A853]">OS</span>
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
            className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-gray-800 hover:bg-gray-100 transition-colors"
          >
            {portalName}
            <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
          </button>

          {dropdownOpen && (
            <div className="absolute left-0 top-full mt-1 w-56 rounded-xl bg-white border border-gray-200 shadow-lg z-50 overflow-hidden">
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

              {PORTALS.map((p) => (
                <button
                  key={p.href}
                  onClick={() => { router.push(p.href); setDropdownOpen(false); }}
                  className={`flex items-center justify-between w-full px-3 py-2 text-sm transition-colors ${
                    pathname.startsWith(p.href)
                      ? "bg-amber-50 text-amber-700 font-medium"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <span>{p.name}</span>
                  {p.restricted && <Lock className="h-3 w-3 text-gray-400" />}
                </button>
              ))}
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
        <Link
          href="/ask-os"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-amber-50 hover:text-[#D4A853] transition-colors"
          title="Ask OS"
        >
          <MessageCircle className="h-4 w-4" />
        </Link>

        <Link
          href="/me"
          className="relative flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
          title="Notifications"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#D4A853] px-1 text-[10px] font-bold text-black">
              {unreadCount}
            </span>
          )}
        </Link>

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
