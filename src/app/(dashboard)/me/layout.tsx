import { cookies } from "next/headers";
import { PersonalHeader } from "@/components/portal/PersonalHeader";
import { PersonalSidebar } from "@/components/portal/PersonalSidebar";

export default async function MeLayout({ children }: { children: React.ReactNode }) {
  // Somebody on a temporary password is held on the change-password screen by
  // the proxy until they choose their own, so every link in the sidebar would
  // just bounce them back. Show the screen on its own instead of surrounding it
  // with a menu that doesn't work.
  if ((await cookies()).get("must_change_pw")?.value === "1") {
    return <>{children}</>;
  }

  return (
    <div className="flex h-full flex-1 flex-col">
      <PersonalHeader />
      <div className="flex flex-1 overflow-hidden">
        <PersonalSidebar />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
