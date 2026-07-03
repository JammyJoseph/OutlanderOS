import { Suspense } from "react";
import { PortalHeader } from "@/components/portal/PortalHeader";
import { PortalSidebar } from "@/components/portal/PortalSidebar";

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <PortalHeader />
      <div className="flex flex-1 overflow-hidden">
        {/* PortalSidebar reads the query string (useSearchParams) for tab-aware
            highlighting, so it needs a Suspense boundary. */}
        <Suspense fallback={<div className="w-[200px] shrink-0 border-r border-sidebar-border bg-sidebar/80" />}>
          <PortalSidebar />
        </Suspense>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
