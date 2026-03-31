"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, DollarSign, FileText } from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const revenueData = [
  { month: "Oct", revenue: 52000, expenses: 28000 },
  { month: "Nov", revenue: 61000, expenses: 31000 },
  { month: "Dec", revenue: 48000, expenses: 29000 },
  { month: "Jan", revenue: 55000, expenses: 27000 },
  { month: "Feb", revenue: 60000, expenses: 30000 },
  { month: "Mar", revenue: 68400, expenses: 31200 },
];

const invoices = [
  { number: "INV-2025-041", client: "ASOS UK", amount: 18500, status: "PAID", due: "Mar 15" },
  { number: "INV-2025-042", client: "H&M Group", amount: 12000, status: "SENT", due: "Apr 5" },
  { number: "INV-2025-043", client: "Vogue Licensing", amount: 7500, status: "OVERDUE", due: "Mar 28" },
  { number: "INV-2025-044", client: "NET-A-PORTER", amount: 22000, status: "DRAFT", due: "Apr 20" },
  { number: "INV-2025-045", client: "Matches Fashion", amount: 9800, status: "SENT", due: "Apr 12" },
];

const statusStyles: Record<string, string> = {
  PAID: "bg-emerald-500/20 text-emerald-400",
  SENT: "bg-blue-500/20 text-blue-400",
  OVERDUE: "bg-red-500/20 text-red-400",
  DRAFT: "bg-neutral-500/20 text-neutral-400",
};

const tooltipStyle = {
  contentStyle: {
    background: "#1a1a1a",
    border: "1px solid #333",
    borderRadius: "6px",
    fontSize: "12px",
    color: "#f5f5f5",
  },
};

export default function FinancePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-neutral-100">Finance</h1>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Revenue (MTD)", value: "£68,400", delta: "+14% vs last month", up: true },
          { label: "Expenses (MTD)", value: "£31,200", delta: "+3% vs last month", up: false },
          { label: "Net Profit", value: "£37,200", delta: "+24% vs last month", up: true },
          { label: "Cash Balance", value: "£142,800", delta: "Lloyds Business", up: true },
        ].map((kpi) => (
          <Card key={kpi.label} className="border-neutral-800 bg-neutral-900">
            <CardContent className="p-4">
              <p className="text-xs text-neutral-500">{kpi.label}</p>
              <p className="mt-1 font-mono text-2xl font-bold text-neutral-100">{kpi.value}</p>
              <div className="mt-1 flex items-center gap-1">
                {kpi.up ? (
                  <TrendingUp className="h-3 w-3 text-emerald-400" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-400" />
                )}
                <span className={`text-[11px] ${kpi.up ? "text-emerald-400" : "text-red-400"}`}>
                  {kpi.delta}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="border-neutral-800 bg-neutral-900">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-neutral-200">
              <TrendingUp className="h-4 w-4 text-[#D4A853]" />
              Revenue vs Expenses — Last 6 Months
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={revenueData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                <XAxis dataKey="month" tick={{ fill: "#737373", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#737373", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`} />
                <Tooltip {...tooltipStyle} formatter={(v) => [`£${Number(v).toLocaleString()}`, ""]} />
                <Bar dataKey="revenue" fill="#D4A853" radius={[3, 3, 0, 0]} />
                <Bar dataKey="expenses" fill="#404040" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-neutral-800 bg-neutral-900">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-neutral-200">
              <DollarSign className="h-4 w-4 text-[#D4A853]" />
              Cash Flow Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="cashGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D4A853" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#D4A853" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                <XAxis dataKey="month" tick={{ fill: "#737373", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#737373", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`} />
                <Tooltip {...tooltipStyle} formatter={(v) => [`£${Number(v).toLocaleString()}`, ""]} />
                <Area type="monotone" dataKey="revenue" stroke="#D4A853" strokeWidth={2} fill="url(#cashGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Invoices */}
      <Card className="border-neutral-800 bg-neutral-900">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-neutral-200">
            <FileText className="h-4 w-4 text-[#D4A853]" />
            Recent Invoices
          </CardTitle>
          <button className="text-xs text-[#D4A853] hover:underline">+ New Invoice</button>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-800 text-left text-xs text-neutral-500">
                <th className="pb-2 font-medium">Number</th>
                <th className="pb-2 font-medium">Client</th>
                <th className="pb-2 font-medium">Amount</th>
                <th className="pb-2 font-medium">Due</th>
                <th className="pb-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/50">
              {invoices.map((inv) => (
                <tr key={inv.number} className="hover:bg-neutral-800/30">
                  <td className="py-2.5 font-mono text-xs text-neutral-400">{inv.number}</td>
                  <td className="py-2.5 text-xs text-neutral-200">{inv.client}</td>
                  <td className="py-2.5 font-mono text-xs text-neutral-200">£{inv.amount.toLocaleString()}</td>
                  <td className="py-2.5 font-mono text-xs text-neutral-500">{inv.due}</td>
                  <td className="py-2.5">
                    <Badge className={`text-[10px] ${statusStyles[inv.status] ?? ""}`}>
                      {inv.status.toLowerCase()}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
