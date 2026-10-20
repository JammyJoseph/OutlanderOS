import { Suspense } from "react";
import { cookies } from "next/headers";
import { AppShell } from "@/components/shell/AppShell";

export default async function MeLayout({ children }: { children: React.ReactNode }) {
  // Somebody on a temporary password is held on the change-password screen by
  // the proxy until they choose their own, so every link in the sidebar would
  // just bounce them back. Show the screen on its own instead of surrounding it
  // with a menu that doesn't work.
  if ((await cookies()).get("must_change_pw")?.value === "1") {
    return <>{children}</>;
  }

  // The sidebar reads the query string (useSearchParams) for tab-aware
  // highlighting, so it needs a Suspense boundary.
  return (
    <Suspense fallback={null}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
