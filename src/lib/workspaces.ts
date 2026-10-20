// The workspaces and what's in each one's sidebar — the single source of truth
// for the sidebar, the workspace switcher, the hub and search.
//
// Before the redesign this lived in three places (PortalSidebar,
// PersonalSidebar, PortalSwitcher) that had drifted: "Tasks" had a page but no
// link, and the two headers listed portals differently.

import {
  Archive,
  BarChart3,
  BookOpen,
  Briefcase,
  CalendarDays,
  Camera,
  CheckSquare,
  Clapperboard,
  Clock,
  Contact,
  FileText,
  FolderKanban,
  FolderOpen,
  Home,
  LayoutDashboard,
  Network,
  Newspaper,
  Plane,
  Printer,
  Receipt,
  ScanLine,
  Server,
  Settings,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Trophy,
  Truck,
  User,
  Users,
  Wallet,
  Radio,
  BookUser,
  type LucideIcon,
} from "lucide-react";

export type WorkspaceKey =
  | "me"
  | "commercial"
  | "production"
  | "print"
  | "directory"
  | "finance"
  | "admin";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface Workspace {
  key: WorkspaceKey;
  name: string;
  href: string;
  /** One line under the name in the switcher and on the hub. */
  blurb: string;
  /** Marker colour — an 8px dot, never a fill. */
  dot: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  nav: NavItem[];
}

export const WORKSPACES: Workspace[] = [
  {
    key: "me",
    name: "My workspace",
    href: "/me",
    blurb: "Your tasks, week, deadlines and holiday",
    dot: "#0B1220",
    icon: Home,
    nav: [
      { label: "Home", href: "/me", icon: Home },
      { label: "Tasks", href: "/me/tasks", icon: CheckSquare },
      { label: "Calendar", href: "/me/calendar", icon: CalendarDays },
      { label: "Holiday", href: "/me/holiday", icon: Plane },
      { label: "Think tank", href: "/think-tank", icon: Radio },
      { label: "Profile", href: "/me/profile", icon: User },
      { label: "Settings", href: "/me/settings", icon: SlidersHorizontal },
    ],
  },
  {
    key: "commercial",
    name: "Commercial",
    href: "/commercial",
    blurb: "Deals, clients, media plans and content",
    dot: "#9C7C2E",
    icon: Briefcase,
    nav: [
      { label: "Dashboard", href: "/commercial", icon: LayoutDashboard },
      { label: "Pipeline", href: "/commercial/pipeline", icon: FolderKanban },
      { label: "Clients", href: "/commercial/clients", icon: Users },
      { label: "Media plans", href: "/commercial/media-plans", icon: FileText },
      { label: "Content tracker", href: "/commercial/content-tracker", icon: Camera },
      { label: "Reports", href: "/commercial/reports", icon: BarChart3 },
      { label: "Archive", href: "/commercial/archive", icon: Archive },
    ],
  },
  {
    key: "production",
    name: "Production",
    href: "/production",
    blurb: "Briefs, budgets, call sheets and crew",
    dot: "#A93B2E",
    icon: Clapperboard,
    nav: [
      { label: "Overview", href: "/production", icon: LayoutDashboard },
      { label: "All projects", href: "/production?view=projects", icon: FolderOpen },
    ],
  },
  {
    key: "print",
    name: "Print",
    href: "/print",
    blurb: "Flat plans, distribution and sales",
    dot: "#2E5E44",
    icon: Printer,
    nav: [
      { label: "Dashboard", href: "/print", icon: LayoutDashboard },
      { label: "Flat plan", href: "/print/flat-plan", icon: Newspaper },
      { label: "Distribution", href: "/print/distribution", icon: Truck },
      { label: "Sales reports", href: "/print/sales-reports", icon: BarChart3 },
    ],
  },
  {
    key: "directory",
    name: "Directory",
    href: "/directory",
    blurb: "Contacts, talent, collaborators and IG scanning",
    dot: "#5B6470",
    icon: BookUser,
    nav: [
      { label: "Dashboard", href: "/directory", icon: LayoutDashboard },
      { label: "All contacts", href: "/directory?view=contacts", icon: Contact },
      { label: "Scanner", href: "/directory?view=scanner", icon: ScanLine },
      { label: "Network", href: "/directory?view=network", icon: Network },
      { label: "Print directory", href: "/directory?view=print", icon: Printer },
      { label: "Lighthouse", href: "/directory/lighthouse", icon: Sparkles },
      { label: "Leaderboard", href: "/directory/leaderboard", icon: Trophy },
      { label: "Recently added", href: "/directory?view=recent", icon: Clock },
    ],
  },
  {
    key: "finance",
    name: "Finance",
    href: "/finance",
    blurb: "Revenue, invoices, expenses and P&L",
    dot: "#2F4B8F",
    icon: Wallet,
    adminOnly: true,
    nav: [
      { label: "Dashboard", href: "/finance?tab=dashboard", icon: LayoutDashboard },
      { label: "Project folders", href: "/finance?tab=projects", icon: FolderKanban },
      { label: "Invoices and approvals", href: "/finance?tab=invoices", icon: Receipt },
      { label: "Expenses", href: "/finance?tab=expenses", icon: Wallet },
      { label: "P&L and history", href: "/finance?tab=pl", icon: BarChart3 },
    ],
  },
  {
    key: "admin",
    name: "Admin",
    href: "/admin",
    blurb: "Team, system and settings",
    dot: "#4A4843",
    icon: Shield,
    adminOnly: true,
    nav: [
      { label: "Overview", href: "/admin", icon: Shield },
      { label: "Team", href: "/admin/team", icon: Users },
      { label: "System", href: "/admin/system", icon: Server },
      { label: "Settings", href: "/admin/settings", icon: Settings },
      { label: "Business plan", href: "/admin/business-plan", icon: BookOpen },
    ],
  },
];

/** Which workspace a path belongs to. Personal pages and the think tank are "me". */
export function workspaceFor(pathname: string): Workspace {
  const seg = pathname.split("/")[1] ?? "";
  if (seg === "me" || seg === "think-tank" || seg === "hub" || seg === "") return WORKSPACES[0];
  return WORKSPACES.find((w) => w.key === seg) ?? WORKSPACES[0];
}

export function visibleWorkspaces(isAdmin: boolean): Workspace[] {
  return WORKSPACES.filter((w) => !w.adminOnly || isAdmin);
}

/**
 * Is this nav item the page you're on? Some workspaces navigate by query
 * string (/finance?tab=pl, /production?view=projects), which usePathname()
 * strips, so the tab/view param is compared too.
 */
export function isNavActive(item: NavItem, pathname: string, params: URLSearchParams, workspace: Workspace): boolean {
  const [path, query = ""] = item.href.split("?");
  const itemParams = new URLSearchParams(query);
  const itemTab = itemParams.get("tab") ?? itemParams.get("view");
  const currentTab = params.get("tab") ?? params.get("view");

  if (itemTab !== null) {
    const matchesTab = currentTab === itemTab || (currentTab === null && itemTab === "dashboard");
    return pathname === path && matchesTab;
  }
  if (path === workspace.href) {
    // The workspace's own root is active only on the root itself with no tab
    // selected — otherwise it would stay lit on every sub-page.
    return (pathname === path || pathname === `${path}/`) && currentTab === null;
  }
  return pathname === path || pathname.startsWith(`${path}/`);
}
