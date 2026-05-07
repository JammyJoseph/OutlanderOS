"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Check,
  Calendar,
  User,
  Plane,
  Settings,
} from "lucide-react";

const ITEMS = [
  { label: "Overview", href: "/me", icon: LayoutDashboard },
  { label: "My Tasks", href: "/me/tasks", icon: Check },
  { label: "My Calendar", href: "/me/calendar", icon: Calendar },
  { label: "My Profile", href: "/me/profile", icon: User },
  { label: "Holiday", href: "/me/holiday", icon: Plane },
  { label: "Settings", href: "/me/settings", icon: Settings },
];

export function PersonalSidebar() {
  const pathname = usePathname();
  return (
    <aside className="flex w-[200px] shrink-0 flex-col border-r border-gray-100 bg-white/80">
      <div className="flex h-10 items-center border-b border-gray-100 px-4">
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
