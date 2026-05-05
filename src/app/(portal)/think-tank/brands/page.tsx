"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Loader2, Minus, Plus, Sparkles, Trash2 } from "lucide-react";

interface Brand {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  keywords: string[];
  signalCount: number;
  heatScore: number;
  trajectory: string;
  notes: string | null;
}

function heatTone(score: number): { bg: string; text: string; bar: string; label: string } {
  if (score >= 70) return { bg: "bg-emerald-50", text: "text-emerald-700", bar: "bg-emerald-500", label: "Hot" };
  if (score >= 40) return { bg: "bg-amber-50", text: "text-amber-800", bar: "bg-[#D4A853]", label: "Warm" };
  return { bg: "bg-gray-100", text: "text-gray-500", bar: "bg-gray-300", label: "Cold" };
}

function trajectoryTone(t: string): { icon: React.ReactNode; color: string; label: string } {
  if (t === "rising") return { icon: <ArrowUpRight className="h-3 w-3" />, color: "text-emerald-600", label: "Rising" };
  if (t === "cooling") return { icon: <ArrowDownRight className="h-3 w-3" />, color: "text-rose-500", label: "Cooling" };
  return { icon: <Minus className="h-3 w-3" />, color: "text-gray-500", label: "Stable" };
}

export default function BrandWatchlistPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [pitchPreview, setPitchPreview] = useState<{ title: string; content: string } | null>(null);

  const [form, setForm] = useState({ name: "", category: "", keywords: "", description: "" });

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/think-tank/brands", { cache: "no-store" });
      const data = await res.json();
      setBrands(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/think-tank/brands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          category: form.category.trim() || null,
          keywords: form.keywords,
          description: form.description.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to add brand");
      } else {
        setForm({ name: "", category: "", keywords: "", description: "" });
        setShowForm(false);
        await load();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add brand");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this brand from the watchlist?")) return;
    await fetch(`/api/think-tank/brands/${id}`, { method: "DELETE" });
    setBrands((prev) => prev.filter((b) => b.id !== id));
  }

  async function handleGeneratePitch(brand: Brand) {
    setGeneratingId(brand.id);
    setError(null);
    try {
      const res = await fetch("/api/think-tank/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "brand_pitch", brandId: brand.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to generate pitch");
      } else {
        setPitchPreview({ title: data.title, content: data.content });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate pitch");
    } finally {
      setGeneratingId(null);
    }
  }

  return (
    <div className="flex h-full flex-col font-[family-name:var(--font-manrope)]">
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Brand Watchlist</h1>
          <p className="text-xs text-gray-500">Track the brands moving the culture.</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 rounded-lg bg-[#7B5BD6] px-3 py-2 text-xs font-semibold text-white hover:bg-[#6A4BC4] transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          {showForm ? "Cancel" : "Add Brand"}
        </button>
      </div>

      {error && (
        <div className="border-b border-rose-200 bg-rose-50 px-6 py-2 text-xs text-rose-700">{error}</div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="border-b border-gray-100 bg-white px-6 py-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Brand name *</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs focus:border-[#7B5BD6] focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Category</label>
              <input
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                placeholder="fashion, luxury, beauty…"
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs focus:border-[#7B5BD6] focus:outline-none"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Keywords (comma-separated)</label>
              <input
                value={form.keywords}
                onChange={(e) => setForm((f) => ({ ...f, keywords: e.target.value }))}
                placeholder="e.g. denim, archive, runway, jacquemus"
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs focus:border-[#7B5BD6] focus:outline-none"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs focus:border-[#7B5BD6] focus:outline-none"
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="submit"
              disabled={submitting || !form.name.trim()}
              className="rounded-lg bg-[#7B5BD6] px-3 py-2 text-xs font-semibold text-white hover:bg-[#6A4BC4] disabled:opacity-50"
            >
              {submitting ? "Saving…" : "Add brand"}
            </button>
          </div>
        </form>
      )}

      <div className="flex-1 overflow-y-auto bg-gray-50 px-6 py-5">
        {loading ? (
          <div className="flex h-40 items-center justify-center text-xs text-gray-400">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading brands…
          </div>
        ) : brands.length === 0 ? (
          <div className="mx-auto mt-12 max-w-md rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center">
            <p className="text-sm font-semibold text-gray-900">No brands tracked yet</p>
            <p className="mt-1 text-xs text-gray-500">Add brands to see how they move across cultural signals.</p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#7B5BD6] px-3 py-2 text-xs font-semibold text-white hover:bg-[#6A4BC4]"
            >
              <Plus className="h-3.5 w-3.5" />
              Add your first brand
            </button>
          </div>
        ) : (
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {brands.map((b) => {
              const heat = heatTone(b.heatScore);
              const traj = trajectoryTone(b.trajectory);
              return (
                <div key={b.id} className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-gray-900">{b.name}</h3>
                      {b.category && (
                        <span className="mt-0.5 inline-block rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-medium text-purple-700">
                          {b.category}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleDelete(b.id)}
                      className="text-gray-300 hover:text-rose-500"
                      title="Remove"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <div className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${heat.bg} ${heat.text}`}>
                      <span>Heat {b.heatScore}</span>
                      <span className="opacity-60">· {heat.label}</span>
                    </div>
                    <div className={`flex items-center gap-1 text-[10px] font-medium ${traj.color}`}>
                      {traj.icon}
                      {traj.label}
                    </div>
                  </div>

                  <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                    <div className={`h-full ${heat.bar}`} style={{ width: `${Math.min(100, Math.max(0, b.heatScore))}%` }} />
                  </div>

                  <p className="text-[11px] text-gray-500">
                    {b.signalCount} signal{b.signalCount === 1 ? "" : "s"}
                  </p>

                  {b.keywords.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {b.keywords.slice(0, 5).map((k) => (
                        <span key={k} className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600">
                          {k}
                        </span>
                      ))}
                      {b.keywords.length > 5 && (
                        <span className="text-[10px] text-gray-400">+{b.keywords.length - 5}</span>
                      )}
                    </div>
                  )}

                  <button
                    onClick={() => handleGeneratePitch(b)}
                    disabled={generatingId === b.id}
                    className="mt-auto flex items-center justify-center gap-2 rounded-lg border border-[#7B5BD6]/30 bg-[#7B5BD6]/5 px-3 py-1.5 text-[11px] font-semibold text-[#7B5BD6] hover:bg-[#7B5BD6]/10 disabled:opacity-50"
                  >
                    {generatingId === b.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Sparkles className="h-3 w-3" />
                    )}
                    Generate Pitch Brief
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {pitchPreview && <PitchPreview title={pitchPreview.title} content={pitchPreview.content} onClose={() => setPitchPreview(null)} />}
    </div>
  );
}

function PitchPreview({ title, content, onClose }: { title: string; content: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative z-10 flex w-[520px] max-w-full flex-col bg-white shadow-2xl border-l border-gray-200">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-gray-900 truncate">{title}</h2>
          <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600">
            Close
          </button>
        </div>
        <div className="flex-1 overflow-auto px-6 py-5 text-sm text-gray-800">
          <pre className="whitespace-pre-wrap font-[family-name:var(--font-manrope)] text-xs leading-relaxed">{content}</pre>
        </div>
      </div>
    </div>
  );
}
