"use client";

import { NotificationBell } from "@/components/layout/NotificationBell";
import { ThemeToggle } from "@/components/ThemeToggle";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // /me has its own full header — skip the mini header here
  const hideHeader = pathname?.startsWith("/me");

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {!hideHeader && (
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-border bg-card/80 px-6 backdrop-blur-md">
          <Link href="/me" className="flex items-center gap-2">
            <span className="text-lg font-bold tracking-tight text-gray-900">
              Outlander<span className="text-[#ffd700]">OS</span>
            </span>
          </Link>
          <div className="flex items-center gap-1">
            <Link
              href="/me"
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
            >
              Deadlines
            </Link>
            <Link
              href="/admin"
              aria-label="Admin & Settings"
              className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
            >
              <Settings className="h-4 w-4" />
            </Link>
            <ThemeToggle />
            <NotificationBell />
          </div>
        </header>
      )}
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
