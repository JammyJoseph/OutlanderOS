"use client";

import { FloatingChat } from "@/components/chat/FloatingChat";
import { NotificationBell } from "@/components/layout/NotificationBell";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // /me has its own full header — skip the mini header here
  const hideHeader = pathname?.startsWith("/me");

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#F8F9FA]">
      {!hideHeader && (
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-[#E5E7EB] bg-white/80 px-6 backdrop-blur-md">
          <Link href="/me" className="flex items-center gap-2">
            <span className="text-lg font-bold tracking-tight text-gray-900">
              Outlander<span className="text-[#D4A853]">OS</span>
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
              href="/tasks"
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
            >
              Tasks
            </Link>
            <NotificationBell />
          </div>
        </header>
      )}
      <main className="flex-1 overflow-y-auto">{children}</main>
      <FloatingChat />
    </div>
  );
}
