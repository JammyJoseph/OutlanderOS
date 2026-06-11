"use client";

import { useState, useEffect } from "react";
import { X, Loader2, Palette, Package } from "lucide-react";
import { DEAL_TYPE_OPTIONS, TYPE_STYLES, type Deal, type WorkflowType } from "./deal-ui";

interface ClientOption {
  id: string;
  name: string;
}

export default function NewDealModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (deal: Deal) => void;
}) {
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [workflowType, setWorkflowType] = useState<WorkflowType | null>(null);
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState("");
  const [newClientName, setNewClientName] = useState("");
  const [value, setValue] = useState("");
  const [dealTypes, setDealTypes] = useState<string[]>(["PARTNERSHIP"]);
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");

  function toggleType(t: string) {
    setDealTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  useEffect(() => {
    fetch("/api/clients")
      .then((r) => r.json())
      .then((d) => setClients(Array.isArray(d) ? d : []))
      .catch(() => setClients([]));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    if (!workflowType) {
      setError("Pick what type of job this is first");
      return;
    }
    if (clientId === "__new__" ? !newClientName.trim() : !clientId) {
      setError("Pick a client or enter a new one");
      return;
    }
    if (dealTypes.length === 0) {
      setError("Pick at least one deal type");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflowType,
          title: title.trim(),
          clientId: clientId === "__new__" ? undefined : clientId,
          clientName: clientId === "__new__" ? newClientName.trim() : undefined,
          value: value || null,
          dealTypes,
          description: description.trim() || null,
          dueDate: dueDate || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create deal");
        return;
      }
      onCreated(data);
    } catch {
      setError("Failed to create deal");
    } finally {
      setCreating(false);
    }
  }

  const inputCls =
    "w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4A853]/30 focus:border-[#D4A853]";
  const labelCls = "block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-50 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-lg font-semibold text-gray-900">New Deal</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleCreate} className="px-6 py-5 space-y-4">
          <div>
            <label className={labelCls}>
              What type of job is this? <span className="text-red-400">*</span>
            </label>
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => setWorkflowType("CREATIVE_BRIEF")}
                className={`w-full text-left rounded-xl border p-3.5 transition-all ${
                  workflowType === "CREATIVE_BRIEF"
                    ? "border-purple-400 ring-2 ring-purple-400/20 bg-purple-50/50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
                    <Palette size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Creative Brief</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Needs a creative response, client approval, then production. The main
                      workflow.
                    </p>
                  </div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setWorkflowType("SUPPLIED_ASSETS")}
                className={`w-full text-left rounded-xl border p-3.5 transition-all ${
                  workflowType === "SUPPLIED_ASSETS"
                    ? "border-gray-400 ring-2 ring-gray-400/20 bg-gray-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center shrink-0">
                    <Package size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Supplied Assets</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Client provides the content — no creative or production needed. Simpler
                      path.
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </div>

          <div>
            <label className={labelCls}>
              Deal Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. SS26 Launch Partnership"
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>
              Client <span className="text-red-400">*</span>
            </label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className={`${inputCls} bg-white`}
            >
              <option value="">Select a client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              <option value="__new__">+ New client…</option>
            </select>
            {clientId === "__new__" && (
              <input
                type="text"
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                placeholder="New client name"
                className={`${inputCls} mt-2`}
              />
            )}
          </div>

          <div>
            <label className={labelCls}>Value (£)</label>
            <input
              type="number"
              min="0"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="0"
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>
              Deal Types <span className="text-red-400">*</span>
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {DEAL_TYPE_OPTIONS.map((t) => {
                const style = TYPE_STYLES[t];
                const checked = dealTypes.includes(t);
                return (
                  <label
                    key={t}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm cursor-pointer transition-colors ${
                      checked
                        ? "border-[#D4A853] bg-amber-50/50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleType(t)}
                      className="h-3.5 w-3.5 rounded border-gray-300 accent-[#D4A853]"
                    />
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}
                    >
                      {style.label}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <label className={labelCls}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="What's the deal? Scope, deliverables, context…"
              className={`${inputCls} resize-none`}
            />
          </div>

          <div>
            <label className={labelCls}>Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={inputCls}
            />
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim() || !workflowType || dealTypes.length === 0 || creating}
              className="flex-1 flex items-center justify-center gap-2 bg-[#D4A853] text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-[#c49843] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? <Loader2 size={15} className="animate-spin" /> : null}
              Create Deal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
