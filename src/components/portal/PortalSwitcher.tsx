"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import {
  ChevronDown,
  LayoutGrid,
  Shield,
  Briefcase,
  Clapperboard,
  Wallet,
  Printer,
  BookUser,
  type LucideIcon,
} from "lucide-react";
import { PORTAL_ACCENTS, type PortalKey } from "@/lib/design";

type PortalItem = {
  name: string;
  href: string;
  key: PortalKey;
  icon: LucideIcon;
  adminOnly?: boolean;
};

// The single source of truth for portal navigation. Both PortalHeader and
// PersonalHeader render this component, so the dropdown is identical no matter
// which page you are on.
const PORTALS: PortalItem[] = [
  { name: "Commercial", href: "/commercial", key: "commercial", icon: Briefcase },
  { name: "Production", href: "/production", key: "production", icon: Clapperboard },
  { name: "Finance", href: "/finance", key: "finance", icon: Wallet, adminOnly: true },
  { name: "Print", href: "/print", key: "print", icon: Printer },
  { name: "Directory", href: "/directory", key: "directory", icon: BookUser },
];

function currentPortal(pathname: string): PortalItem | null {
  return PORTALS.find((p) => pathname.startsWith(p.href)) ?? null;
}

export function PortalSwitcher() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Role comes from the database (via /api/me), not the JWT, so a freshly
  // promoted admin sees the right portals without re-logging in.
  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => setRole(d.user?.role ?? null))
      .catch(() => {});
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const isAdmin = role === "ADMIN";
  const visiblePortals = PORTALS.filter((p) => !p.adminOnly || isAdmin);

  const active = currentPortal(pathname);
  const triggerAccent = active ? PORTAL_ACCENTS[active.key] : "#ffd700";
  const triggerLabel = active ? active.name : "Portals";

  function go(href: string) {
    router.push(href);
    setOpen(false);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-gray-800 hover:bg-gray-100 transition-colors"
      >
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: triggerAccent }} />
        {triggerLabel}
        <ChevronDown
          className={`h-3.5 w-3.5 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-56 rounded-xl bg-[#1e1e1e] border border-[#2a2a2a] shadow-lg shadow-black/40 z-50 overflow-hidden">
          {/* Back to personal dashboard */}
          <button
            onClick={() => go("/me")}
            className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
          >
            <LayoutGrid className="h-3.5 w-3.5 text-gray-400" />
            My Dashboard
          </button>

          <div className="h-px bg-gray-100" />

          <div className="px-3 py-1.5">
            <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">
              Switch Portal
            </span>
          </div>

          {visiblePortals.map((p) => {
            const accent = PORTAL_ACCENTS[p.key];
            const isCurrent = pathname.startsWith(p.href);
            const Icon = p.icon;
            return (
              <button
                key={p.href}
                onClick={() => go(p.href)}
                className={`flex items-center gap-2 w-full px-3 py-2 text-sm transition-colors ${
                  isCurrent ? "font-semibold text-gray-900" : "text-gray-700 hover:bg-gray-50"
                }`}
                style={isCurrent ? { backgroundColor: `${accent}14` } : undefined}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: accent }} />
                <Icon className="h-3.5 w-3.5 text-gray-400" />
                {p.name}
              </button>
            );
          })}

          {isAdmin && (
            <>
              <div className="h-px bg-gray-100" />
              <button
                onClick={() => go("/admin")}
                className={`flex items-center gap-2 w-full px-3 py-2 text-sm transition-colors ${
                  pathname.startsWith("/admin")
                    ? "font-semibold text-gray-900"
                    : "text-gray-500 hover:bg-gray-50"
                }`}
                style={pathname.startsWith("/admin") ? { backgroundColor: `${PORTAL_ACCENTS.admin}14` } : undefined}
              >
                <Shield className="h-3.5 w-3.5 text-gray-400" />
                Admin &amp; Settings
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
