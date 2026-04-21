import Link from "next/link";
import { Activity, CheckSquare, Bell, BarChart2, ArrowRight } from "lucide-react";

const tools = [
  { label: "Activity Log", href: "/activity", icon: Activity, desc: "Full system activity timeline" },
  { label: "Tasks", href: "/tasks", icon: CheckSquare, desc: "Priority task management" },
  { label: "Reminders", href: "/reminders", icon: Bell, desc: "Alerts and follow-ups" },
  { label: "Reports", href: "/reports", icon: BarChart2, desc: "Business reporting" },
];

export default function EngineRoomPage() {
  return (
    <div className="p-6">
      <h1 className="mb-1 text-xl font-bold text-gray-900">Engine Room</h1>
      <p className="mb-6 text-sm text-gray-500">Operational tools and activity</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
            <Link
              key={tool.href}
              href={tool.href}
              className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 transition-all hover:border-[#D4A853]/40 hover:shadow-md group"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100">
                  <Icon className="h-4 w-4 text-gray-500" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{tool.label}</p>
                  <p className="text-xs text-gray-500">{tool.desc}</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-gray-300 transition-colors group-hover:text-[#D4A853]" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
