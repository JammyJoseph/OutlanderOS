"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2, MapPin, Clock } from "lucide-react";
import { ScheduleBlock } from "./types";
import { useConfirm } from "@/components/ui/confirm-provider";

interface Props {
  productionId: string;
  blocks: ScheduleBlock[];
  numShootDays: number;
  refresh: () => void;
}

export default function ScheduleTab({
  productionId,
  blocks,
  numShootDays,
  refresh,
}: Props) {
  const confirm = useConfirm();
  const days = useMemo(() => {
    const set = new Set<number>();
    for (const b of blocks) set.add(b.shootDay);
    if (set.size === 0) set.add(1);
    const max = Math.max(numShootDays || 1, ...Array.from(set));
    const arr: number[] = [];
    for (let i = 1; i <= max; i++) arr.push(i);
    return arr;
  }, [blocks, numShootDays]);

  const [activeDay, setActiveDay] = useState<number>(days[0] ?? 1);
  const [showAdd, setShowAdd] = useState(false);

  const dayBlocks = useMemo(
    () =>
      (blocks ?? [])
        .filter((b) => b.shootDay === activeDay)
        .sort((a, b) => a.time.localeCompare(b.time)),
    [blocks, activeDay]
  );

  async function add(form: Partial<ScheduleBlock>) {
    await fetch(`/api/productions/${productionId}/schedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, shootDay: activeDay }),
    });
    setShowAdd(false);
    refresh();
  }

  async function update(blockId: string, patch: Partial<ScheduleBlock>) {
    await fetch(`/api/productions/${productionId}/schedule?blockId=${blockId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    refresh();
  }

  async function remove(blockId: string) {
    const ok = await confirm({
      title: "Delete schedule block?",
      message: "This removes the block from the schedule. This cannot be undone.",
      confirmLabel: "Delete",
      confirmVariant: "danger",
    });
    if (!ok) return;
    await fetch(`/api/productions/${productionId}/schedule?blockId=${blockId}`, {
      method: "DELETE",
    });
    refresh();
  }

  return (
    <div className="space-y-5">
      {/* Day tabs */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-50 dark:border-gray-800 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            {(days ?? []).map((d) => (
              <button
                key={d}
                onClick={() => setActiveDay(d)}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                  activeDay === d
                    ? "bg-[#ffd700] text-black"
                    : "bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
              >
                Day {d}
                <span
                  className={`ml-1.5 text-[10px] ${
                    activeDay === d ? "text-black/70" : "text-gray-400 dark:text-gray-500"
                  }`}
                >
                  {(blocks ?? []).filter((b) => b.shootDay === d).length}
                </span>
              </button>
            ))}
            <button
              onClick={() => setActiveDay(days.length + 1)}
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              + Day
            </button>
          </div>
          <button
            onClick={() => setShowAdd((v) => !v)}
            className="inline-flex items-center gap-1 text-xs font-medium text-[#ffd700] hover:text-[#e6c200]"
          >
            <Plus size={13} /> Add block
          </button>
        </div>

        {showAdd && (
          <AddBlockForm
            onAdd={add}
            onCancel={() => setShowAdd(false)}
            day={activeDay}
          />
        )}

        {dayBlocks.length === 0 && !showAdd ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">No schedule blocks for Day {activeDay}.</p>
            <button
              onClick={() => setShowAdd(true)}
              className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[#ffd700] hover:text-[#e6c200]"
            >
              <Plus size={12} /> Add your first block
            </button>
          </div>
        ) : (
          <Timeline
            blocks={dayBlocks}
            onUpdate={update}
            onRemove={remove}
          />
        )}
      </div>
    </div>
  );
}

function Timeline({
  blocks,
  onUpdate,
  onRemove,
}: {
  blocks: ScheduleBlock[];
  onUpdate: (blockId: string, patch: Partial<ScheduleBlock>) => void;
  onRemove: (blockId: string) => void;
}) {
  return (
    <div className="px-5 py-5">
      <div className="relative">
        <div className="absolute left-[72px] top-2 bottom-2 w-px bg-gray-100 dark:bg-gray-800" />
        <div className="space-y-3">
          {(blocks ?? []).map((b) => (
            <TimelineRow
              key={b.id}
              block={b}
              onUpdate={(patch) => onUpdate(b.id, patch)}
              onRemove={() => onRemove(b.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function TimelineRow({
  block,
  onUpdate,
  onRemove,
}: {
  block: ScheduleBlock;
  onUpdate: (patch: Partial<ScheduleBlock>) => void;
  onRemove: () => void;
}) {
  const [time, setTime] = useState(block.time);
  const [activity, setActivity] = useState(block.activity);
  const [location, setLocation] = useState(block.location ?? "");
  const [notes, setNotes] = useState(block.notes ?? "");

  return (
    <div className="group flex items-start gap-4">
      <div className="w-16 shrink-0 pt-2">
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          onBlur={() => {
            if (time !== block.time) onUpdate({ time });
          }}
          className="text-sm font-semibold text-gray-900 dark:text-gray-100 bg-transparent border-none outline-none w-full text-right tabular-nums focus:bg-amber-50/40 dark:focus:bg-amber-900/30 rounded-md px-1"
        />
      </div>
      <div className="relative flex flex-col items-center pt-3.5 shrink-0">
        <span className="w-2.5 h-2.5 bg-[#ffd700] rounded-full ring-4 ring-white dark:ring-gray-900" />
      </div>
      <div className="flex-1 min-w-0 bg-gray-50/50 dark:bg-gray-800/50 hover:bg-amber-50/20 dark:hover:bg-amber-900/30 transition-colors rounded-xl p-3 -ml-1">
        <input
          type="text"
          value={activity}
          onChange={(e) => setActivity(e.target.value)}
          onBlur={() => {
            if (activity !== block.activity) onUpdate({ activity });
          }}
          placeholder="Activity"
          className="text-sm font-medium text-gray-900 dark:text-gray-100 bg-transparent border-none outline-none w-full px-1 py-0.5 rounded-md focus:bg-white dark:focus:bg-gray-900"
        />
        <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-1 flex-1">
            <MapPin size={11} className="shrink-0" />
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              onBlur={() => {
                const next = location || null;
                if (next !== block.location) onUpdate({ location: next });
              }}
              placeholder="Location"
              className="bg-transparent border-none outline-none w-full px-1 py-0.5 rounded-md focus:bg-white dark:focus:bg-gray-900"
            />
          </div>
          <div className="flex items-center gap-1 flex-1">
            <Clock size={11} className="shrink-0" />
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => {
                const next = notes || null;
                if (next !== block.notes) onUpdate({ notes: next });
              }}
              placeholder="Notes"
              className="bg-transparent border-none outline-none w-full px-1 py-0.5 rounded-md focus:bg-white dark:focus:bg-gray-900"
            />
          </div>
        </div>
      </div>
      <button
        onClick={onRemove}
        className="opacity-0 group-hover:opacity-100 text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 p-1 mt-3.5"
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}

function AddBlockForm({
  onAdd,
  onCancel,
  day,
}: {
  onAdd: (form: Partial<ScheduleBlock>) => void;
  onCancel: () => void;
  day: number;
}) {
  const [time, setTime] = useState("08:00");
  const [activity, setActivity] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");

  function submit() {
    if (!activity.trim()) return;
    onAdd({
      time,
      activity: activity.trim(),
      location: location.trim() || null,
      notes: notes.trim() || null,
      shootDay: day,
    });
  }

  return (
    <div className="px-5 py-4 bg-amber-50/30 dark:bg-amber-900/30 border-b border-gray-50 dark:border-gray-800 grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
      <input
        type="time"
        value={time}
        onChange={(e) => setTime(e.target.value)}
        className="md:col-span-2 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ffd700]/30 focus:border-[#ffd700] tabular-nums"
      />
      <input
        type="text"
        value={activity}
        onChange={(e) => setActivity(e.target.value)}
        placeholder="Activity (Crew call, Setup, Talent arrives…)"
        className="md:col-span-4 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ffd700]/30 focus:border-[#ffd700]"
      />
      <input
        type="text"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        placeholder="Location"
        className="md:col-span-2 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ffd700]/30 focus:border-[#ffd700]"
      />
      <input
        type="text"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes"
        className="md:col-span-3 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ffd700]/30 focus:border-[#ffd700]"
      />
      <div className="md:col-span-1 flex items-center gap-1 justify-end">
        <button
          onClick={submit}
          className="bg-[#ffd700] text-black text-xs font-medium px-3 py-2 rounded-xl hover:bg-[#e6c200] transition-colors"
        >
          Add
        </button>
        <button
          onClick={onCancel}
          className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 px-2 py-2"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
