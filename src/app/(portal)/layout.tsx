import { PortalHeader } from "@/components/portal/PortalHeader";
import { PortalSidebar } from "@/components/portal/PortalSidebar";
import { FloatingChat } from "@/components/chat/FloatingChat";

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gray-50">
      <PortalHeader />
      <div className="flex flex-1 overflow-hidden">
        <PortalSidebar />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
      <FloatingChat />
    </div>
  );
}
