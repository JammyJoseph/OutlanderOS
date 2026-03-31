import { EmailSummaryWidget } from "@/components/widgets/email-summary";
import { TodaysScheduleWidget } from "@/components/widgets/todays-schedule";
import { FinanceSnapshotWidget } from "@/components/widgets/finance-snapshot";
import { ActiveProjectsWidget } from "@/components/widgets/active-projects";
import { PriorityTasksWidget } from "@/components/widgets/priority-tasks";
import { RemindersWidget } from "@/components/widgets/reminders";
import { TeamStatusWidget } from "@/components/widgets/team-status";
import { format } from "date-fns";

export default function DashboardPage() {
  const today = format(new Date(), "EEEE, MMMM d");

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-semibold text-neutral-100">Good morning, Joe</h1>
        <p className="text-sm text-neutral-500">{today}</p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Open Tasks", value: "18", sub: "4 urgent" },
          { label: "Active Projects", value: "3", sub: "1 near budget" },
          { label: "Unread Emails", value: "12", sub: "2 flagged" },
          { label: "Cash Balance", value: "£142.8k", sub: "+8% MoM" },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3"
          >
            <p className="text-[11px] text-neutral-500">{kpi.label}</p>
            <p className="font-mono text-2xl font-bold text-neutral-100">{kpi.value}</p>
            <p className="text-[11px] text-neutral-400">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Widget grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <EmailSummaryWidget />
        <TodaysScheduleWidget />
        <FinanceSnapshotWidget />
        <ActiveProjectsWidget />
        <PriorityTasksWidget />
        <div className="space-y-4">
          <RemindersWidget />
          <TeamStatusWidget />
        </div>
      </div>
    </div>
  );
}
