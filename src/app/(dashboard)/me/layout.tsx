import { PersonalHeader } from "@/components/portal/PersonalHeader";
import { PersonalSidebar } from "@/components/portal/PersonalSidebar";

export default function MeLayout({ children }: { children: React.ReactNode }) {
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
