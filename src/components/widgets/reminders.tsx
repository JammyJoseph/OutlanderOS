import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

const reminders = [
  { title: "VAT Return Deadline", date: "Apr 7", category: "compliance", urgent: true },
  { title: "Monthly Payroll", date: "Apr 15", category: "payroll", urgent: false },
  { title: "Callum probation review", date: "Apr 10", category: "hr", urgent: false },
  { title: "Domain renewals", date: "Apr 22", category: "ops", urgent: false },
  { title: "Q2 Budget Planning", date: "Apr 30", category: "finance", urgent: false },
];

const catColors: Record<string, string> = {
  compliance: "bg-red-500/20 text-red-400",
  payroll: "bg-emerald-500/20 text-emerald-400",
  hr: "bg-blue-500/20 text-blue-400",
  ops: "bg-purple-500/20 text-purple-400",
  finance: "bg-[#D4A853]/20 text-[#D4A853]",
};

export function RemindersWidget() {
  return (
    <Card className="border-neutral-800 bg-neutral-900">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-neutral-200">
          <Bell className="h-4 w-4 text-[#D4A853]" />
          Reminders
        </CardTitle>
        <ArrowRight className="h-3.5 w-3.5 text-neutral-500" />
      </CardHeader>
      <CardContent className="space-y-1">
        {reminders.map((r, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-neutral-800/50"
          >
            <div
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                r.urgent ? "bg-red-400" : "bg-neutral-600"
              }`}
            />
            <p className="flex-1 truncate text-xs text-neutral-200">{r.title}</p>
            <span className="font-mono text-[10px] text-neutral-500">{r.date}</span>
            <Badge className={`text-[10px] ${catColors[r.category] ?? ""}`}>
              {r.category}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
