"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { portalAccent } from "@/lib/design";
import {
  LayoutDashboard,
  Users,
  FileText,
  BarChart2,
  Calendar,
  Shield,
  Settings,
  Server,
  BookOpen,
  Film,
  Clipboard,
  Newspaper,
  Receipt,
  Camera,
  FolderKanban,
  Contact,
  Clock,
  Archive,
  Trophy,
  ScanLine,
  Network,
  Sparkles,
} from "lucide-react";

type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
};

const SIDEBAR_CONFIG: Record<string, { title: string; items: NavItem[] }> = {
  commercial: {
    title: "Commercial",
    items: [
      { label: "Dashboard", href: "/commercial", icon: LayoutDashboard },
      { label: "Pipeline", href: "/commercial/pipeline", icon: FolderKanban },
      { label: "Archive", href: "/commercial/archive", icon: Archive },
      { label: "Clients", href: "/commercial/clients", icon: Users },
      { label: "Media Plans", href: "/commercial/media-plans", icon: FileText },
      { label: "Content Tracker", href: "/commercial/content-tracker", icon: Camera },
    ],
  },
  production: {
    title: "Production",
    items: [
      { label: "Overview", href: "/production", icon: LayoutDashboard },
      { label: "All Projects", href: "/production?view=projects", icon: Film },
      { label: "Calendar", href: "/production?view=calendar", icon: Calendar },
    ],
  },
  print: {
    title: "Print",
    items: [
      { label: "Dashboard", href: "/print", icon: LayoutDashboard },
      { label: "Flat Plan", href: "/print/flat-plan", icon: Newspaper },
      { label: "Distribution", href: "/print/distribution", icon: Camera },
    ],
  },
  finance: {
    title: "Finance",
    items: [
      { label: "Dashboard", href: "/finance?tab=dashboard", icon: LayoutDashboard },
      { label: "Project Folders", href: "/finance?tab=projects", icon: FolderKanban },
      { label: "Invoices & Approvals", href: "/finance?tab=invoices", icon: Receipt },
      { label: "Expenses", href: "/finance?tab=expenses", icon: Clipboard },
      { label: "P&L & History", href: "/finance?tab=pl", icon: BarChart2 },
    ],
  },
  directory: {
    title: "Directory",
    items: [
      { label: "Dashboard", href: "/directory", icon: LayoutDashboard },
      { label: "All Contacts", href: "/directory?view=contacts", icon: Contact },
      { label: "Scanner", href: "/directory?view=scanner", icon: ScanLine },
      { label: "Network", href: "/directory?view=network", icon: Network },
      { label: "Lighthouse", href: "/directory/lighthouse", icon: Sparkles },
      { label: "Leaderboard", href: "/directory/leaderboard", icon: Trophy },
      { label: "Recently Added", href: "/directory?view=recent", icon: Clock },
    ],
  },
  admin: {
    title: "Admin",
    items: [
      { label: "Overview", href: "/admin", icon: Shield },
      { label: "Team", href: "/admin/team", icon: Users },
      { label: "System", href: "/admin/system", icon: Server },
      { label: "Settings", href: "/admin/settings", icon: Settings },
      { label: "Business Plan", href: "/admin/business-plan", icon: BookOpen },
    ],
  },
};

function getPortalKey(pathname: string): string {
  const segment = pathname.split("/")[1] ?? "";
  return segment;
}

export function PortalSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const key = getPortalKey(pathname);
  const config = SIDEBAR_CONFIG[key];
  const accent = portalAccent(pathname);

  // Some portals (Finance especially) navigate by query string — /finance?tab=pl,
  // /production?view=calendar. usePathname() strips the query, so comparing on
  // path alone made every tab highlight the same item (usually "Dashboard").
  // We key the active state off the tab/view param when an item carries one.
  const currentTab = searchParams.get("tab") ?? searchParams.get("view");

  if (!config) return null;

  return (
    <aside className="flex w-[200px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar/80 backdrop-blur-md">
      <div className="flex h-10 items-center gap-2 border-b border-sidebar-border px-4">
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: accent }}
        />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
          {config.title}
        </span>
      </div>
      <nav className="flex-1 overflow-y-auto py-2">
        <ul className="space-y-0.5 px-2">
          {config.items.map((item) => {
            const Icon = item.icon;
            const cleanHref = item.href.split("?")[0].split("#")[0];
            const hasHash = item.href.includes("#");
            const queryString = item.href.includes("?") ? item.href.split("?")[1] : "";
            const itemParams = new URLSearchParams(queryString);
            const itemTab = itemParams.get("tab") ?? itemParams.get("view");

            let isActive: boolean;
            if (hasHash) {
              isActive = false;
            } else if (itemTab !== null) {
              // Query-driven item: match both the base path and the tab/view value.
              // "dashboard" is the default tab, so a bare path (no param) counts too.
              const matchesTab =
                currentTab === itemTab || (currentTab === null && itemTab === "dashboard");
              isActive = pathname === cleanHref && matchesTab;
            } else if (cleanHref === `/${key}`) {
              // Portal root/overview item (no query) — active only when there's no
              // tab/view selected, so it doesn't stay lit on sub-views.
              isActive = (pathname === `/${key}` || pathname === `/${key}/`) && currentTab === null;
            } else {
              isActive = pathname.startsWith(cleanHref) && cleanHref !== `/${key}`;
            }

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all duration-200",
                    isActive
                      ? "font-semibold text-gray-900 dark:text-gray-100 shadow-sm"
                      : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-800 dark:hover:text-gray-200"
                  )}
                  style={isActive ? { backgroundColor: `${accent}14` } : undefined}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0 transition-colors",
                      !isActive && "text-gray-400"
                    )}
                    style={isActive ? { color: accent } : undefined}
                  />
                  <span className="truncate font-medium">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
