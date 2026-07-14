"use client";

import { NotificationBell } from "@/components/layout/NotificationBell";
import { BrandLogo } from "@/components/portal/BrandLogo";
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
          <BrandLogo />
          <div className="flex items-center gap-1">
            <Link
              href="/me"
              className="rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
            >
              Deadlines
            </Link>
            <Link
              href="/admin"
              aria-label="Admin & Settings"
              className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
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
