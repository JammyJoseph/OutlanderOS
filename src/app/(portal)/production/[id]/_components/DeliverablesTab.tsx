"use client";

import { useState } from "react";
import { Plus, Trash2, ExternalLink, Package } from "lucide-react";
import { format, parseISO } from "date-fns";
import {
  ProductionDeliverable,
  DeliverableStatus,
  DELIVERABLE_TYPES,
} from "./types";

interface Props {
  productionId: string;
  deliverables: ProductionDeliverable[];
  refresh: () => void;
}

const STATUS_CYCLE: DeliverableStatus[] = [
  "AWAITING",
  "IN_PROGRESS",
  "DELIVERED",
  "APPROVED",
];

const STATUS_STYLES: Record<DeliverableStatus, { bg: string; text: string; label: string }> = {
  AWAITING: { bg: "bg-gray-100", text: "text-gray-600", label: "Awaiting" },
  IN_PROGRESS: { bg: "bg-amber-50", text: "text-amber-700", label: "In progress" },
  DELIVERED: { bg: "bg-blue-50", text: "text-blue-700", label: "Delivered" },
  APPROVED: { bg: "bg-emerald-50", text: "text-emerald-700", label: "Approved" },
};

function getTypeMeta(type: string) {
  return (
    DELIVERABLE_TYPES.find((t) => t.key === type) ||
    DELIVERABLE_TYPES[DELIVERABLE_TYPES.length - 1]
  );
}

export default function DeliverablesTab({
  productionId,
  deliverables,
  refresh,
}: Props) {
  const [showAdd, setShowAdd] = useState(false);

  async function add(form: Partial<ProductionDeliverable>) {
    await fetch(`/api/productions/${productionId}/deliverables`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setShowAdd(false);
    refresh();
  }

  async function update(id: string, patch: Partial<ProductionDeliverable>) {
    await fetch(`/api/productions/${productionId}/deliverables?deliverableId=${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    refresh();
  }

  async function remove(id: string) {
    if (!confirm("Delete this deliverable?")) return;
    await fetch(`/api/productions/${productionId}/deliverables?deliverableId=${id}`, {
      method: "DELETE",
    });
    refresh();
  }

  function cycleStatus(d: ProductionDeliverable) {
    const idx = STATUS_CYCLE.indexOf(d.status);
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    update(d.id, { status: next });
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {(STATUS_CYCLE ?? []).map((s) => {
          const count = deliverables.filter((d) => d.status === s).length;
          const style = STATUS_STYLES[s];
          return (
            <div
              key={s}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}
                >
                  {style.label}
                </span>
              </div>
              <p className="text-2xl font-semibold text-gray-900 mt-2">{count}</p>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <Package size={15} className="text-[#D4A853]" />
            Deliverables
          </h2>
          <button
            onClick={() => setShowAdd((v) => !v)}
            className="inline-flex items-center gap-1 text-xs font-medium text-[#D4A853] hover:text-[#c49843]"
          >
            <Plus size={13} /> Add deliverable
          </button>
        </div>

        {showAdd && <AddDeliverableForm onAdd={add} onCancel={() => setShowAdd(false)} />}

        {deliverables.length === 0 && !showAdd ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-gray-500">No deliverables tracked yet.</p>
            <button
              onClick={() => setShowAdd(true)}
              className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[#D4A853] hover:text-[#c49843]"
            >
              <Plus size={12} /> Add your first deliverable
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {(deliverables ?? []).map((d) => (
              <DeliverableRow
                key={d.id}
                deliverable={d}
                onUpdate={(patch) => update(d.id, patch)}
                onCycleStatus={() => cycleStatus(d)}
                onRemove={() => remove(d.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DeliverableRow({
  deliverable,
  onUpdate,
  onCycleStatus,
  onRemove,
}: {
  deliverable: ProductionDeliverable;
  onUpdate: (patch: Partial<ProductionDeliverable>) => void;
  onCycleStatus: () => void;
  onRemove: () => void;
}) {
  const [title, setTitle] = useState(deliverable.title);
  const [dueDate, setDueDate] = useState(
    deliverable.dueDate ? deliverable.dueDate.split("T")[0] : ""
  );
  const [url, setUrl] = useState(deliverable.url ?? "");
  const meta = getTypeMeta(deliverable.type);
  const status = STATUS_STYLES[deliverable.status];

  return (
    <div className="grid grid-cols-12 gap-3 px-5 py-3 items-center hover:bg-amber-50/20 group">
      <div className="col-span-1">
        <span
          className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${meta.color}`}
        >
          {meta.label}
        </span>
      </div>
      <div className="col-span-4">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            if (title !== deliverable.title) onUpdate({ title });
          }}
          className="text-sm font-medium text-gray-900 bg-transparent border-none outline-none w-full px-1 py-0.5 rounded-md focus:bg-white"
        />
      </div>
      <div className="col-span-2">
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          onBlur={() => {
            const next = dueDate || null;
            const cur = deliverable.dueDate ? deliverable.dueDate.split("T")[0] : null;
            if (next !== cur) onUpdate({ dueDate: next });
          }}
          className="text-xs text-gray-600 bg-transparent border-none outline-none w-full px-1 py-0.5 rounded-md focus:bg-white"
        />
        {!dueDate && deliverable.dueDate && (
          <p className="text-[10px] text-gray-400 px-1">
            {format(parseISO(deliverable.dueDate), "d MMM")}
          </p>
        )}
      </div>
      <div className="col-span-3">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onBlur={() => {
            const next = url || null;
            if (next !== (deliverable.url ?? null)) onUpdate({ url: next });
          }}
          placeholder="https://…"
          className="text-xs text-gray-600 bg-transparent border-none outline-none w-full px-1 py-0.5 rounded-md focus:bg-white"
        />
      </div>
      <div className="col-span-2 flex items-center justify-end gap-2">
        {deliverable.url && (
          <a
            href={deliverable.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-[#D4A853]"
          >
            <ExternalLink size={13} />
          </a>
        )}
        <button
          onClick={onCycleStatus}
          className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full ${status.bg} ${status.text} hover:opacity-80`}
        >
          {status.label}
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

function AddDeliverableForm({
  onAdd,
  onCancel,
}: {
  onAdd: (d: Partial<ProductionDeliverable>) => void;
  onCancel: () => void;
}) {
  const [type, setType] = useState("photo");
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [url, setUrl] = useState("");

  function submit() {
    if (!title.trim()) return;
    onAdd({
      type,
      title: title.trim(),
      dueDate: dueDate || null,
      url: url.trim() || null,
      status: "AWAITING",
    });
  }

  return (
    <div className="px-5 py-4 bg-amber-50/30 border-b border-gray-50 grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
      <select
        value={type}
        onChange={(e) => setType(e.target.value)}
        className="md:col-span-2 px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#D4A853]/30 focus:border-[#D4A853]"
      >
        {(DELIVERABLE_TYPES ?? []).map((t) => (
          <option key={t.key} value={t.key}>
            {t.label}
          </option>
        ))}
      </select>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title"
        className="md:col-span-4 px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#D4A853]/30 focus:border-[#D4A853]"
      />
      <input
        type="date"
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
        className="md:col-span-2 px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#D4A853]/30 focus:border-[#D4A853]"
      />
      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="URL"
        className="md:col-span-3 px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#D4A853]/30 focus:border-[#D4A853]"
      />
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
