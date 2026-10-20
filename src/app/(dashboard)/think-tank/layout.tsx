import { Suspense } from "react";
import { AppShell } from "@/components/shell/AppShell";

export default function ThinkTankLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
