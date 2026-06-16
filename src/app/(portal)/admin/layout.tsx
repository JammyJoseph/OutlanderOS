import { requireAdminPage } from "@/lib/require-admin-page";

// Admin & Settings is admin-only. MEMBER users are redirected to /me before
// any admin page renders.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdminPage();
  return <>{children}</>;
}
