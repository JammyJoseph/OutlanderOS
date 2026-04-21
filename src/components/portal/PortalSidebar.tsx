"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  FileText,
  BarChart2,
  Calendar,
  DollarSign,
  CreditCard,
  TrendingUp,
  Shield,
  Settings,
  Server,
  BookOpen,
  Bot,
  Megaphone,
  Film,
  Clipboard,
  Newspaper,
  PenTool,
  BookUser,
  LayoutGrid,
  Receipt,
  Camera,
  Activity,
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
      { label: "Pipeline", href: "/commercial", icon: LayoutDashboard },
      { label: "Clients", href: "/commercial/clients", icon: Users },
      { label: "Media Plans", href: "/commercial/media-plans", icon: FileText },
      { label: "Content Tracker", href: "/commercial/content-tracker", icon: Camera },
      { label: "Calendar", href: "/commercial/calendar", icon: Calendar },
    ],
  },
  production: {
    title: "Production",
    items: [
      { label: "Overview", href: "/production", icon: LayoutDashboard },
      { label: "Briefs", href: "/production/briefs", icon: Clipboard },
      { label: "Call Sheets", href: "/production/call-sheets", icon: Film },
    ],
  },
  print: {
    title: "Print",
    items: [
      { label: "Issues", href: "/print", icon: Newspaper },
      { label: "Flat Plan", href: "/print/flat-plan", icon: LayoutGrid },
      { label: "Distribution", href: "/print/distribution", icon: Megaphone },
    ],
  },
  editorial: {
    title: "Editorial",
    items: [
      { label: "Pipeline", href: "/editorial", icon: PenTool },
      { label: "Writers", href: "/editorial/writers", icon: Users },
      { label: "Calendar", href: "/editorial/calendar", icon: Calendar },
    ],
  },
  contacts: {
    title: "Contacts",
    items: [
      { label: "All Contacts", href: "/contacts", icon: BookUser },
      { label: "Brands", href: "/contacts?category=brand", icon: Megaphone },
      { label: "Press", href: "/contacts?category=press", icon: Newspaper },
      { label: "Creatives", href: "/contacts?category=photographer", icon: Film },
    ],
  },
  finance: {
    title: "Finance",
    items: [
      { label: "Dashboard", href: "/finance", icon: LayoutDashboard },
      { label: "Deals", href: "/finance?tab=deals", icon: DollarSign },
      { label: "Billing", href: "/finance?tab=billing", icon: CreditCard },
      { label: "Expenses", href: "/finance?tab=expenses", icon: Receipt },
      { label: "Cash Flow", href: "/finance?tab=cashflow", icon: TrendingUp },
      { label: "Reports", href: "/finance/reports", icon: BarChart2 },
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
      { label: "Engine Room", href: "/admin/engine-room", icon: Activity },
    ],
  },
  "ask-os": {
    title: "Ask OS",
    items: [
      { label: "Chat", href: "/ask-os", icon: Bot },
    ],
  },
};

function getPortalKey(pathname: string): string {
  const segment = pathname.split("/")[1] ?? "";
  return segment;
}

export function PortalSidebar() {
  const pathname = usePathname();
  const key = getPortalKey(pathname);
  const config = SIDEBAR_CONFIG[key];

  if (!config) return null;

  return (
    <aside className="flex w-[200px] shrink-0 flex-col border-r border-gray-100 bg-white/80">
      <div className="flex h-10 items-center border-b border-gray-100 px-4">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
          {config.title}
        </span>
      </div>
      <nav className="flex-1 overflow-y-auto py-2">
        <ul className="space-y-0.5 px-2">
          {config.items.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === `/${key}`
                ? pathname === `/${key}` || (pathname === `/${key}/` && item.href === `/${key}`)
                : pathname.startsWith(item.href.split("?")[0]) && item.href !== `/${key}`;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all duration-150",
                    isActive
                      ? "bg-amber-50 text-gray-900 shadow-sm"
                      : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0 transition-colors",
                      isActive ? "text-[#D4A853]" : "text-gray-400"
                    )}
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
