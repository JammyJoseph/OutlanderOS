import { requireAdminPage } from "@/lib/require-admin-page";

// Finance is admin-only. MEMBER users are redirected to /me before any
// finance page renders.
export default async function FinanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdminPage();
  return <>{children}</>;
}
