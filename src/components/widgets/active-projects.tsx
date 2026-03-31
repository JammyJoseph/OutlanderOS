import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FolderKanban, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

const projects = [
  {
    name: "April 2025 Issue",
    client: "In-house",
    budget: 45000,
    actuals: 38200,
    status: "ACTIVE",
    due: "Apr 3",
  },
  {
    name: "ASOS Brand Partnership",
    client: "ASOS",
    budget: 22000,
    actuals: 14100,
    status: "ACTIVE",
    due: "Apr 12",
  },
  {
    name: "Digital Rebrand",
    client: "Internal",
    budget: 8000,
    actuals: 9200,
    status: "ACTIVE",
    due: "Apr 30",
  },
];

function marginColor(budget: number, actuals: number) {
  const margin = ((budget - actuals) / budget) * 100;
  if (margin < 0) return "text-red-400";
  if (margin < 15) return "text-amber-400";
  return "text-emerald-400";
}

function marginLabel(budget: number, actuals: number) {
  const margin = ((budget - actuals) / budget) * 100;
  return `${margin >= 0 ? "+" : ""}${margin.toFixed(0)}%`;
}

export function ActiveProjectsWidget() {
  return (
    <Card className="border-neutral-800 bg-neutral-900">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-neutral-200">
          <FolderKanban className="h-4 w-4 text-[#D4A853]" />
          Active Projects
        </CardTitle>
        <Link href="/projects" className="text-xs text-neutral-500 hover:text-neutral-300">
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-2">
        {projects.map((p) => {
          const pct = Math.min((p.actuals / p.budget) * 100, 100);
          return (
            <div key={p.name} className="space-y-1.5 rounded-md bg-neutral-800/50 p-2.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-neutral-200">{p.name}</p>
                <span className={`font-mono text-xs font-semibold ${marginColor(p.budget, p.actuals)}`}>
                  {marginLabel(p.budget, p.actuals)}
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-neutral-500">
                <span>{p.client}</span>
                <span>Due {p.due}</span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-neutral-700">
                <div
                  className={`h-full rounded-full ${pct > 90 ? "bg-red-500" : pct > 70 ? "bg-amber-500" : "bg-[#D4A853]"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-[10px] text-neutral-500">
                £{p.actuals.toLocaleString()} / £{p.budget.toLocaleString()}
              </p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
