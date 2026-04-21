"use client";

import { useState } from "react";
import { BarChart2, FileText, Users, Send, Download, Loader2, CheckCircle2 } from "lucide-react";

type ReportType = "monthly" | "quarterly" | "client";

const REPORTS: {
  type: ReportType;
  title: string;
  description: string;
  Icon: React.ElementType;
  color: string;
  bg: string;
}[] = [
  {
    type: "monthly",
    title: "Monthly Report",
    description: "Revenue, expenses, and deal pipeline summary for the current month.",
    Icon: BarChart2,
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  {
    type: "quarterly",
    title: "Quarterly Report",
    description: "Quarterly performance: bookings vs target, margin analysis, YTD progress.",
    Icon: FileText,
    color: "text-purple-600",
    bg: "bg-purple-50",
  },
  {
    type: "client",
    title: "Client Report",
    description: "Per-client breakdown: spend, campaigns, outstanding invoices, and activity.",
    Icon: Users,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
  },
];

export default function FinanceReportsPage() {
  const [generating, setGenerating] = useState<ReportType | null>(null);
  const [sent, setSent] = useState<ReportType | null>(null);

  async function handleGenerate(type: ReportType) {
    setGenerating(type);
    await new Promise((r) => setTimeout(r, 1500));
    setGenerating(null);
  }

  async function handleSendTelegram(type: ReportType) {
    setSent(type);
    await new Promise((r) => setTimeout(r, 800));
    setTimeout(() => setSent(null), 2000);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Finance Reports</h1>
          <p className="text-xs text-gray-500">Generate and distribute financial reports</p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="grid gap-4 md:grid-cols-3">
          {REPORTS.map(({ type, title, description, Icon, color, bg }) => {
            const isGenerating = generating === type;
            const isSent = sent === type;
            return (
              <div key={type} className="card-apple flex flex-col gap-4 p-5">
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${bg}`}>
                  <Icon className={`h-6 w-6 ${color}`} />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
                  <p className="mt-1 text-xs text-gray-500">{description}</p>
                </div>
                <div className="mt-auto flex flex-col gap-2">
                  <button
                    onClick={() => handleGenerate(type)}
                    disabled={isGenerating}
                    className="flex items-center justify-center gap-1.5 rounded-lg bg-[#D4A853] px-3 py-2 text-xs font-semibold text-white hover:bg-[#C49843] disabled:opacity-60"
                  >
                    {isGenerating ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                    {isGenerating ? "Generating…" : "Generate Report"}
                  </button>
                  <button
                    onClick={() => handleSendTelegram(type)}
                    disabled={isSent}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-60"
                  >
                    {isSent ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                    {isSent ? "Sent!" : "Send to Telegram"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
