"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Calendar,
  User,
  Plane,
  Settings,
} from "lucide-react";

const ITEMS = [
  { label: "Dashboard", href: "/me", icon: LayoutDashboard },
  { label: "Calendar", href: "/me/calendar", icon: Calendar },
  { label: "Holiday", href: "/me/holiday", icon: Plane },
  { label: "Profile", href: "/me/profile", icon: User },
  { label: "Settings", href: "/me/settings", icon: Settings },
];

export function PersonalSidebar() {
  const pathname = usePathname();
  return (
    <aside className="flex w-[200px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar/80 backdrop-blur-md">
      <div className="flex h-10 items-center gap-2 border-b border-sidebar-border px-4">
        <span className="h-2 w-2 rounded-full bg-[#ffd700]" />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
          My Dashboard
        </span>
      </div>
      <nav className="flex-1 overflow-y-auto py-2">
        <ul className="space-y-0.5 px-2">
          {ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/me" ? pathname === "/me" : pathname.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all duration-150",
                    isActive
                      ? "bg-[#ffd700]/10 font-semibold text-gray-900 shadow-sm"
                      : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0 transition-colors",
                      isActive ? "text-[#ffd700]" : "text-gray-400"
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
