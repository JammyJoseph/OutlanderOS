"use client";

import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, Mail, Calendar, TableProperties, Settings } from "lucide-react";

const steps = [
  {
    id: "primary",
    label: "Connect primary Google account",
    description: "q@outlandermag.com — Gmail, Calendar, Drive",
    icon: Mail,
    connectLabel: "primary",
  },
  {
    id: "billing",
    label: "Connect billing Google account",
    description: "billing@outlandermag.com — Gmail, invoices, finance emails",
    icon: Calendar,
    connectLabel: "billing",
  },
  {
    id: "sheets",
    label: "Link billing tracker spreadsheet",
    description: "Connect your 2026 Master Billing Tracker Google Sheet",
    icon: TableProperties,
    connectLabel: null,
  },
];

export default function DashboardPage() {
  const router = useRouter();

  return (
    <div className="flex min-h-full flex-col items-center justify-center py-16 px-4">
      <div className="w-full max-w-xl">
        {/* Logo / heading */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-white">
            Welcome to <span className="text-[#D4A853]">OutlanderOS</span>
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            Connect your accounts to get started. Once set up, your dashboard will show live data.
          </p>
        </div>

        {/* Setup steps */}
        <div className="space-y-3">
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <div
                key={step.id}
                className="flex items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-4"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800">
                  <span className="text-sm font-bold text-zinc-400">{i + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-100">{step.label}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{step.description}</p>
                </div>
                <div className="shrink-0">
                  {step.connectLabel ? (
                    <button
                      onClick={() => router.push(`/api/google/connect?label=${step.connectLabel}`)}
                      className="rounded-lg bg-[#D4A853] px-3 py-1.5 text-xs font-medium text-zinc-900 hover:bg-[#C49843] transition-colors"
                    >
                      Connect
                    </button>
                  ) : (
                    <button
                      onClick={() => router.push("/settings")}
                      className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
                    >
                      Go to Settings
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Helper links */}
        <div className="mt-8 flex items-center justify-center gap-6 text-xs text-zinc-600">
          <button
            onClick={() => router.push("/settings")}
            className="flex items-center gap-1.5 hover:text-zinc-400 transition-colors"
          >
            <Settings className="h-3.5 w-3.5" />
            Settings
          </button>
          <span>·</span>
          <span>All data is read-only — OutlanderOS never modifies your accounts</span>
        </div>
      </div>
    </div>
  );
}
