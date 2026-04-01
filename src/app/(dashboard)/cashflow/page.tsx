"use client";

import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, ComposedChart, Line,
} from "recharts";
import { TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight } from "lucide-react";

const tooltipStyle = {
  contentStyle: {
    background: "#18181b",
    border: "1px solid #27272a",
    borderRadius: "6px",
    fontSize: "12px",
    color: "#f4f4f5",
  },
};

// Forward-looking cash flow: confirmed incoming revenue vs planned production costs
const FORWARD_CASHFLOW = [
  { month: "Apr '26", incoming: 128300, costs: 56000, net: 72300, committed: true },
  { month: "May '26", incoming: 95000, costs: 48000, net: 47000, committed: true },
  { month: "Jun '26", incoming: 110000, costs: 52000, net: 58000, committed: false },
  { month: "Jul '26", incoming: 85000, costs: 40000, net: 45000, committed: false },
  { month: "Aug '26", incoming: 60000, costs: 28000, net: 32000, committed: false },
  { month: "Sep '26", incoming: 140000, costs: 65000, net: 75000, committed: false },
];

const CASH_POSITION = [
  { month: "Jan '26", balance: 118000 },
  { month: "Feb '26", balance: 142000 },
  { month: "Mar '26", balance: 198000 },
  { month: "Apr '26 (proj)", balance: 198000 + 72300 },
  { month: "May '26 (proj)", balance: 198000 + 72300 + 47000 },
  { month: "Jun '26 (proj)", balance: 198000 + 72300 + 47000 + 58000 },
];

const COMMITTED_COSTS = [
  { category: "Freelancers (confirmed)", amount: 18400, month: "Apr '26" },
  { category: "Studio Hire — Palace shoot", amount: 4200, month: "Apr '26" },
  { category: "Nike SB Dunk production", amount: 12000, month: "Apr '26" },
  { category: "TNF Black Series travel", amount: 3800, month: "Apr '26" },
  { category: "Software subscriptions", amount: 2100, month: "Apr '26" },
  { category: "Freelancers (projected)", amount: 16000, month: "May '26" },
  { category: "Carhartt WIP campaign spend", amount: 8500, month: "May '26" },
];

export default function CashFlowPage() {
  const currentBalance = 198000;
  const confirmedIncoming = FORWARD_CASHFLOW.filter(m => m.committed).reduce((s, m) => s + m.incoming, 0);
  const committedCosts = COMMITTED_COSTS.filter(c => c.month === "Apr '26").reduce((s, c) => s + c.amount, 0);
  const projectedNetThisMonth = confirmedIncoming - committedCosts;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">Forward Cash Flow</h1>
        <p className="text-xs text-zinc-500">Incoming revenue vs upfront production costs — 6 month view</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Current Cash Position", value: `£${(currentBalance / 1000).toFixed(0)}k`, up: true, delta: "as of Apr 1, 2026" },
          { label: "Confirmed Incoming (Apr)", value: `£${(confirmedIncoming / 1000).toFixed(0)}k`, up: true, delta: "contracted & invoiced" },
          { label: "Committed Costs (Apr)", value: `£${(committedCosts / 1000).toFixed(0)}k`, up: false, delta: "confirmed outflows" },
          { label: "Projected Net (Apr)", value: `£${(projectedNetThisMonth / 1000).toFixed(0)}k`, up: true, delta: "after April costs" },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
            <p className="text-[11px] uppercase tracking-wider text-zinc-500">{kpi.label}</p>
            <p className="mt-1 font-mono text-2xl font-bold text-zinc-100">{kpi.value}</p>
            <div className="mt-1 flex items-center gap-1">
              {kpi.up ? <TrendingUp className="h-3 w-3 text-emerald-400" /> : <TrendingDown className="h-3 w-3 text-amber-400" />}
              <span className={`text-[11px] ${kpi.up ? "text-emerald-400" : "text-amber-400"}`}>{kpi.delta}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Forward Cash Flow Chart */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Incoming Revenue vs Production Costs — 6 Month Forecast</h2>
          <div className="flex items-center gap-4 text-[11px] text-zinc-500">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-[#D4A853]" /> Confirmed</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-[#D4A853]/40" /> Projected</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={FORWARD_CASHFLOW} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis dataKey="month" tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`} />
            <Tooltip {...tooltipStyle} formatter={(v) => [`£${Number(v).toLocaleString()}`, ""]} />
            <Bar dataKey="incoming" name="Incoming Revenue" fill="#D4A853" radius={[3, 3, 0, 0]} opacity={0.9} />
            <Bar dataKey="costs" name="Production Costs" fill="#ef4444" radius={[3, 3, 0, 0]} opacity={0.7} />
            <Line type="monotone" dataKey="net" name="Net" stroke="#E8C17A" strokeWidth={2} dot={{ fill: "#E8C17A", r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Projected Cash Position */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">Projected Cash Position</h2>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={CASH_POSITION} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="cashPosGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#D4A853" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#D4A853" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis dataKey="month" tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`} />
            <Tooltip {...tooltipStyle} formatter={(v) => [`£${Number(v).toLocaleString()}`, "Cash Balance"]} />
            <ReferenceLine y={0} stroke="#52525b" />
            <Area type="monotone" dataKey="balance" stroke="#D4A853" strokeWidth={2} fill="url(#cashPosGrad)" dot={{ fill: "#D4A853", r: 3 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Committed Costs Breakdown */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">Committed Outflows</h2>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-zinc-800 text-left text-[11px] text-zinc-600">
              <th className="pb-2 font-medium">Description</th>
              <th className="pb-2 font-medium">Month</th>
              <th className="pb-2 font-medium text-right">Amount</th>
              <th className="pb-2 font-medium text-right">Direction</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/40">
            {COMMITTED_COSTS.map((cost, i) => (
              <tr key={i} className="hover:bg-zinc-800/30">
                <td className="py-2 text-zinc-200">{cost.category}</td>
                <td className="py-2 font-mono text-[11px] text-zinc-500">{cost.month}</td>
                <td className="py-2 text-right font-mono font-semibold text-red-400">£{cost.amount.toLocaleString()}</td>
                <td className="py-2 text-right">
                  <ArrowDownRight className="ml-auto h-4 w-4 text-red-400/60" />
                </td>
              </tr>
            ))}
            {FORWARD_CASHFLOW.filter(m => m.committed).map((m, i) => (
              <tr key={`in-${i}`} className="hover:bg-zinc-800/30 bg-emerald-950/5">
                <td className="py-2 text-zinc-200">Confirmed incoming — {m.month}</td>
                <td className="py-2 font-mono text-[11px] text-zinc-500">{m.month}</td>
                <td className="py-2 text-right font-mono font-semibold text-emerald-400">£{m.incoming.toLocaleString()}</td>
                <td className="py-2 text-right">
                  <ArrowUpRight className="ml-auto h-4 w-4 text-emerald-400/60" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
