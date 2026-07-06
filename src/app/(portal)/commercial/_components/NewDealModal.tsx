"use client";

import { useState, useEffect } from "react";
import { X, Loader2, Palette, Package, Newspaper, ArrowLeft } from "lucide-react";
import { TYPE_STYLES, type Deal } from "./deal-ui";
import { JOB_TYPE_CONFIG, type JobTypeValue } from "@/lib/deal-stages";

interface ClientOption {
  id: string;
  name: string;
}

const JOB_TYPE_CARDS: {
  key: JobTypeValue;
  icon: React.ReactNode;
  accent: string; // selected ring/border
  iconBg: string;
  blurb: string;
}[] = [
  {
    key: "CREATIVE_BRIEF",
    icon: <Palette size={18} />,
    accent: "border-purple-400 ring-2 ring-purple-400/20 bg-purple-50/50 dark:bg-purple-900/30",
    iconBg: "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400",
    blurb: "Bespoke content that needs a creative response. The main workflow.",
  },
  {
    key: "SUPPLIED_ASSETS",
    icon: <Package size={18} />,
    accent: "border-gray-400 ring-2 ring-gray-400/20 bg-gray-50 dark:bg-gray-800",
    iconBg: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400",
    blurb: "Client provides the content — no creative response needed.",
  },
  {
    key: "PRINT_AD",
    icon: <Newspaper size={18} />,
    accent: "border-teal-400 ring-2 ring-teal-400/20 bg-teal-50/50 dark:bg-teal-900/30",
    iconBg: "bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400",
    blurb: "Print advertising — straight to the media plan.",
  },
];

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

  const [jobType, setJobType] = useState<JobTypeValue | null>(null);
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState("");
  const [newClientName, setNewClientName] = useState("");
  const [extensions, setExtensions] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/clients")
      .then((r) => r.json())
      .then((d) => setClients(Array.isArray(d) ? d : []))
      .catch(() => setClients([]));
  }, []);

  function pickJobType(t: JobTypeValue) {
    setJobType(t);
    setExtensions([]);
    setError(null);
  }

  function toggleExtension(e: string) {
    setExtensions((prev) => (prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]));
  }

  async function handleCreate(ev: React.FormEvent) {
    ev.preventDefault();
    if (!jobType) return;
    if (!title.trim()) {
      setError("Give the deal a title");
      return;
    }
    if (clientId === "__new__" ? !newClientName.trim() : !clientId) {
      setError("Pick a client or enter a new one");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobType,
          extensions,
          title: title.trim(),
          clientId: clientId === "__new__" ? undefined : clientId,
          clientName: clientId === "__new__" ? newClientName.trim() : undefined,
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
    "w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-[#9C7C2E]/30 focus:border-[#9C7C2E]";
  const labelCls = "block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5";

  const cfg = jobType ? JOB_TYPE_CONFIG[jobType] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-50 dark:border-gray-800 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-2">
            {jobType && (
              <button
                onClick={() => setJobType(null)}
                className="p-1.5 -ml-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
                title="Back to job type"
              >
                <ArrowLeft size={16} />
              </button>
            )}
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {jobType ? "Deal details" : "New Deal"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Step 1 — choose the job type */}
        {!jobType && (
          <div className="px-6 py-5 space-y-3">
            <p className="text-sm text-gray-500 dark:text-gray-400">What type of job is this?</p>
            {JOB_TYPE_CARDS.map((card) => {
              const c = JOB_TYPE_CONFIG[card.key];
              return (
                <button
                  key={card.key}
                  type="button"
                  onClick={() => pickJobType(card.key)}
                  className="w-full text-left rounded-xl border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 p-4 transition-all"
                >
                  <div className="flex items-center gap-3.5">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${card.iconBg}`}
                    >
                      {card.icon}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{c.label}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{card.blurb}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Step 2 — basic details */}
        {jobType && cfg && (
          <form onSubmit={handleCreate} className="px-6 py-5 space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 dark:text-gray-500">Job type:</span>
              <span
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                  JOB_TYPE_CARDS.find((c) => c.key === jobType)?.iconBg ?? "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                }`}
              >
                {cfg.label}
              </span>
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
                autoFocus
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
                className={`${inputCls} bg-white dark:bg-gray-900`}
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

            {cfg.extensions.length > 0 && (
              <div>
                <label className={labelCls}>Extensions</label>
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-2">
                  Add-ons for this job. Optional — tick any that apply.
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {cfg.extensions.map((ext) => {
                    const style = TYPE_STYLES[ext] ?? { label: ext, bg: "bg-gray-50 dark:bg-gray-800", text: "text-gray-600 dark:text-gray-400" };
                    const checked = extensions.includes(ext);
                    return (
                      <label
                        key={ext}
                        className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm cursor-pointer transition-colors ${
                          checked ? "border-[#9C7C2E] bg-amber-50/50 dark:bg-amber-900/30" : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleExtension(ext)}
                          className="h-3.5 w-3.5 rounded border-gray-300 dark:border-gray-600 accent-[#9C7C2E]"
                        />
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}>
                          {style.label}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {error && <p className="text-sm text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/30 rounded-lg px-3 py-2">{error}</p>}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setJobType(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={!title.trim() || creating}
                className="flex-1 flex items-center justify-center gap-2 bg-[#9C7C2E] text-black px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-[#9C7C2E] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? <Loader2 size={15} className="animate-spin" /> : null}
                Create Deal
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
