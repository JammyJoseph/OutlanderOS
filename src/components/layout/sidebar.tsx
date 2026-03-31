"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Mail,
  Calendar,
  DollarSign,
  FolderKanban,
  CheckSquare,
  Users,
  Bot,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/email", label: "Email", icon: Mail },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/finance", label: "Finance", icon: DollarSign },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/team", label: "Team", icon: Users },
  { href: "/agents", label: "AI Agents", icon: Bot },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "relative flex h-screen flex-col border-r border-neutral-800 bg-neutral-950 transition-all duration-300",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Logo */}
      <div className="flex h-14 items-center border-b border-neutral-800 px-4">
        {collapsed ? (
          <span className="text-lg font-bold text-[#D4A853]">O</span>
        ) : (
          <Link href="/" className="flex items-center gap-2">
            <span className="text-lg font-bold text-white">
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
                      ? "bg-neutral-800 text-white"
                      : "text-neutral-400 hover:bg-neutral-900 hover:text-white"
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
      <div className="border-t border-neutral-800 p-2">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
            pathname === "/settings"
              ? "bg-neutral-800 text-white"
              : "text-neutral-400 hover:bg-neutral-900 hover:text-white"
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
        className="absolute -right-3 top-16 flex h-6 w-6 items-center justify-center rounded-full border border-neutral-700 bg-neutral-900 text-neutral-400 hover:text-white"
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
