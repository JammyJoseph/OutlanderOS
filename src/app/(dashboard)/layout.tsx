import { FloatingChat } from "@/components/chat/FloatingChat";
import { NotificationBell } from "@/components/layout/NotificationBell";
import Link from "next/link";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gray-50">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-lg font-bold text-gray-900">
            Outlander<span className="text-[#D4A853]">OS</span>
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/me"
            className="text-xs text-gray-500 hover:text-gray-900"
          >
            Deadlines
          </Link>
          <Link
            href="/tasks"
            className="text-xs text-gray-500 hover:text-gray-900"
          >
            Tasks
          </Link>
          <NotificationBell />
        </div>
      </header>
      <main className="flex-1 overflow-y-auto">{children}</main>
      <FloatingChat />
    </div>
  );
}
