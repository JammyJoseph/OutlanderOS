"use client";

import { useState } from "react";
import {
  billingEntries,
  monthlyRevenue,
  expenseBreakdown,
  getOutstandingInvoices,
} from "@/lib/mock-data";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { TrendingUp, TrendingDown, FileText, AlertCircle, CheckCircle2, Clock } from "lucide-react";

type Period = "monthly" | "quarterly" | "yearly";

const tooltipStyle = {
  contentStyle: {
    background: "#18181b",
    border: "1px solid #27272a",
    borderRadius: "6px",
    fontSize: "12px",
    color: "#f4f4f5",
  },
};

function fmt(n: number) {
  if (n >= 1000000) return `£${(n / 1000000).toFixed(2)}m`;
  if (n >= 1000) return `£${(n / 1000).toFixed(0)}k`;
  return `£${n.toLocaleString()}`;
}

const QUARTERLY = [
  { label: "Q2 '25", revenue: 71500 + 75200 + 82800, expenses: 100000 },
  { label: "Q3 '25", revenue: 64000 + 40500 + 104200, expenses: 91000 },
  { label: "Q4 '25", revenue: 101500 + 104000 + 60000, expenses: 116000 },
  { label: "Q1 '26", revenue: 110500 + 75700 + 128300, expenses: 137000 },
];

const YEARLY = [
  { label: "FY 2023", revenue: 520000, expenses: 228000 },
  { label: "FY 2024", revenue: 648000, expenses: 284000 },
  { label: "FY 2025", revenue: 762000, expenses: 334000 },
];

const MONTHLY_DATA = monthlyRevenue.map((m, i) => {
  const expenses = Math.round(m.total * (0.38 + (i % 3) * 0.02));
  return { label: m.month, revenue: m.total, expenses, cashFlow: m.total - expenses };
});

const statusConfig: Record<string, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  paid: { icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10", label: "Paid" },
  pending: { icon: Clock, color: "text-amber-400", bg: "bg-amber-500/10", label: "Pending" },
  overdue: { icon: AlertCircle, color: "text-red-400", bg: "bg-red-500/10", label: "Overdue" },
  draft: { icon: FileText, color: "text-zinc-400", bg: "bg-zinc-500/10", label: "Draft" },
};

