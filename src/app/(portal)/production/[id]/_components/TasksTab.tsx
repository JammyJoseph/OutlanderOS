"use client";

import { useMemo, useState } from "react";
import {
  Plus,
  Trash2,
  Lock,
  CircleDashed,
  CircleDot,
  CheckCircle2,
  Circle,
  ArrowDownRight,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ProductionTask, TaskStatus } from "./types";

interface Props {
  productionId: string;
  tasks: ProductionTask[];
  refresh: () => void;
}

const STATUS_ORDER: TaskStatus[] = ["LOCKED", "READY", "IN_PROGRESS", "DONE"];

const STATUS_LABEL: Record<TaskStatus, string> = {
  LOCKED: "Locked",
  READY: "Ready",
  IN_PROGRESS: "In progress",
  DONE: "Done",
};

const STATUS_COLOR: Record<TaskStatus, string> = {
  LOCKED: "bg-gray-100 text-gray-400",
  READY: "bg-blue-50 text-blue-700",
  IN_PROGRESS: "bg-amber-50 text-amber-700",
  DONE: "bg-emerald-50 text-emerald-700",
};

export default function TasksTab({ productionId, tasks, refresh }: Props) {
  const [showAdd, setShowAdd] = useState(false);

  const stats = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter((t) => t.status === "DONE").length;
    const ip = tasks.filter((t) => t.status === "IN_PROGRESS").length;
    const ready = tasks.filter((t) => t.status === "READY").length;
    const locked = tasks.filter((t) => t.status === "LOCKED").length;
    return { total, done, ip, ready, locked, pct: total ? Math.round((done / total) * 100) : 0 };
  }, [tasks]);

  async function add(form: Partial<ProductionTask>) {
    await fetch(`/api/productions/${productionId}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setShowAdd(false);
    refresh();
  }

  async function update(taskId: string, patch: Partial<ProductionTask>) {
    await fetch(`/api/productions/${productionId}/tasks?taskId=${taskId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    refresh();
  }

  async function remove(taskId: string) {
    if (!confirm("Delete this task?")) return;
    await fetch(`/api/productions/${productionId}/tasks?taskId=${taskId}`, {
      method: "DELETE",
    });
    refresh();
  }

  function cycleStatus(t: ProductionTask) {
    if (t.status === "LOCKED") return;
    const idx = STATUS_ORDER.indexOf(t.status);
    const next = STATUS_ORDER[Math.min(idx + 1, STATUS_ORDER.length - 1)];
    update(t.id, { status: next });
  }

  function toggleDone(t: ProductionTask) {
    if (t.status === "LOCKED") return;
    update(t.id, { status: t.status === "DONE" ? "READY" : "DONE" });
  }

  return (
    <div className="space-y-5">
      {/* Progress + stats */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Progress</p>
            <p className="text-2xl font-semibold text-gray-900 mt-1">
              {stats.done} <span className="text-gray-400 text-base font-normal">of {stats.total}</span>
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <Pill color="bg-blue-50 text-blue-700">{stats.ready} ready</Pill>
            <Pill color="bg-amber-50 text-amber-700">{stats.ip} in progress</Pill>
            <Pill color="bg-gray-100 text-gray-500">{stats.locked} locked</Pill>
          </div>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#D4A853] rounded-full transition-all"
            style={{ width: `${stats.pct}%` }}
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800">Tasks</h2>
          <button
            onClick={() => setShowAdd((v) => !v)}
            className="inline-flex items-center gap-1 text-xs font-medium text-[#D4A853] hover:text-[#c49843]"
          >
            <Plus size={13} /> Add task
          </button>
        </div>

        {showAdd && (
          <AddTaskForm
            tasks={tasks}
            onAdd={add}
            onCancel={() => setShowAdd(false)}
          />
        )}

        {tasks.length === 0 && !showAdd ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-gray-500">No tasks yet.</p>
            <button
              onClick={() => setShowAdd(true)}
              className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[#D4A853] hover:text-[#c49843]"
            >
              <Plus size={12} /> Add your first task
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {(tasks ?? []).map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                tasks={tasks}
                onToggleDone={() => toggleDone(t)}
                onCycleStatus={() => cycleStatus(t)}
                onUpdate={(patch) => update(t.id, patch)}
                onRemove={() => remove(t.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TaskRow({
  task,
  tasks,
  onToggleDone,
  onCycleStatus,
  onUpdate,
  onRemove,
}: {
  task: ProductionTask;
  tasks: ProductionTask[];
  onToggleDone: () => void;
  onCycleStatus: () => void;
  onUpdate: (patch: Partial<ProductionTask>) => void;
  onRemove: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [owner, setOwner] = useState(task.owner ?? "");
  const [dueDate, setDueDate] = useState(task.dueDate ? task.dueDate.split("T")[0] : "");
  const dependsOnTask = task.dependsOn
    ? tasks.find((t) => t.id === task.dependsOn)
    : null;

  const isLocked = task.status === "LOCKED";
  const isDone = task.status === "DONE";

  return (
    <div
      className={`grid grid-cols-12 gap-3 px-5 py-3 items-center group ${
        isLocked ? "bg-gray-50/40 opacity-70" : "hover:bg-amber-50/20"
      }`}
    >
      <div className="col-span-1 flex items-center gap-2 pl-1">
        {dependsOnTask && (
          <ArrowDownRight size={11} className="text-gray-300 -ml-1" />
        )}
        <button
          onClick={onToggleDone}
          disabled={isLocked}
          className="text-gray-300 hover:text-emerald-500 disabled:cursor-not-allowed"
        >
          {isLocked ? (
            <Lock size={16} className="text-gray-300" />
          ) : isDone ? (
            <CheckCircle2 size={18} className="text-emerald-500" />
          ) : task.status === "IN_PROGRESS" ? (
            <CircleDot size={18} className="text-amber-500" />
          ) : task.status === "READY" ? (
            <Circle size={18} className="text-blue-400" />
          ) : (
            <CircleDashed size={18} />
          )}
        </button>
      </div>
      <div className="col-span-5 min-w-0">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            if (title !== task.title) onUpdate({ title });
          }}
          className={`text-sm bg-transparent border-none outline-none w-full px-1 py-0.5 rounded-md focus:bg-white ${
            isDone ? "line-through text-gray-400" : "text-gray-900 font-medium"
          }`}
        />
        {dependsOnTask && (
          <p className="text-[10px] text-gray-400 px-1 mt-0.5 flex items-center gap-1">
            <Lock size={9} />
            After: {dependsOnTask.title}
          </p>
        )}
      </div>
      <div className="col-span-2">
        <input
          type="text"
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          onBlur={() => {
            if (owner !== (task.owner ?? "")) onUpdate({ owner });
          }}
          placeholder="Owner"
          className="text-xs text-gray-600 bg-transparent border-none outline-none w-full px-1 py-0.5 rounded-md focus:bg-white"
        />
      </div>
      <div className="col-span-2">
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          onBlur={() => {
            const next = dueDate || null;
            const cur = task.dueDate ? task.dueDate.split("T")[0] : null;
            if (next !== cur) onUpdate({ dueDate: next });
          }}
          className="text-xs text-gray-600 bg-transparent border-none outline-none w-full px-1 py-0.5 rounded-md focus:bg-white"
        />
        {!dueDate && task.dueDate && (
          <p className="text-[10px] text-gray-400 px-1">{format(parseISO(task.dueDate), "d MMM")}</p>
        )}
      </div>
      <div className="col-span-2 flex items-center justify-end gap-2">
        <button
          onClick={onCycleStatus}
          disabled={isLocked}
          className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full ${STATUS_COLOR[task.status]} ${
            isLocked ? "cursor-not-allowed" : "hover:opacity-80"
          }`}
        >
          {STATUS_LABEL[task.status]}
        </button>
        <button
          onClick={onRemove}
          className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 p-1"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

function AddTaskForm({
  tasks,
  onAdd,
  onCancel,
}: {
  tasks: ProductionTask[];
  onAdd: (form: Partial<ProductionTask>) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [owner, setOwner] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dependsOn, setDependsOn] = useState("");

  function submit() {
    if (!title.trim()) return;
    onAdd({
      title: title.trim(),
      owner: owner.trim() || null,
      dueDate: dueDate || null,
      dependsOn: dependsOn || null,
    });
  }

  return (
    <div className="px-5 py-4 bg-amber-50/30 border-b border-gray-50 grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Task title"
        autoFocus
        className="md:col-span-4 px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#D4A853]/30 focus:border-[#D4A853]"
      />
      <input
        type="text"
        value={owner}
        onChange={(e) => setOwner(e.target.value)}
        placeholder="Owner"
        className="md:col-span-2 px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#D4A853]/30 focus:border-[#D4A853]"
      />
      <input
        type="date"
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
        className="md:col-span-2 px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#D4A853]/30 focus:border-[#D4A853]"
      />
      <select
        value={dependsOn}
        onChange={(e) => setDependsOn(e.target.value)}
        className="md:col-span-3 px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#D4A853]/30 focus:border-[#D4A853]"
      >
        <option value="">No dependency</option>
        {(tasks ?? []).map((t) => (
          <option key={t.id} value={t.id}>
            After: {t.title}
          </option>
        ))}
      </select>
      <div className="md:col-span-1 flex items-center gap-1 justify-end">
        <button
          onClick={submit}
          className="bg-[#D4A853] text-white text-xs font-medium px-3 py-2 rounded-xl hover:bg-[#c49843] transition-colors"
        >
          Add
        </button>
        <button
          onClick={onCancel}
          className="text-xs text-gray-400 hover:text-gray-600 px-2 py-2"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function Pill({ color, children }: { color: string; children: React.ReactNode }) {
  return <span className={`px-2 py-0.5 rounded-full ${color} font-medium`}>{children}</span>;
}
