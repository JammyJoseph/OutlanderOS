import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckSquare, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

const tasks = [
  { title: "Approve April cover proofs", priority: "URGENT", assignee: "Joe", done: false },
  { title: "Send ASOS brief to Patricia", priority: "HIGH", assignee: "Joe", done: false },
  { title: "Review Q1 P&L with Quinn", priority: "HIGH", assignee: "Joe", done: true },
  { title: "Update contributor contracts", priority: "MEDIUM", assignee: "Joe", done: false },
  { title: "VAT return prep – send to accountant", priority: "URGENT", assignee: "Joe", done: false },
];

const priorityStyles: Record<string, string> = {
  URGENT: "bg-red-500/20 text-red-400",
  HIGH: "bg-amber-500/20 text-amber-400",
  MEDIUM: "bg-blue-500/20 text-blue-400",
  LOW: "bg-neutral-500/20 text-neutral-400",
};

export function PriorityTasksWidget() {
  return (
    <Card className="border-neutral-800 bg-neutral-900">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-neutral-200">
          <CheckSquare className="h-4 w-4 text-[#D4A853]" />
          Priority Tasks
        </CardTitle>
        <Link href="/tasks" className="text-xs text-neutral-500 hover:text-neutral-300">
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-1">
        {tasks.map((task, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-neutral-800/50"
          >
            <div
              className={`h-3.5 w-3.5 shrink-0 rounded-sm border ${
                task.done
                  ? "border-[#D4A853] bg-[#D4A853]"
                  : "border-neutral-600"
              }`}
            >
              {task.done && (
                <svg viewBox="0 0 12 12" className="h-full w-full text-black">
                  <path
                    d="M2 6l3 3 5-5"
                    stroke="currentColor"
                    strokeWidth="2"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </div>
            <p
              className={`flex-1 truncate text-xs ${
                task.done ? "text-neutral-600 line-through" : "text-neutral-200"
              }`}
            >
              {task.title}
            </p>
            <Badge className={`shrink-0 text-[10px] ${priorityStyles[task.priority]}`}>
              {task.priority.toLowerCase()}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
