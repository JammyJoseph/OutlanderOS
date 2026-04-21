"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Calendar,
  DollarSign,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  Bot,
  FileText,
  Activity,
  FileBarChart,
  LayoutGrid,
  BookUser,
} from "lucide-react";
import { useState } from "react";

const navItems = [
  { href: "/hub", label: "Dashboard", icon: LayoutDashboard },
  { href: "/activity", label: "Activity Log", icon: Activity },
  { href: "/office", label: "Ask OS", icon: Bot },
  { href: "/contacts", label: "Contacts", icon: BookUser },
  { href: "/finance", label: "Finance", icon: DollarSign },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/team", label: "Team", icon: Users },
  { href: "/business-plan", label: "Business Plan", icon: FileText },
  { href: "/reports", label: "Reports", icon: FileBarChart },
  { href: "/system", label: "System", icon: LayoutGrid },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "relative flex h-screen flex-col border-r border-black/[0.06] bg-white transition-all duration-300",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Logo */}
      <div className="flex h-14 items-center border-b border-gray-200 px-4">
        {collapsed ? (
          <span className="text-lg font-bold text-[#D4A853]">O</span>
        ) : (
          <Link href="/" className="flex items-center gap-2">
            <span className="text-lg font-bold text-gray-900">
              Outlander<span className="text-[#D4A853]">OS</span>
            </span>
          </Link>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-0.5 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-amber-50 text-gray-900"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      isActive ? "text-[#D4A853]" : ""
                    )}
                  />
                  {!collapsed && (
                    <span className="truncate">{item.label}</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Settings */}
      <div className="border-t border-gray-200 p-2">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
            pathname === "/settings"
              ? "bg-amber-50 text-gray-900"
              : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
          )}
          title={collapsed ? "Settings" : undefined}
        >
          <Settings
            className={cn(
              "h-4 w-4 shrink-0",
              pathname === "/settings" ? "text-[#D4A853]" : ""
            )}
          />
          {!collapsed && <span>Settings</span>}
        </Link>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-16 flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 hover:text-gray-900"
      >
        {collapsed ? (
          <ChevronRight className="h-3 w-3" />
        ) : (
          <ChevronLeft className="h-3 w-3" />
        )}
      </button>
    </aside>
  );
}
