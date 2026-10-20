import { Suspense } from "react";
import { AppShell } from "@/components/shell/AppShell";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  // The sidebar reads the query string (useSearchParams) for tab-aware
  // highlighting — /finance?tab=pl — so it needs a Suspense boundary.
  return (
    <Suspense fallback={null}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
