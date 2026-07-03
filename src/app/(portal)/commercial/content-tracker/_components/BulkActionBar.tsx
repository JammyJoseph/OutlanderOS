"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { POST_TYPES, PipelineCard } from "./types";

interface Props {
  selectedIds: string[];
  campaigns: PipelineCard[];
  onClear: () => void;
  onComplete: () => void;
}

export default function BulkActionBar({ selectedIds, campaigns, onClear, onComplete }: Props) {
  const [brand, setBrand] = useState("");
  const [postType, setPostType] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function apply(payload: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/content-tracker/bulk-tag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postIds: selectedIds, ...payload }),
      });
      if (!res.ok) throw new Error(`Bulk tag failed (${res.status})`);
      onComplete();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sticky bottom-4 z-30 mx-auto flex max-w-4xl flex-wrap items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 shadow-lg">
      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{selectedIds.length} selected</span>

      <div className="mx-1 h-5 w-px bg-gray-200 dark:bg-gray-700" />

      <input
        value={brand}
        onChange={(e) => setBrand(e.target.value)}
        placeholder="Tag brand…"
        className="w-32 rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1.5 text-sm outline-none focus:border-amber-400"
      />
      <button
        onClick={() => brand.trim() && apply({ brand: brand.trim() })}
        disabled={busy || !brand.trim()}
        className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-50"
      >
        Tag
      </button>

      <div className="mx-1 h-5 w-px bg-gray-200 dark:bg-gray-700" />

      <select
        value={postType}
        onChange={(e) => setPostType(e.target.value)}
        className="rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1.5 text-sm outline-none focus:border-amber-400"
      >
        <option value="">Set type…</option>
        {POST_TYPES.map((t) => (
          <option key={t} value={t}>
            {t.charAt(0) + t.slice(1).toLowerCase()}
          </option>
        ))}
      </select>
      <button
        onClick={() => postType && apply({ postType })}
        disabled={busy || !postType}
        className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-50"
      >
        Set
      </button>

      <div className="mx-1 h-5 w-px bg-gray-200 dark:bg-gray-700" />

      <select
        value={campaignId}
        onChange={(e) => setCampaignId(e.target.value)}
        className="max-w-[200px] rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1.5 text-sm outline-none focus:border-amber-400"
      >
        <option value="">Assign campaign…</option>
        {campaigns.map((c) => (
          <option key={c.id} value={c.id}>
            {c.client ? `${c.client} · ${c.name}` : c.name}
          </option>
        ))}
      </select>
      <button
        onClick={() => {
          if (!campaignId) return;
          const c = campaigns.find((x) => x.id === campaignId);
          apply({ campaignId, campaignName: c?.name ?? null });
        }}
        disabled={busy || !campaignId}
        className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-50"
      >
        Assign
      </button>

      <div className="ml-auto flex items-center gap-2">
        {error && <span className="text-xs text-rose-600">{error}</span>}
        <button
          onClick={onClear}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <X className="h-3.5 w-3.5" /> Clear
        </button>
      </div>
    </div>
  );
}
