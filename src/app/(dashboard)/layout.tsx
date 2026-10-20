// Personal pages (/me…) and the think tank sit in the app shell via their own
// layouts; the hub draws its own frame, because it is the page you choose a
// workspace from and has no sidebar of its own.
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
