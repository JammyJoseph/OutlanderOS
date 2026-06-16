"use client";

import { useState } from "react";
import {
  Plus,
  Trash2,
  CalendarDays,
  PackageCheck,
  Loader2,
  AlertTriangle,
  Lock,
  CheckCircle2,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { formatMoney } from "../../_components/deal-ui";

export interface Deliverable {
  id: string;
  title: string | null;
  type: string;
  quantity: number;
  description: string | null;
  dueDate: string | null;
  status: string;
  isAdditional: boolean;
  overageCost: number | null;
  approvedBy: string | null;
  approvedAt: string | null;
  postedUrl: string | null;
  scheduleStatus?: string;
}

const DELIVERABLE_TYPES = ["Content", "Print", "Digital", "Event", "Other"];

const STATUSES = [
  { key: "PENDING", label: "Pending", bg: "bg-gray-100", text: "text-gray-600" },
  { key: "IN_PROGRESS", label: "In Progress", bg: "bg-amber-100", text: "text-amber-700" },
  { key: "DELIVERED", label: "Delivered", bg: "bg-emerald-100", text: "text-emerald-700" },
];

function statusStyle(s: string) {
  return STATUSES.find((x) => x.key === s) ?? STATUSES[0];
}

export default function DeliverablesTab({
  dealId,
  initial,
  dealValue,
  contractedLocked,
  dealSigned,
  isAdmin,
  onChanged,
}: {
  dealId: string;
  initial: Deliverable[];
  dealValue: number | null;
  contractedLocked: boolean; // deal past IO_SIGNED
  dealSigned: boolean;
  isAdmin: boolean;
  onChanged: () => Promise<void>;
}) {
  const [items, setItems] = useState<Deliverable[]>(initial);
  const [error, setError] = useState<string | null>(null);

  const contracted = items.filter((d) => !d.isAdditional);
  const additional = items.filter((d) => d.isAdditional);
  const totalOverage = additional.reduce((s, d) => s + (d.overageCost ?? 0), 0);
  const contractedValue = dealValue ?? 0;

  async function create(payload: Record<string, unknown>) {
    setError(null);
    const res = await fetch(`/api/commercial/deals/${dealId}/deliverables`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const created = await res.json();
      setItems((prev) => [...prev, created]);
      onChanged();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to add deliverable");
    }
  }

  async function patch(item: Deliverable, data: Record<string, unknown>) {
    setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, ...data } : x)));
    await fetch(`/api/commercial/deals/${dealId}/deliverables/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    onChanged();
  }

  async function remove(item: Deliverable) {
    setItems((prev) => prev.filter((x) => x.id !== item.id));
    await fetch(`/api/commercial/deals/${dealId}/deliverables/${item.id}`, { method: "DELETE" });
    onChanged();
  }

  const canAddContracted = !contractedLocked || isAdmin;

  return (
    <div className="space-y-5 max-w-3xl">
      {error && (
        <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-2.5">{error}</p>
      )}

      {/* ── Contracted ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <PackageCheck size={15} className="text-[#ffd700]" />
            Contracted Deliverables
          </h3>
          {contractedLocked && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">
              <Lock size={11} /> Locked after IO signed{isAdmin ? " — admin override" : ""}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400 mb-4">What was agreed with the client at sign-off.</p>

        {contracted.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 py-7 text-center text-sm text-gray-400 mb-4">
            No contracted deliverables yet.
          </div>
        ) : (
          <div className="space-y-2 mb-4">
            {contracted.map((d) => (
              <DeliverableRow
                key={d.id}
                d={d}
                onPatch={(data) => patch(d, data)}
                onRemove={() => remove(d)}
                locked={contractedLocked && !isAdmin}
              />
            ))}
          </div>
        )}

        {canAddContracted ? (
          <AddDeliverableForm onAdd={(p) => create({ ...p, isAdditional: false })} />
        ) : (
          <p className="text-xs text-gray-400 italic">
            Contracted deliverables are locked once the deal passes IO Signed. Add extra work as an
            Additional deliverable below.
          </p>
        )}
      </div>

      {/* ── Additional (scope creep) ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 border-l-4 border-l-amber-400">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <AlertTriangle size={15} className="text-amber-500" />
            Additional Deliverables
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
              Scope Creep
            </span>
          </h3>
          {totalOverage > 0 && (
            <span className="text-sm font-bold text-amber-700 tabular-nums">
              +{formatMoney(totalOverage)} overage
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400 mb-4">
          Extra work the client asked for after sign-off — billed on top of the contracted deal.
        </p>

        {additional.length === 0 ? (
          <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50/30 py-7 text-center text-sm text-amber-700/70 mb-4">
            No additional deliverables. Add one when the client expands the scope.
          </div>
        ) : (
          <div className="space-y-2 mb-4">
            {additional.map((d) => (
              <AdditionalRow key={d.id} d={d} onPatch={(data) => patch(d, data)} onRemove={() => remove(d)} />
            ))}
          </div>
        )}

        {dealSigned ? (
          <AddDeliverableForm additional onAdd={(p) => create({ ...p, isAdditional: true })} />
        ) : (
          <p className="text-xs text-gray-400 italic">
            Additional deliverables can be added once the deal is signed.
          </p>
        )}
      </div>

      {/* ── Totals ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h3 className="text-sm font-semibold text-gray-800 mb-3">Deal value</h3>
        <dl className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-gray-500">Contracted value</dt>
            <dd className="font-semibold text-gray-900 tabular-nums">{formatMoney(contractedValue)}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-amber-600">Additional (scope creep)</dt>
            <dd className="font-semibold text-amber-700 tabular-nums">+{formatMoney(totalOverage)}</dd>
          </div>
          <div className="flex items-center justify-between border-t border-gray-100 pt-2 mt-1">
            <dt className="font-semibold text-gray-800">Total with additions</dt>
            <dd className="text-lg font-bold text-emerald-600 tabular-nums">
              {formatMoney(contractedValue + totalOverage)}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

function DeliverableRow({
  d,
  onPatch,
  onRemove,
  locked,
}: {
  d: Deliverable;
  onPatch: (data: Record<string, unknown>) => void;
  onRemove: () => void;
  locked: boolean;
}) {
  const st = statusStyle(d.status);
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-100 px-4 py-3 hover:bg-gray-50/60 transition-colors group">
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${d.status === "DELIVERED" ? "text-gray-400 line-through" : "text-gray-800"}`}>
          {d.title || d.type}
          {d.quantity > 1 && <span className="text-gray-400 font-normal"> ×{d.quantity}</span>}
        </p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
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
        onChange={(e) => onPatch({ status: e.target.value })}
        className={`text-[11px] font-semibold rounded-full px-2.5 py-1 cursor-pointer focus:outline-none ${st.bg} ${st.text}`}
      >
        {STATUSES.map((s) => (
          <option key={s.key} value={s.key}>
            {s.label}
          </option>
        ))}
      </select>
      {!locked && (
        <button
          onClick={onRemove}
          className="p-1.5 rounded-lg text-gray-200 hover:text-red-500 hover:bg-red-50 transition-colors"
          title="Remove"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}

function AdditionalRow({
  d,
  onPatch,
  onRemove,
}: {
  d: Deliverable;
  onPatch: (data: Record<string, unknown>) => void;
  onRemove: () => void;
}) {
  const st = statusStyle(d.status);
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/40 px-4 py-3 group">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${d.status === "DELIVERED" ? "text-gray-400 line-through" : "text-gray-800"}`}>
            {d.title || d.type}
            {d.quantity > 1 && <span className="text-gray-400 font-normal"> ×{d.quantity}</span>}
            <span className="ml-2 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-200 text-amber-800">
              Additional
            </span>
          </p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-white text-gray-500">
              {d.type}
            </span>
            {d.dueDate && (
              <span className="text-[11px] text-gray-400 flex items-center gap-1">
                <CalendarDays size={11} /> {format(parseISO(d.dueDate), "d MMM yyyy")}
              </span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-base font-bold text-amber-700 tabular-nums">+{formatMoney(d.overageCost)}</p>
          <p className="text-[10px] text-gray-400">overage cost</p>
        </div>
        <select
          value={d.status}
          onChange={(e) => onPatch({ status: e.target.value })}
          className={`text-[11px] font-semibold rounded-full px-2.5 py-1 cursor-pointer focus:outline-none ${st.bg} ${st.text}`}
        >
          {STATUSES.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
        <button
          onClick={onRemove}
          className="p-1.5 rounded-lg text-gray-200 hover:text-red-500 hover:bg-red-50 transition-colors"
          title="Remove"
        >
          <Trash2 size={14} />
        </button>
      </div>
      <div className="mt-2 pt-2 border-t border-amber-100 flex items-center gap-2 text-[11px] text-gray-500">
        {d.approvedBy ? (
          <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
            <CheckCircle2 size={12} /> Approved by {d.approvedBy}
            {d.approvedAt && ` · ${format(parseISO(d.approvedAt), "d MMM")}`}
          </span>
        ) : (
          <span className="text-amber-600">Awaiting approval</span>
        )}
      </div>
    </div>
  );
}

function AddDeliverableForm({
  onAdd,
  additional = false,
}: {
  onAdd: (payload: Record<string, unknown>) => void;
  additional?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState("Content");
  const [quantity, setQuantity] = useState("1");
  const [dueDate, setDueDate] = useState("");
  const [overage, setOverage] = useState("");
  const [approvedBy, setApprovedBy] = useState("");
  const [busy, setBusy] = useState(false);

  const accent = additional ? "amber" : "[#ffd700]";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    try {
      await onAdd({
        title: title.trim(),
        type,
        quantity: Number(quantity) || 1,
        dueDate: dueDate || null,
        ...(additional ? { overageCost: overage === "" ? null : Number(overage), approvedBy: approvedBy.trim() || null } : {}),
      });
      setTitle("");
      setQuantity("1");
      setDueDate("");
      setOverage("");
      setApprovedBy("");
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1.5 text-sm font-medium ${
          additional ? "text-amber-700 hover:text-amber-800" : "text-[#e6c200] hover:text-[#ffd700]"
        }`}
      >
        <Plus size={14} /> Add {additional ? "Additional" : "Contracted"} Deliverable
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className={`rounded-xl border p-3.5 space-y-2.5 ${additional ? "border-amber-200 bg-amber-50/40" : "border-gray-100 bg-gray-50/40"}`}
    >
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (e.g. Instagram Reel)"
          className="sm:col-span-6 px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400/30"
          autoFocus
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="sm:col-span-3 px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none cursor-pointer"
        >
          {DELIVERABLE_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <input
          type="number"
          min="1"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder="Qty"
          className="sm:col-span-3 px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none"
          title="Quantity"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="sm:col-span-4 px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none"
        />
        {additional && (
          <>
            <div className="sm:col-span-4 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">£</span>
              <input
                type="number"
                min="0"
                value={overage}
                onChange={(e) => setOverage(e.target.value)}
                placeholder="Overage cost"
                className="w-full pl-7 pr-3 py-2 rounded-xl border border-amber-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400/30"
              />
            </div>
            <input
              type="text"
              value={approvedBy}
              onChange={(e) => setApprovedBy(e.target.value)}
              placeholder="Approved by"
              className="sm:col-span-4 px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none"
            />
          </>
        )}
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-gray-400 hover:text-gray-600 px-3 py-2"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!title.trim() || busy}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 ${
            additional ? "bg-amber-500 text-white hover:bg-amber-600" : "bg-[#ffd700] text-black hover:bg-[#e6c200]"
          }`}
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Add
        </button>
      </div>
    </form>
  );
}
