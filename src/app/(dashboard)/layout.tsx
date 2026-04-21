import { FloatingChat } from "@/components/chat/FloatingChat";
import Link from "next/link";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gray-50">
      <header className="flex h-14 shrink-0 items-center border-b border-gray-200 bg-white px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-lg font-bold text-gray-900">
            Outlander<span className="text-[#D4A853]">OS</span>
          </span>
        </Link>
      </header>
      <main className="flex-1 overflow-y-auto">{children}</main>
      <FloatingChat />
    </div>
  );
}
