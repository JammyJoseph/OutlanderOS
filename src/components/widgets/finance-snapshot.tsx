"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, TrendingDown, ArrowRight } from "lucide-react";
import Link from "next/link";
import { AreaChart, Area, ResponsiveContainer, Tooltip } from "recharts";

const sparkData = [
  { v: 42 }, { v: 38 }, { v: 55 }, { v: 48 }, { v: 62 }, { v: 58 }, { v: 71 },
];

const stats = [
  { label: "Revenue (MTD)", value: "£68,400", delta: "+14%", up: true },
  { label: "Expenses (MTD)", value: "£31,200", delta: "+3%", up: false },
  { label: "Cash Balance", value: "£142,800", delta: "+8%", up: true },
  { label: "Overdue Invoices", value: "£7,500", delta: "2 invoices", up: false },
];

export function FinanceSnapshotWidget() {
  return (
    <Card className="border-neutral-800 bg-neutral-900">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-neutral-200">
          <DollarSign className="h-4 w-4 text-[#D4A853]" />
          Finance Snapshot
        </CardTitle>
        <Link href="/finance" className="text-xs text-neutral-500 hover:text-neutral-300">
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {stats.map((s) => (
            <div key={s.label} className="rounded-md bg-neutral-800/50 p-2.5">
              <p className="text-[10px] text-neutral-500">{s.label}</p>
              <p className="font-mono text-sm font-semibold text-neutral-100">{s.value}</p>
              <div className="flex items-center gap-1">
                {s.up ? (
                  <TrendingUp className="h-3 w-3 text-emerald-400" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-400" />
                )}
                <span className={`text-[10px] ${s.up ? "text-emerald-400" : "text-red-400"}`}>
                  {s.delta}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Mini spark chart */}
        <div className="h-12">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkData}>
              <defs>
                <linearGradient id="finGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#D4A853" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#D4A853" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke="#D4A853"
                strokeWidth={1.5}
                fill="url(#finGrad)"
                dot={false}
              />
              <Tooltip
                contentStyle={{
                  background: "#1a1a1a",
                  border: "1px solid #333",
                  borderRadius: "4px",
                  fontSize: "11px",
                  color: "#f5f5f5",
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <p className="text-center text-[10px] text-neutral-600">Revenue — last 7 days</p>
      </CardContent>
    </Card>
  );
}
