"use client";

import type { Shot, ShotStatus } from "./types";
import { SHOT_STATUS_LABELS, emptyShot } from "./types";
import { Copy } from "lucide-react";
import { AddButton, DeleteButton, smallInputCls } from "./shared";

const STATUS_STYLES: Record<ShotStatus, string> = {
  planned: "bg-gray-100 text-gray-500",
  in_progress: "bg-amber-100 text-amber-700",
  completed: "bg-emerald-100 text-emerald-700",
};

export function StatusBadge({ status }: { status: ShotStatus }) {
  return (
    <span
      className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLES[status]}`}
    >
      {SHOT_STATUS_LABELS[status]}
    </span>
  );
}

export function ShotlistEditor({
  shotlist,
  setShotlist,
}: {
  shotlist: Shot[];
  setShotlist: (v: Shot[]) => void;
}) {
  function update(i: number, patch: Partial<Shot>) {
    setShotlist(shotlist.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  }

  return (
    <div className="space-y-3">
      {shotlist.map((shot, i) => (
        <div key={i} className="rounded-xl border border-gray-100 bg-gray-50/50 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-gray-900 text-white text-xs font-bold">
              {i + 1}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const next = [...shotlist];
                  next.splice(i + 1, 0, { ...shot, status: "planned" });
                  setShotlist(next);
                }}
                title="Duplicate shot"
                className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-[#ff4444] transition-colors"
              >
                <Copy size={13} />
              </button>
              <select
                value={shot.status}
                onChange={(e) => update(i, { status: e.target.value as ShotStatus })}
                className={smallInputCls}
              >
                {(Object.keys(SHOT_STATUS_LABELS) as ShotStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {SHOT_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
              <DeleteButton onClick={() => setShotlist(shotlist.filter((_, j) => j !== i))} />
            </div>
          </div>
          <input
            type="text"
            value={shot.description}
            onChange={(e) => update(i, { description: e.target.value })}
            placeholder="Shot description — e.g. Wide establishing shot of location"
            className={`${smallInputCls} w-full mb-2`}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="text"
              value={shot.setup}
              onChange={(e) => update(i, { setup: e.target.value })}
              placeholder="Location / setup"
              className={smallInputCls}
            />
            <input
              type="text"
              value={shot.talent}
              onChange={(e) => update(i, { talent: e.target.value })}
              placeholder="Talent involved"
              className={smallInputCls}
            />
            <input
              type="text"
              value={shot.equipment}
              onChange={(e) => update(i, { equipment: e.target.value })}
              placeholder="Equipment notes"
              className={smallInputCls}
            />
            <input
              type="text"
              value={shot.duration}
              onChange={(e) => update(i, { duration: e.target.value })}
              placeholder="Est. duration — e.g. 45 min"
              className={smallInputCls}
            />
          </div>
        </div>
      ))}
      <AddButton label="Add Shot" onClick={() => setShotlist([...shotlist, emptyShot()])} />
    </div>
  );
}

export function ShotlistDoc({ shotlist }: { shotlist: Shot[] }) {
  if (shotlist.length === 0) return null;
  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <div className="grid grid-cols-[32px_1.6fr_1fr_1fr_1fr_70px_90px] gap-0 text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50 px-3 py-2">
        <span>#</span>
        <span>Description</span>
        <span>Setup</span>
        <span>Talent</span>
        <span>Equipment</span>
        <span>Dur.</span>
        <span>Status</span>
      </div>
      {shotlist.map((shot, i) => (
        <div
          key={i}
          className={`grid grid-cols-[32px_1.6fr_1fr_1fr_1fr_70px_90px] gap-0 px-3 py-2.5 text-sm items-center ${
            i % 2 === 0 ? "bg-white" : "bg-gray-50/50"
          }`}
        >
          <span className="font-bold text-[#ff4444]">{i + 1}</span>
          <span className="text-gray-800 font-medium pr-2">{shot.description || "—"}</span>
          <span className="text-gray-600 text-xs pr-2">{shot.setup}</span>
          <span className="text-gray-600 text-xs pr-2">{shot.talent}</span>
          <span className="text-gray-600 text-xs pr-2">{shot.equipment}</span>
          <span className="text-gray-600 text-xs">{shot.duration}</span>
          <span>
            <StatusBadge status={shot.status} />
          </span>
        </div>
      ))}
    </div>
  );
}
