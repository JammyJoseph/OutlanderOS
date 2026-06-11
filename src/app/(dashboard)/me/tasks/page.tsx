"use client";

import { useEffect, useState } from "react";
import { Plus, Check, Clock } from "lucide-react";

interface Task {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  status: string;
  priority: string;
  portal: string | null;
  link: string | null;
}

const PRIORITY_STYLES: Record<string, string> = {
  LOW: "bg-gray-100 text-gray-600",
  MEDIUM: "bg-blue-50 text-blue-700",
  HIGH: "bg-amber-50 text-amber-700",
  URGENT: "bg-red-50 text-red-700",
};

const PORTAL_LABELS: Record<string, string> = {
  commercial: "Commercial",
  production: "Production",
  print: "Print",
  finance: "Finance",
  followup: "Follow-up",
};

export default function MyTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [due, setDue] = useState("");
  const [category, setCategory] = useState("general");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "done">("active");

  useEffect(() => {
    fetch("/api/tasks")
      .then((r) => r.json())
      .then((d) => setTasks(Array.isArray(d.tasks) ? d.tasks : []))
      .finally(() => setLoading(false));
  }, []);

  async function toggle(t: Task) {
    const next = t.status === "DONE" ? "TODO" : "DONE";
    setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, status: next } : x)));
    await fetch(`/api/tasks/${t.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        priority,
        dueDate: due || null,
        portal: category === "general" ? null : category,
      }),
    });
    const data = await res.json();
    if (data.task) {
      setTasks((prev) => [data.task, ...prev]);
      setTitle("");
      setDue("");
      setPriority("MEDIUM");
      setCategory("general");
      setShowNew(false);
    }
  }

  const filtered = tasks.filter((t) => {
    if (statusFilter === "all") return true;
    if (statusFilter === "active") return t.status !== "DONE";
    return t.status === "DONE";
  });

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-6 h-8 w-40 animate-pulse rounded-lg bg-gray-100" />
        <div className="space-y-2">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Tasks</h1>
          <p className="text-sm text-gray-500 mt-1">All tasks assigned to you</p>
        </div>
        <button
          onClick={() => setShowNew((v) => !v)}
          className="flex items-center gap-1.5 rounded-xl bg-[#D4A853] px-4 py-2 text-sm font-semibold text-white hover:bg-[#C49843]"
        >
          <Plus className="h-3.5 w-3.5" /> New Task
        </button>
      </div>

      <div className="flex items-center gap-1 mb-4">
        {(["active", "all", "done"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
              statusFilter === s ? "bg-amber-50 text-amber-700" : "text-gray-500 hover:bg-gray-50"
            }`}
          >
            {s === "active" ? "Active" : s === "all" ? "All" : "Done"}
          </button>
        ))}
      </div>

      {showNew && (
        <form onSubmit={add} className="mb-4 card-apple p-4 space-y-2">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs doing?"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4A853]"
          />
          <div className="flex items-center gap-2">
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs"
            >
              <option value="general">General</option>
              <option value="commercial">Commercial</option>
              <option value="production">Production</option>
              <option value="print">Print</option>
              <option value="followup">Follow-up</option>
            </select>
            <input
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs"
            />
            <button
              type="submit"
              className="ml-auto rounded-lg bg-[#D4A853] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#C49843]"
            >
              Add
            </button>
          </div>
        </form>
      )}

      {filtered.length === 0 ? (
        <div className="card-apple p-12 text-center text-sm text-gray-400">
          {tasks.length === 0 ? "No tasks yet." : "Nothing in this view."}
        </div>
      ) : (
        <div className="card-apple">
          <ul className="divide-y divide-gray-100">
            {filtered.map((t) => {
              const isDone = t.status === "DONE";
              const due = t.dueDate ? new Date(t.dueDate) : null;
              const overdue = due && due < new Date() && !isDone;
              return (
                <li key={t.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                  <button
                    onClick={() => toggle(t)}
                    className={`flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors ${
                      isDone ? "bg-[#D4A853] border-[#D4A853] text-white" : "border-gray-300 hover:border-[#D4A853]"
                    }`}
                  >
                    {isDone && <Check className="h-3 w-3" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm ${isDone ? "line-through text-gray-400" : "text-gray-900"}`}>
                      {t.title}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${PRIORITY_STYLES[t.priority] ?? "bg-gray-100 text-gray-600"}`}>
                        {t.priority.toLowerCase()}
                      </span>
                      {t.portal && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600">
                          {PORTAL_LABELS[t.portal] ?? t.portal}
                        </span>
                      )}
                      {due && (
                        <span className={`flex items-center gap-1 text-[10px] ${overdue ? "text-red-600 font-medium" : "text-gray-500"}`}>
                          <Clock className="h-2.5 w-2.5" />
                          {due.toLocaleDateString("en-GB", { month: "short", day: "numeric" })}
                          {overdue && " · overdue"}
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
