"use client";

import {
  monthlyRevenue,
  clientRevenue,
  activeProjects,
  getTotalRevenueYTD,
  getRevenueThisMonth,
  getOutstandingInvoices,
  getAvgProjectMargin,
  getAvgEngagementRate,
  getRevenueByCategory,
  getCurrentMonthTarget,
  billingEntries,
} from "@/lib/mock-data";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  BarChart,
  Bar,
} from "recharts";
import { TrendingUp, TrendingDown, AlertCircle, ChevronUp, ChevronDown } from "lucide-react";
import { useState } from "react";

const DONUT_COLORS = ["#D4A853", "#B8860B", "#8B6914", "#C49A47", "#E8C17A"];

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
  return `£${n}`;
}

const AREA_COLORS = {
  paidPartnerships: "#D4A853",
  productionFees: "#E8C17A",
  brandCollaborations: "#B8860B",
  editorial: "#8B6914",
  events: "#C49A47",
};

type SortKey = "totalRevenue" | "numCampaigns" | "avgMargin";

export default function DashboardPage() {
  const totalYTD = getTotalRevenueYTD();
  const thisMonth = getRevenueThisMonth();
  const outstanding = getOutstandingInvoices();
  const avgMargin = getAvgProjectMargin();
  const engagementRate = getAvgEngagementRate();
  const donutData = getRevenueByCategory();
  const donutTotal = donutData.reduce((s, d) => s + d.value, 0);
  const { actual: monthActual, target: monthTarget } = getCurrentMonthTarget();
  const monthProgress = Math.min(100, Math.round((monthActual / monthTarget) * 100));

  const [sortKey, setSortKey] = useState<SortKey>("totalRevenue");
  const [sortAsc, setSortAsc] = useState(false);

  const sortedClients = [...clientRevenue].sort((a, b) => {
    const v = sortAsc ? 1 : -1;
    return (a[sortKey] - b[sortKey]) * v;
  });

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  }

  const overdueInvoices = billingEntries.filter(b => b.paymentStatus === "overdue");

  const kpis = [
    {
      label: "Revenue YTD",
      value: fmt(totalYTD),
      sub: "Jan–Mar 2026",
      up: true,
      delta: "+18% vs prior period",
    },
    {
      label: "Revenue This Month",
      value: fmt(thisMonth),
      sub: "March 2026",
      up: true,
      delta: "+69% vs Feb",
    },
    {
      label: "Avg Project Margin",
      value: `${avgMargin}%`,
      sub: "across active projects",
      up: avgMargin > 20,
      delta: avgMargin > 20 ? "Healthy" : "Watch margin",
    },
    {
      label: "Outstanding Invoices",
      value: fmt(outstanding),
      sub: `${billingEntries.filter(b => b.paymentStatus === "pending" || b.paymentStatus === "overdue").length} invoices`,
      up: false,
      delta: `${overdueInvoices.length} overdue`,
    },
    {
      label: "IG Engagement Rate",
      value: `${engagementRate}%`,
      sub: "@outlandermagazine",
      up: engagementRate > 5,
      delta: "Mar 2026 avg",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Revenue Intelligence</h1>
          <p className="text-xs text-zinc-500">Outlander Magazine · YTD 2026</p>
        </div>
        {overdueInvoices.length > 0 && (
          <div className="flex items-center gap-2 rounded-md border border-red-900/50 bg-red-950/40 px-3 py-1.5">
            <AlertCircle className="h-3.5 w-3.5 text-red-400" />
            <span className="text-xs text-red-400">{overdueInvoices.length} overdue invoice{overdueInvoices.length > 1 ? "s" : ""}</span>
          </div>
        )}
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
            <p className="text-[11px] uppercase tracking-wider text-zinc-500">{kpi.label}</p>
            <p className="mt-1 font-mono text-2xl font-bold text-zinc-100">{kpi.value}</p>
            <div className="mt-1 flex items-center gap-1">
              {kpi.up ? (
                <TrendingUp className="h-3 w-3 text-emerald-400" />
              ) : (
                <TrendingDown className="h-3 w-3 text-amber-400" />
              )}
              <span className={`text-[11px] ${kpi.up ? "text-emerald-400" : "text-amber-400"}`}>
                {kpi.delta}
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-zinc-600">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Monthly Target Progress */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-5 py-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">March 2026 — Monthly Target</span>
          <span className="font-mono text-sm font-bold text-zinc-100">
            {fmt(monthActual)} <span className="text-zinc-600">/ {fmt(monthTarget)}</span>
          </span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full rounded-full bg-[#D4A853] transition-all"
            style={{ width: `${monthProgress}%` }}
          />
        </div>
        <div className="mt-1.5 flex justify-between">
          <span className="text-[11px] text-zinc-600">£0</span>
          <span className={`text-[11px] font-mono font-semibold ${monthProgress >= 100 ? "text-emerald-400" : "text-[#D4A853]"}`}>
            {monthProgress}% of target
          </span>
          <span className="text-[11px] text-zinc-600">{fmt(monthTarget)}</span>
        </div>
      </div>

      {/* Hero Row: Donut + Trend */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* Revenue by Source — Donut */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5 lg:col-span-2">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">Revenue by Source — YTD 2026</h2>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={donutData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={3}
                dataKey="value"
              >
                {donutData.map((_, i) => (
                  <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                {...tooltipStyle}
                formatter={(v) => [`£${Number(v).toLocaleString()}`, ""]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 space-y-1.5">
            {donutData.map((d, i) => (
              <div key={d.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: DONUT_COLORS[i] }} />
                  <span className="text-[11px] text-zinc-400">{d.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[11px] text-zinc-300">£{d.value.toLocaleString()}</span>
                  <span className="w-8 text-right font-mono text-[11px] text-zinc-500">
                    {Math.round((d.value / donutTotal) * 100)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Revenue Trend — Area Chart */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5 lg:col-span-3">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">Revenue Trend — 12 Months</h2>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={monthlyRevenue} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                {Object.entries(AREA_COLORS).map(([key, color]) => (
                  <linearGradient key={key} id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={color} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="month" tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`} />
              <Tooltip {...tooltipStyle} formatter={(v) => [`£${Number(v).toLocaleString()}`, ""]} />
              <Area type="monotone" dataKey="paidPartnerships" name="Paid Partnerships" stroke={AREA_COLORS.paidPartnerships} strokeWidth={1.5} fill={`url(#grad-paidPartnerships)`} dot={false} stackId="1" />
              <Area type="monotone" dataKey="brandCollaborations" name="Brand Collabs" stroke={AREA_COLORS.brandCollaborations} strokeWidth={1.5} fill={`url(#grad-brandCollaborations)`} dot={false} stackId="1" />
              <Area type="monotone" dataKey="productionFees" name="Production" stroke={AREA_COLORS.productionFees} strokeWidth={1.5} fill={`url(#grad-productionFees)`} dot={false} stackId="1" />
              <Area type="monotone" dataKey="editorial" name="Editorial" stroke={AREA_COLORS.editorial} strokeWidth={1.5} fill={`url(#grad-editorial)`} dot={false} stackId="1" />
              <Area type="monotone" dataKey="events" name="Events" stroke={AREA_COLORS.events} strokeWidth={1.5} fill={`url(#grad-events)`} dot={false} stackId="1" />
              <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: "10px", color: "#71717a" }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom Row: Clients + Active Projects */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Top Clients — Bar Chart + Table */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">Top Clients by Revenue — YTD 2026</h2>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={sortedClients} layout="vertical" margin={{ left: 0, right: 16 }}>
              <XAxis type="number" tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="clientName" tick={{ fill: "#a1a1aa", fontSize: 10 }} axisLine={false} tickLine={false} width={80} />
              <Tooltip {...tooltipStyle} formatter={(v) => [`£${Number(v).toLocaleString()}`, "Revenue"]} />
              <Bar dataKey="totalRevenue" fill="#D4A853" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <table className="mt-3 w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-[11px] text-zinc-600">
                <th className="pb-1.5 font-medium">Client</th>
                <th className="cursor-pointer pb-1.5 font-medium text-right hover:text-zinc-300" onClick={() => handleSort("totalRevenue")}>
                  <span className="flex items-center justify-end gap-0.5">Revenue {sortKey === "totalRevenue" && (sortAsc ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}</span>
                </th>
                <th className="cursor-pointer pb-1.5 font-medium text-right hover:text-zinc-300" onClick={() => handleSort("numCampaigns")}>
                  <span className="flex items-center justify-end gap-0.5">Campaigns {sortKey === "numCampaigns" && (sortAsc ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}</span>
                </th>
                <th className="cursor-pointer pb-1.5 font-medium text-right hover:text-zinc-300" onClick={() => handleSort("avgMargin")}>
                  <span className="flex items-center justify-end gap-0.5">Avg Margin {sortKey === "avgMargin" && (sortAsc ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/40">
              {sortedClients.map((c) => (
                <tr key={c.clientName} className="hover:bg-zinc-800/30">
                  <td className="py-1.5 text-zinc-200">{c.clientName}</td>
                  <td className="py-1.5 text-right font-mono text-zinc-100">£{c.totalRevenue.toLocaleString()}</td>
                  <td className="py-1.5 text-right text-zinc-400">{c.numCampaigns}</td>
                  <td className="py-1.5 text-right">
                    <span className={`font-mono ${c.avgMargin >= 35 ? "text-emerald-400" : c.avgMargin >= 25 ? "text-[#D4A853]" : "text-red-400"}`}>
                      {c.avgMargin}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Active Projects with Margins */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">Active Projects — Margins</h2>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-[11px] text-zinc-600">
                <th className="pb-1.5 font-medium">Client · Project</th>
                <th className="pb-1.5 font-medium text-right">Budget</th>
                <th className="pb-1.5 font-medium text-right">Actual</th>
                <th className="pb-1.5 font-medium text-right">Margin</th>
                <th className="pb-1.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/40">
              {activeProjects.map((p) => {
                const marginColor =
                  p.margin >= 20 ? "text-emerald-400" :
                  p.margin >= 10 ? "text-[#D4A853]" : "text-red-400";
                const statusColor =
                  p.status === "active" ? "bg-emerald-500/15 text-emerald-400" :
                  p.status === "in-review" ? "bg-amber-500/15 text-amber-400" :
                  p.status === "on-hold" ? "bg-red-500/15 text-red-400" :
                  "bg-zinc-500/15 text-zinc-400";
                return (
                  <tr key={p.id} className="hover:bg-zinc-800/30">
                    <td className="py-1.5">
                      <div className="text-zinc-200">{p.clientName}</div>
                      <div className="text-[10px] text-zinc-500">{p.projectName}</div>
                    </td>
                    <td className="py-1.5 text-right font-mono text-zinc-300">£{(p.budget / 1000).toFixed(0)}k</td>
                    <td className="py-1.5 text-right font-mono text-zinc-400">£{(p.actual / 1000).toFixed(0)}k</td>
                    <td className={`py-1.5 text-right font-mono font-semibold ${marginColor}`}>{p.margin}%</td>
                    <td className="py-1.5">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${statusColor}`}>
                        {p.status}
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
