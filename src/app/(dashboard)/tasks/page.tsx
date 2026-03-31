"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckSquare, Plus, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const allTasks = [
  { id: 1, title: "Approve April cover proofs", project: "April 2025 Issue", priority: "URGENT", status: "TODO", assignee: "Joe", due: "Apr 1" },
  { id: 2, title: "Send ASOS brief to Patricia", project: "ASOS Brand Partnership", priority: "HIGH", status: "TODO", assignee: "Joe", due: "Apr 2" },
  { id: 3, title: "VAT return prep – send to accountant", project: null, priority: "URGENT", status: "TODO", assignee: "Joe", due: "Apr 7" },
  { id: 4, title: "Update contributor contracts", project: null, priority: "MEDIUM", status: "IN_PROGRESS", assignee: "Joe", due: "Apr 5" },
  { id: 5, title: "Review Q1 P&L with Quinn", project: null, priority: "HIGH", status: "DONE", assignee: "Joe", due: "Mar 31" },
  { id: 6, title: "Brief Callum on Instagram strategy", project: "ASOS Brand Partnership", priority: "MEDIUM", status: "IN_PROGRESS", assignee: "Callum", due: "Apr 3" },
  { id: 7, title: "Book Hackney Wick studio", project: "April 2025 Issue", priority: "HIGH", status: "DONE", assignee: "Patricia", due: "Mar 25" },
  { id: 8, title: "Shoot call sheet – final version", project: "April 2025 Issue", priority: "URGENT", status: "TODO", assignee: "Patricia", due: "Apr 2" },
  { id: 9, title: "Outreach to 5 new partnership prospects", project: null, priority: "MEDIUM", status: "IN_PROGRESS", assignee: "Shreeya", due: "Apr 10" },
  { id: 10, title: "Domain renewal check", project: null, priority: "LOW", status: "TODO", assignee: "Joe", due: "Apr 22" },
];

const priorityStyles: Record<string, string> = {
  URGENT: "bg-red-500/20 text-red-400",
  HIGH: "bg-amber-500/20 text-amber-400",
  MEDIUM: "bg-blue-500/20 text-blue-400",
  LOW: "bg-neutral-500/20 text-neutral-400",
};

const statusGroups = ["TODO", "IN_PROGRESS", "DONE"] as const;
const statusLabels: Record<string, string> = {
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  DONE: "Done",
};

export default function TasksPage() {
  const [filter, setFilter] = useState<string>("all");

  const filtered = allTasks.filter((t) => filter === "all" || t.assignee === filter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-100">Tasks</h1>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-neutral-800 overflow-hidden">
            {["all", "Joe", "Callum", "Patricia", "Shreeya"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-xs transition-colors ${
                  filter === f
                    ? "bg-neutral-800 text-white"
                    : "text-neutral-500 hover:text-neutral-300"
                }`}
              >
                {f === "all" ? "All" : f}
              </button>
            ))}
          </div>
          <Button size="sm" className="bg-[#D4A853] text-black hover:bg-[#c49a47]">
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add Task
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {statusGroups.map((group) => {
          const groupTasks = filtered.filter((t) => t.status === group);
          return (
            <div key={group} className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <h2 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                  {statusLabels[group]}
                </h2>
                <Badge className="bg-neutral-800 text-neutral-400 text-[10px]">
                  {groupTasks.length}
                </Badge>
              </div>
              <div className="space-y-2">
                {groupTasks.map((task) => (
                  <Card key={task.id} className="border-neutral-800 bg-neutral-900 hover:border-neutral-700 cursor-pointer transition-colors">
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-start gap-2">
                        <div className={`mt-0.5 h-3.5 w-3.5 shrink-0 rounded-sm border ${
                          task.status === "DONE"
                            ? "border-[#D4A853] bg-[#D4A853]"
                            : "border-neutral-600"
                        }`}>
                          {task.status === "DONE" && (
                            <svg viewBox="0 0 12 12" className="h-full w-full text-black">
                              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>
                        <p className={`text-xs font-medium leading-tight ${task.status === "DONE" ? "line-through text-neutral-500" : "text-neutral-200"}`}>
                          {task.title}
                        </p>
                      </div>
                      <div className="flex items-center justify-between gap-1 flex-wrap">
                        <Badge className={`text-[10px] ${priorityStyles[task.priority]}`}>
                          {task.priority.toLowerCase()}
                        </Badge>
                        {task.project && (
                          <span className="truncate text-[10px] text-neutral-500 max-w-[100px]">
                            {task.project}
                          </span>
                        )}
                        <span className="font-mono text-[10px] text-neutral-500 ml-auto">{task.due}</span>
                      </div>
                      <p className="text-[10px] text-neutral-600">{task.assignee}</p>
                    </CardContent>
                  </Card>
                ))}
                {groupTasks.length === 0 && (
                  <div className="rounded-md border border-dashed border-neutral-800 p-4 text-center text-xs text-neutral-600">
                    No tasks
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
