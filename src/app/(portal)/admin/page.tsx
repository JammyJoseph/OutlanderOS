import Link from "next/link";
import { Users, Server, Settings, BookOpen, Activity, Shield } from "lucide-react";

const items = [
  { label: "Team", desc: "Members, roles, Slack status", href: "/admin/team", icon: Users },
  { label: "System", desc: "Integrations, connected accounts", href: "/admin/system", icon: Server },
  { label: "Settings", desc: "Account and app configuration", href: "/admin/settings", icon: Settings },
  { label: "Business Plan", desc: "Strategic goals and milestones", href: "/admin/business-plan", icon: BookOpen },
  { label: "Engine Room", desc: "Tasks, activity log, reminders", href: "/admin/engine-room", icon: Activity },
];

export default function AdminPage() {
  return (
    <div className="p-6">
      <div className="mb-6 flex items-center gap-3">
        <Shield className="h-6 w-6 text-[#D4A853]" />
        <div>
          <h1 className="text-xl font-bold text-gray-900">Admin</h1>
          <p className="text-sm text-gray-500">Team, system, and engine room</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-5 transition-all hover:border-[#D4A853]/40 hover:shadow-md"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100">
                <Icon className="h-5 w-5 text-gray-500" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">{item.label}</p>
                <p className="mt-0.5 text-xs text-gray-500">{item.desc}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