export default function FinancePage() {
  const [period, setPeriod] = useState<Period>("monthly");
  const [invoiceFilter, setInvoiceFilter] = useState<string>("all");

  const outstanding = getOutstandingInvoices();
  const paidYTD = billingEntries.filter(b => b.paymentStatus === "paid").reduce((s, b) => s + b.amountInvoiced, 0);
  const pendingCount = billingEntries.filter(b => b.paymentStatus === "pending").length;
  const overdueCount = billingEntries.filter(b => b.paymentStatus === "overdue").length;

  const chartData =
    period === "monthly" ? MONTHLY_DATA :
    period === "quarterly" ? QUARTERLY.map(q => ({ ...q, cashFlow: q.revenue - q.expenses })) :
    YEARLY.map(y => ({ ...y, cashFlow: y.revenue - y.expenses }));

  const totalRevenue = chartData.reduce((s, d) => s + d.revenue, 0);
  const totalExpenses = chartData.reduce((s, d) => s + d.expenses, 0);
  const netProfit = totalRevenue - totalExpenses;
  const netMargin = Math.round((netProfit / totalRevenue) * 100);

  const filteredInvoices = invoiceFilter === "all"
    ? billingEntries
    : billingEntries.filter(b => b.paymentStatus === invoiceFilter);

  const kpis = [
    { label: "Revenue Paid YTD", value: fmt(paidYTD), up: true, delta: "+18% vs prior period" },
    { label: "Outstanding", value: fmt(outstanding), up: false, delta: `${pendingCount + overdueCount} invoices` },
    { label: "Net Profit", value: fmt(netProfit), up: true, delta: `${netMargin}% margin` },
    { label: "Overdue Invoices", value: `${overdueCount}`, up: false, delta: overdueCount > 0 ? "Action required" : "All clear", alert: overdueCount > 0 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Finance</h1>
          <p className="text-xs text-zinc-500">Outlander Magazine · 2026 Master Billing Tracker</p>
        </div>
        <div className="flex gap-1 rounded-md border border-zinc-800 bg-zinc-900 p-0.5">
          {(["monthly", "quarterly", "yearly"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded px-3 py-1 text-xs font-medium capitalize transition-colors ${
                period === p ? "bg-[#D4A853] text-black" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className={`rounded-lg border bg-zinc-900 px-4 py-3 ${kpi.alert ? "border-red-900/50" : "border-zinc-800"}`}>
            <p className="text-[11px] uppercase tracking-wider text-zinc-500">{kpi.label}</p>
            <p className={`mt-1 font-mono text-2xl font-bold ${kpi.alert ? "text-red-400" : "text-zinc-100"}`}>{kpi.value}</p>
            <div className="mt-1 flex items-center gap-1">
              {kpi.up ? <TrendingUp className="h-3 w-3 text-emerald-400" /> : <TrendingDown className="h-3 w-3 text-amber-400" />}
              <span className={`text-[11px] ${kpi.up ? "text-emerald-400" : kpi.alert ? "text-red-400" : "text-amber-400"}`}>{kpi.delta}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Revenue vs Expenses */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5 lg:col-span-2">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">Revenue vs Expenses</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="label" tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`} />
              <Tooltip {...tooltipStyle} formatter={(v) => [`£${Number(v).toLocaleString()}`, ""]} />
              <Bar dataKey="revenue" name="Revenue" fill="#D4A853" radius={[3, 3, 0, 0]} />
              <Bar dataKey="expenses" name="Expenses" fill="#3f3f46" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Expense Breakdown */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">Expense Breakdown — MTD</h2>
          <div className="space-y-3">
            {expenseBreakdown.map((e) => (
              <div key={e.category}>
                <div className="mb-1 flex justify-between">
                  <span className="text-[11px] text-zinc-400">{e.category}</span>
                  <span className="font-mono text-[11px] text-zinc-200">£{e.amount.toLocaleString()}</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-[#D4A853]"
                    style={{ width: `${(e.amount / expenseBreakdown[0].amount) * 100}%` }}
                  />
                </div>
                <span className="text-[10px] text-zinc-600">{e.percentOfRevenue}% of revenue</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Cash Flow */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">Cash Flow — Inflows vs Outflows</h2>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#D4A853" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#D4A853" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis dataKey="label" tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`} />
            <Tooltip {...tooltipStyle} formatter={(v) => [`£${Number(v).toLocaleString()}`, ""]} />
            <ReferenceLine y={0} stroke="#52525b" />
            <Area type="monotone" dataKey="revenue" name="Inflows" stroke="#D4A853" strokeWidth={2} fill="url(#revGrad)" dot={false} />
            <Area type="monotone" dataKey="expenses" name="Outflows" stroke="#ef4444" strokeWidth={1.5} fill="url(#expGrad)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* P&L Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Gross Revenue", value: fmt(totalRevenue), color: "text-[#D4A853]" },
          { label: "Total Expenses", value: fmt(totalExpenses), color: "text-red-400" },
          { label: "Net Profit", value: fmt(netProfit), color: netMargin > 30 ? "text-emerald-400" : "text-amber-400", sub: `${netMargin}% margin` },
        ].map((item) => (
          <div key={item.label} className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-center">
            <p className="text-[11px] uppercase tracking-wider text-zinc-500">{item.label}</p>
            <p className={`mt-1 font-mono text-2xl font-bold ${item.color}`}>{item.value}</p>
            {item.sub && <p className="text-[11px] text-zinc-500">{item.sub}</p>}
          </div>
        ))}
      </div>

      {/* Invoice Tracker */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Invoice Tracker — 2026 Master Billing
          </h2>
          <div className="flex gap-1 rounded-md border border-zinc-800 bg-zinc-950 p-0.5">
            {["all", "paid", "pending", "overdue", "draft"].map((f) => (
              <button
                key={f}
                onClick={() => setInvoiceFilter(f)}
                className={`rounded px-2.5 py-0.5 text-[11px] font-medium capitalize transition-colors ${
                  invoiceFilter === f ? "bg-[#D4A853] text-black" : "text-zinc-500 hover:text-zinc-200"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-[11px] text-zinc-600">
                <th className="pb-2 font-medium">Invoice #</th>
                <th className="pb-2 font-medium">Client</th>
                <th className="pb-2 font-medium">Campaign</th>
                <th className="pb-2 font-medium">Category</th>
                <th className="pb-2 font-medium text-right">Amount</th>
                <th className="pb-2 font-medium">Invoice Date</th>
                <th className="pb-2 font-medium">Due Date</th>
                <th className="pb-2 font-medium text-right">Days Out</th>
                <th className="pb-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/40">
              {filteredInvoices.map((inv) => {
                const cfg = statusConfig[inv.paymentStatus];
                const Icon = cfg.icon;
                return (
                  <tr key={inv.id} className={`hover:bg-zinc-800/30 ${inv.paymentStatus === "overdue" ? "bg-red-950/10" : ""}`}>
                    <td className="py-2 font-mono text-[11px] text-zinc-500">{inv.invoiceNumber}</td>
                    <td className="py-2 font-medium text-zinc-200">{inv.clientName}</td>
                    <td className="py-2 max-w-[180px] truncate text-zinc-400">{inv.campaignName}</td>
                    <td className="py-2 text-zinc-500">{inv.revenueCategory}</td>
                    <td className="py-2 text-right font-mono font-semibold text-zinc-100">£{inv.amountInvoiced.toLocaleString()}</td>
                    <td className="py-2 font-mono text-[11px] text-zinc-500">{inv.invoiceDate}</td>
                    <td className={`py-2 font-mono text-[11px] ${inv.paymentStatus === "overdue" ? "text-red-400" : "text-zinc-500"}`}>{inv.dueDate}</td>
                    <td className="py-2 text-right font-mono text-[11px] text-zinc-500">
                      {inv.daysOutstanding !== null ? `${inv.daysOutstanding}d` : "—"}
                    </td>
                    <td className="py-2">
                      <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${cfg.bg} ${cfg.color}`}>
                        <Icon className="h-2.5 w-2.5" />
                        {cfg.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
