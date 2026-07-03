"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, ExternalLink, Package, AlertTriangle, CalendarDays } from "lucide-react";
import { format, parseISO } from "date-fns";
import {
  ProductionDeliverable,
  DeliverableStatus,
  DELIVERABLE_TYPES,
  CampaignDeliverable,
} from "./types";
import { LinkedShotsPicker, ShotOption } from "./LinkedShotsPicker";
import { useConfirm } from "@/components/ui/confirm-provider";

interface Props {
  productionId: string;
  deliverables: ProductionDeliverable[];
  campaignId?: string | null;
  campaignDeliverables?: CampaignDeliverable[];
  refresh: () => void;
}

const COMMERCIAL_STATUSES = [
  { key: "PENDING", label: "Pending", bg: "bg-gray-100", text: "text-gray-600" },
  { key: "IN_PROGRESS", label: "In Progress", bg: "bg-amber-100", text: "text-amber-700" },
  { key: "DELIVERED", label: "Delivered", bg: "bg-emerald-100", text: "text-emerald-700" },
];

function commercialStatusStyle(s: string) {
  return COMMERCIAL_STATUSES.find((x) => x.key === s) ?? COMMERCIAL_STATUSES[0];
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
  campaignId,
  campaignDeliverables = [],
  refresh,
}: Props) {
  const confirm = useConfirm();
  const [showAdd, setShowAdd] = useState(false);
  const [shots, setShots] = useState<ShotOption[]>([]);

  useEffect(() => {
    fetch(`/api/productions/${productionId}/shots`)
      .then((r) => r.json())
      .then((d) => setShots(Array.isArray(d.shots) ? d.shots : []))
      .catch(() => {});
  }, [productionId]);

  // Production can update status on the Commercial deliverables but can't
  // add/remove them — that's Commercial's job.
  async function updateCommercialStatus(id: string, status: string) {
    if (!campaignId) return;
    await fetch(`/api/commercial/deals/${campaignId}/deliverables/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    refresh();
  }

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
    const ok = await confirm({
      title: "Delete deliverable?",
      message: "This removes the deliverable from the production. This cannot be undone.",
      confirmLabel: "Delete",
      confirmVariant: "danger",
    });
    if (!ok) return;
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

  const contractedCampaign = campaignDeliverables.filter((d) => !d.isAdditional);
  const additionalCampaign = campaignDeliverables.filter((d) => d.isAdditional);

  return (
    <div className="space-y-5">
      {/* Commercial deliverables — what was sold to the client (read-only here,
          status is editable). Contracted + additional/scope-creep. */}
      {campaignDeliverables.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50">
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
              <Package size={15} className="text-[#ffd700]" />
              Sold Deliverables
              <span className="text-[11px] font-normal text-gray-400">from the deal</span>
            </h2>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Set by Commercial — you can update status but not add or remove them.
            </p>
          </div>
          <div className="divide-y divide-gray-50">
            {[...contractedCampaign, ...additionalCampaign].map((d) => {
              const st = commercialStatusStyle(d.status);
              return (
                <div
                  key={d.id}
                  className={`flex items-center gap-3 px-5 py-3 ${d.isAdditional ? "border-l-4 border-l-amber-400 bg-amber-50/30" : ""}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {d.title || d.type}
                      {d.quantity > 1 && <span className="text-gray-400 font-normal"> ×{d.quantity}</span>}
                      {d.isAdditional && (
                        <span className="ml-2 inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-200 text-amber-800">
                          <AlertTriangle size={9} /> Additional
                        </span>
                      )}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                        {d.type}
                      </span>
                      {d.dueDate && (
                        <span className="text-[11px] text-gray-400 flex items-center gap-1">
                          <CalendarDays size={11} /> {format(parseISO(d.dueDate), "d MMM yyyy")}
                        </span>
                      )}
                    </div>
                  </div>
                  <select
                    value={d.status}
                    onChange={(e) => updateCommercialStatus(d.id, e.target.value)}
                    className={`text-[11px] font-semibold rounded-full px-2.5 py-1 cursor-pointer focus:outline-none ${st.bg} ${st.text}`}
                  >
                    {COMMERCIAL_STATUSES.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {(STATUS_CYCLE ?? []).map((s) => {
          const count = deliverables.filter((d) => d.status === s).length;
          const style = STATUS_STYLES[s];
          return (
            <div
              key={s}
              className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-4"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}
                >
                  {style.label}
                </span>
              </div>
              <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mt-2">{count}</p>
            </div>
          );
        })}
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
            <Package size={15} className="text-[#ffd700]" />
            Deliverables
          </h2>
          <button
            onClick={() => setShowAdd((v) => !v)}
            className="inline-flex items-center gap-1 text-xs font-medium text-[#ffd700] hover:text-[#ffd700]"
          >
            <Plus size={13} /> Add deliverable
          </button>
        </div>

        {showAdd && <AddDeliverableForm onAdd={add} onCancel={() => setShowAdd(false)} />}

        {deliverables.length === 0 && !showAdd ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">No deliverables tracked yet.</p>
            <button
              onClick={() => setShowAdd(true)}
              className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[#ffd700] hover:text-[#ffd700]"
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
                shots={shots}
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
  shots,
  onUpdate,
  onCycleStatus,
  onRemove,
}: {
  deliverable: ProductionDeliverable;
  shots: ShotOption[];
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
    <div className="px-5 py-3 hover:bg-amber-50/20 group">
    <div className="grid grid-cols-12 gap-3 items-center">
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
          className="text-sm font-medium text-gray-900 dark:text-gray-100 bg-transparent border-none outline-none w-full px-1 py-0.5 rounded-md focus:bg-white dark:focus:bg-gray-900"
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
          className="text-xs text-gray-600 dark:text-gray-400 bg-transparent border-none outline-none w-full px-1 py-0.5 rounded-md focus:bg-white dark:focus:bg-gray-900"
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
          className="text-xs text-gray-600 dark:text-gray-400 bg-transparent border-none outline-none w-full px-1 py-0.5 rounded-md focus:bg-white dark:focus:bg-gray-900"
        />
      </div>
      <div className="col-span-2 flex items-center justify-end gap-2">
        {deliverable.url && (
          <a
            href={deliverable.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-[#ffd700]"
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
      <div className="mt-2 pl-[calc(8.333%+0.75rem)]">
        <LinkedShotsPicker
          shots={shots}
          selected={deliverable.linkedShots ?? []}
          onChange={(next) => onUpdate({ linkedShots: next })}
          accent="#ffd700"
        />
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
        className="md:col-span-2 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ffd700]/30 focus:border-[#ffd700]"
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
        className="md:col-span-4 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ffd700]/30 focus:border-[#ffd700]"
      />
      <input
        type="date"
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
        className="md:col-span-2 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ffd700]/30 focus:border-[#ffd700]"
      />
      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="URL"
        className="md:col-span-3 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ffd700]/30 focus:border-[#ffd700]"
      />
      <div className="md:col-span-1 flex items-center gap-1 justify-end">
        <button
          onClick={submit}
          className="bg-[#ffd700] text-black text-xs font-medium px-3 py-2 rounded-xl hover:bg-[#ffd700] transition-colors"
        >
          Add
        </button>
        <button
          onClick={onCancel}
          className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-400 px-2 py-2"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
