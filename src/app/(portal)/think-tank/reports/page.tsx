"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Calendar, FileText, Loader2, Sparkles } from "lucide-react";

interface Report {
  id: string;
  title: string;
  type: string;
  content: string;
  period: string | null;
  brandId: string | null;
  generatedBy: string;
  createdAt: string;
}

interface Brand {
  id: string;
  name: string;
}

const TYPE_TONE: Record<string, string> = {
  weekly: "bg-purple-50 text-purple-700",
  monthly: "bg-indigo-50 text-indigo-700",
  brand_pitch: "bg-amber-50 text-amber-800",
  custom: "bg-gray-100 text-gray-700",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function renderMarkdown(md: string): React.ReactNode[] {
  const lines = md.split(/\r?\n/);
  const nodes: React.ReactNode[] = [];
  let listBuf: string[] = [];

  function flushList(key: number) {
    if (!listBuf.length) return;
    nodes.push(
      <ul key={`ul-${key}`} className="my-2 list-disc space-y-1 pl-5 text-sm text-gray-700">
        {listBuf.map((l, i) => (
          <li key={i}>{renderInline(l)}</li>
        ))}
      </ul>,
    );
    listBuf = [];
  }

  function renderInline(text: string): React.ReactNode {
    const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g).filter(Boolean);
    return parts.map((p, i) => {
      if (p.startsWith("**") && p.endsWith("**")) return <strong key={i}>{p.slice(2, -2)}</strong>;
      if (p.startsWith("*") && p.endsWith("*")) return <em key={i}>{p.slice(1, -1)}</em>;
      if (p.startsWith("`") && p.endsWith("`")) return (
        <code key={i} className="rounded bg-gray-100 px-1 py-0.5 text-[11px]">
          {p.slice(1, -1)}
        </code>
      );
      return <span key={i}>{p}</span>;
    });
  }

  lines.forEach((raw, idx) => {
    const line = raw.trimEnd();
    if (/^\s*[-*]\s+/.test(line)) {
      listBuf.push(line.replace(/^\s*[-*]\s+/, ""));
      return;
    }
    flushList(idx);
    if (!line.trim()) {
      nodes.push(<div key={`sp-${idx}`} className="h-2" />);
      return;
    }
    if (line.startsWith("### ")) {
      nodes.push(
        <h3 key={idx} className="mt-4 text-sm font-semibold text-[#E67E22]">
          {line.slice(4)}
        </h3>,
      );
      return;
    }
    if (line.startsWith("## ")) {
      nodes.push(
        <h2 key={idx} className="mt-5 border-l-2 border-[#D4A853] pl-2 text-base font-semibold text-gray-900">
          {line.slice(3)}
        </h2>,
      );
      return;
    }
    if (line.startsWith("# ")) {
      nodes.push(
        <h1 key={idx} className="mt-6 text-lg font-bold text-gray-900">
          {line.slice(2)}
        </h1>,
      );
      return;
    }
    nodes.push(
      <p key={idx} className="text-sm leading-relaxed text-gray-700">
        {renderInline(line)}
      </p>,
    );
  });

  flushList(lines.length);
  return nodes;
}

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<"weekly" | "monthly" | "brand" | null>(null);
  const [selected, setSelected] = useState<Report | null>(null);
  const [selectedBrandId, setSelectedBrandId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [r, b] = await Promise.allSettled([
        fetch("/api/think-tank/reports", { cache: "no-store" }).then((res) => res.json()),
        fetch("/api/think-tank/brands", { cache: "no-store" }).then((res) => res.json()),
      ]);
      setReports(r.status === "fulfilled" && Array.isArray(r.value) ? r.value : []);
      setBrands(b.status === "fulfilled" && Array.isArray(b.value) ? b.value : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleGenerate(type: "weekly" | "monthly" | "brand_pitch", brandId?: string) {
    setGenerating(type === "brand_pitch" ? "brand" : type);
    setError(null);
    try {
      const res = await fetch("/api/think-tank/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(type === "brand_pitch" ? { type, brandId } : { type }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to generate report");
      } else {
        await load();
        setSelected(data);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate report");
    } finally {
      setGenerating(null);
    }
  }

  const sortedReports = useMemo(
    () => [...reports].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [reports],
  );

  return (
    <div className="flex h-full flex-col font-[family-name:var(--font-manrope)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white px-6 py-3">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Reports</h1>
          <p className="text-xs text-gray-500">Synthesised cultural intelligence, on tap.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleGenerate("weekly")}
            disabled={generating !== null}
            className="flex items-center gap-2 rounded-lg bg-[#E67E22] px-3 py-2 text-xs font-semibold text-white hover:bg-[#CF6D14] disabled:opacity-50"
          >
            {generating === "weekly" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Generate Weekly
          </button>
          <button
            onClick={() => handleGenerate("monthly")}
            disabled={generating !== null}
            className="flex items-center gap-2 rounded-lg border border-[#E67E22]/30 bg-white px-3 py-2 text-xs font-semibold text-[#E67E22] hover:bg-[#E67E22]/5 disabled:opacity-50"
          >
            {generating === "monthly" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Generate Monthly
          </button>
          <div className="flex items-center gap-1.5">
            <select
              value={selectedBrandId}
              onChange={(e) => setSelectedBrandId(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs focus:border-[#E67E22] focus:outline-none"
            >
              <option value="">Brand pitch…</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => selectedBrandId && handleGenerate("brand_pitch", selectedBrandId)}
              disabled={!selectedBrandId || generating !== null}
              className="flex items-center gap-1.5 rounded-lg bg-[#D4A853] px-3 py-2 text-xs font-semibold text-white hover:bg-[#C49843] disabled:opacity-50"
            >
              {generating === "brand" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Brief
            </button>
          </div>
        </div>
      </div>

      {error && <div className="border-b border-rose-200 bg-rose-50 px-6 py-2 text-xs text-rose-700">{error}</div>}

      <div className="flex flex-1 overflow-hidden bg-gray-50">
        <aside className="w-[320px] shrink-0 border-r border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            All Reports
          </div>
          <div className="h-full overflow-y-auto pb-20">
            {loading ? (
              <div className="flex h-40 items-center justify-center text-xs text-gray-400">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading…
              </div>
            ) : sortedReports.length === 0 ? (
              <div className="px-4 py-6 text-xs text-gray-500">
                No reports yet. Generate your first weekly to see Outlander&apos;s view of the cultural moment.
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {sortedReports.map((r) => (
                  <li key={r.id}>
                    <button
                      onClick={() => setSelected(r)}
                      className={`flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-gray-50 ${
                        selected?.id === r.id ? "bg-[#E67E22]/5" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium text-gray-900">{r.title}</span>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${TYPE_TONE[r.type] ?? TYPE_TONE.custom}`}>
                          {r.type.replace("_", " ")}
                        </span>
                      </div>
                      <span className="flex items-center gap-1 text-[10px] text-gray-400">
                        <Calendar className="h-3 w-3" />
                        {formatDate(r.createdAt)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto px-8 py-6">
          {selected ? (
            <article className="mx-auto max-w-3xl">
              <header className="mb-5 border-b border-gray-200 pb-4">
                <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${TYPE_TONE[selected.type] ?? TYPE_TONE.custom}`}>
                  {selected.type.replace("_", " ")}
                </span>
                <h1 className="mt-2 text-xl font-bold text-gray-900">{selected.title}</h1>
                <p className="mt-1 text-xs text-gray-500">
                  {formatDate(selected.createdAt)}
                  {selected.period && <> · {selected.period}</>}
                  {selected.generatedBy === "ai" && <> · generated by Claude</>}
                </p>
              </header>
              <div className="space-y-1 leading-relaxed">{renderMarkdown(selected.content)}</div>
            </article>
          ) : (
            <div className="mx-auto mt-16 max-w-md text-center text-gray-400">
              <FileText className="mx-auto mb-3 h-8 w-8" />
              <p className="text-sm">Pick a report from the list, or generate a fresh one.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
