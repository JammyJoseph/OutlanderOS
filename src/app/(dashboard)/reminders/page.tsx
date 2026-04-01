"use client";

import { useState } from "react";
import { AlertCircle, Calendar, Clock, CheckCircle2, Plus, Bell } from "lucide-react";

interface Reminder {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  category: "payroll" | "vat" | "companies-house" | "invoice" | "brand-email" | "other";
  priority: "high" | "medium" | "low";
  done: boolean;
}

const categoryConfig: Record<string, { label: string; color: string; bg: string }> = {
  payroll: { label: "Payroll", color: "text-purple-400", bg: "bg-purple-500/10" },
  vat: { label: "VAT", color: "text-red-400", bg: "bg-red-500/10" },
  "companies-house": { label: "Companies House", color: "text-blue-400", bg: "bg-blue-500/10" },
  invoice: { label: "Invoice", color: "text-amber-400", bg: "bg-amber-500/10" },
  "brand-email": { label: "Brand Email", color: "text-emerald-400", bg: "bg-emerald-500/10" },
  other: { label: "Other", color: "text-zinc-400", bg: "bg-zinc-500/10" },
};

const priorityDot: Record<string, string> = {
  high: "bg-red-400",
  medium: "bg-amber-400",
  low: "bg-zinc-500",
};

const MOCK_REMINDERS: Reminder[] = [
  { id: "r1", title: "Payroll — April 2026", description: "Process monthly payroll via Xero. Ensure all timesheets submitted.", dueDate: "2026-04-25", category: "payroll", priority: "high", done: false },
  { id: "r2", title: "VAT Return — Q1 2026", description: "Submit Q1 VAT return to HMRC. Quarter: Jan–Mar 2026. Deadline: 7 May.", dueDate: "2026-05-07", category: "vat", priority: "high", done: false },
  { id: "r3", title: "Companies House — Confirmation Statement", description: "Annual confirmation statement due. Check registered address and director details.", dueDate: "2026-06-15", category: "companies-house", priority: "medium", done: false },
  { id: "r4", title: "Chase BAPE — Tokyo Collection Invoice", description: "INV-2026-013 overdue. Chased x2. Call billing contact.", dueDate: "2026-04-03", category: "invoice", priority: "high", done: false },
  { id: "r5", title: "Chase Palace — Tri-Ferg Invoice", description: "INV-2026-014 overdue. Email and follow up with Slack.", dueDate: "2026-04-03", category: "invoice", priority: "high", done: false },
  { id: "r6", title: "Follow up — Nike SB Dunk contract sign-off", description: "Contract was sent on 30 Mar. No reply from brand team yet.", dueDate: "2026-04-04", category: "brand-email", priority: "high", done: false },
  { id: "r7", title: "New Balance — 990v6 campaign delivery", description: "Final assets due to NB by this date per contract.", dueDate: "2026-04-10", category: "brand-email", priority: "medium", done: false },
  { id: "r8", title: "Payroll — May 2026", description: "Set reminder for next payroll cycle.", dueDate: "2026-05-25", category: "payroll", priority: "medium", done: false },
  { id: "r9", title: "Year-end accounts — FY 2025", description: "Submit accounts to HMRC. Accountant deadline: 30 Jun.", dueDate: "2026-06-30", category: "companies-house", priority: "medium", done: false },
  { id: "r10", title: "Corporation Tax — FY 2025", description: "Payment due 9 months after year end.", dueDate: "2026-09-30", category: "vat", priority: "low", done: false },
];

export default function RemindersPage() {
  const [reminders, setReminders] = useState<Reminder[]>(MOCK_REMINDERS);
  const [filter, setFilter] = useState<string>("all");

  function toggle(id: string) {
    setReminders(prev => prev.map(r => r.id === id ? { ...r, done: !r.done } : r));
  }

  const today = new Date("2026-04-01");
  const filtered = filter === "all" ? reminders : reminders.filter(r => r.category === filter);
  const overdue = reminders.filter(r => !r.done && new Date(r.dueDate) < today);
  const upcoming7 = reminders.filter(r => !r.done && new Date(r.dueDate) >= today && new Date(r.dueDate) <= new Date("2026-04-08"));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Reminders & Deadlines</h1>
          <p className="text-xs text-zinc-500">Payroll, VAT, Companies House, invoice follow-ups, brand emails</p>
        </div>
        <button className="flex items-center gap-1.5 rounded-md bg-[#D4A853] px-3 py-1.5 text-xs font-semibold text-black hover:bg-[#c49a47]">
          <Plus className="h-3.5 w-3.5" /> Add Reminder
        </button>
      </div>

      {/* Alert strip */}
      {(overdue.length > 0 || upcoming7.length > 0) && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {overdue.length > 0 && (
            <div className="flex items-start gap-3 rounded-lg border border-red-900/40 bg-red-950/20 p-4">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
              <div>
                <p className="text-sm font-semibold text-red-300">{overdue.length} overdue</p>
                <p className="text-xs text-red-400/70">{overdue.map(r => r.title).join(" · ")}</p>
              </div>
            </div>
          )}
          {upcoming7.length > 0 && (
            <div className="flex items-start gap-3 rounded-lg border border-amber-900/40 bg-amber-950/20 p-4">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              <div>
                <p className="text-sm font-semibold text-amber-300">{upcoming7.length} due this week</p>
                <p className="text-xs text-amber-400/70">{upcoming7.map(r => r.title).join(" · ")}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-1.5">
        {["all", "payroll", "vat", "companies-house", "invoice", "brand-email"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors ${
              filter === f ? "bg-[#D4A853] text-black" : "border border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
            }`}
          >
            {f.replace("-", " ")}
          </button>
        ))}
      </div>

      {/* Reminder list */}
      <div className="space-y-2">
        {filtered.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()).map((r) => {
          const cfg = categoryConfig[r.category];
          const isOverdue = !r.done && new Date(r.dueDate) < today;
          return (
            <div
              key={r.id}
              className={`flex items-start gap-3 rounded-lg border bg-zinc-900 p-4 transition-opacity ${
                r.done ? "border-zinc-800/50 opacity-40" : isOverdue ? "border-red-900/50" : "border-zinc-800"
              }`}
            >
              <button
                onClick={() => toggle(r.id)}
                className="mt-0.5 shrink-0"
              >
                {r.done ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                ) : (
                  <div className="h-4 w-4 rounded-full border-2 border-zinc-600 hover:border-[#D4A853]" />
                )}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-sm font-medium ${r.done ? "line-through text-zinc-500" : "text-zinc-100"}`}>{r.title}</span>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                  <span className={`h-1.5 w-1.5 rounded-full ${priorityDot[r.priority]}`} />
                </div>
                <p className="mt-0.5 text-xs text-zinc-500">{r.description}</p>
              </div>
              <div className="shrink-0 text-right">
                <div className={`flex items-center gap-1 text-[11px] font-mono ${isOverdue ? "text-red-400" : "text-zinc-500"}`}>
                  <Calendar className="h-3 w-3" />
                  {r.dueDate}
                </div>
                {isOverdue && <span className="text-[10px] text-red-500">OVERDUE</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
