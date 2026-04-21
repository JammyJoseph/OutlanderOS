"use client";

import { useState, useEffect } from "react";
import { Newspaper, Plus, X, ChevronRight } from "lucide-react";
import Link from "next/link";

interface PrintIssue {
  id: string;
  title: string;
  year: number;
  pageCount: number;
  status: string;
  printer: string | null;
  printDate: string | null;
}

const STATUS_STYLES: Record<string, string> = {
  planning: "bg-gray-100 text-gray-600",
  design: "bg-blue-100 text-blue-700",
  proofing: "bg-amber-100 text-amber-700",
  print: "bg-purple-100 text-purple-700",
  distributed: "bg-emerald-100 text-emerald-700",
};

export default function PrintPage() {
  const [issues, setIssues] = useState<PrintIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    title: "",
    year: new Date().getFullYear().toString(),
    pageCount: "64",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/print-issues")
      .then((r) => r.json())
      .then((d) => setIssues(d.issues ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/print-issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          year: parseInt(form.year),
          pageCount: parseInt(form.pageCount),
        }),
      });
      const data = await res.json();
      if (data.issue) {
        setIssues((prev) => [data.issue, ...prev]);
        setShowCreate(false);
        setForm({ title: "", year: new Date().getFullYear().toString(), pageCount: "64" });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Print Issues</h1>
          <p className="text-xs text-gray-500">Magazine issues and editorial planning</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-lg bg-[#D4A853] px-3 py-2 text-xs font-semibold text-white hover:bg-[#C49843]"
        >
          <Plus className="h-3.5 w-3.5" />
          Create Issue
        </button>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card-apple h-40 animate-pulse bg-gray-100" />
            ))}
          </div>
        ) : issues.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
              <Newspaper className="h-8 w-8 text-gray-400" />
            </div>
            <h2 className="text-sm font-semibold text-gray-700">No issues yet</h2>
            <p className="mt-1 max-w-xs text-xs text-gray-400">
              Create your first magazine issue to start planning.
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="mt-4 flex items-center gap-1.5 rounded-lg bg-[#D4A853] px-4 py-2 text-xs font-semibold text-white hover:bg-[#C49843]"
            >
              <Plus className="h-3.5 w-3.5" />
              Create Issue
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {issues.map((issue) => (
              <Link
                key={issue.id}
                href={`/print/${issue.id}`}
                className="card-apple group flex flex-col p-5 transition-shadow hover:shadow-md"
              >
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-900">
                    <Newspaper className="h-5 w-5 text-white" />
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-300 transition-colors group-hover:text-[#D4A853]" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900">{issue.title}</h3>
                <p className="mt-0.5 text-xs text-gray-500">{issue.year}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-gray-400">{issue.pageCount} pages</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${
                      STATUS_STYLES[issue.status] ?? "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {issue.status}
                  </span>
                </div>
                {issue.printDate && (
                  <p className="mt-2 text-[10px] text-gray-400">
                    Print:{" "}
                    {new Date(issue.printDate).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">New Issue</h2>
              <button
                onClick={() => setShowCreate(false)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Title *</label>
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#D4A853] focus:outline-none"
                  placeholder="e.g. Issue 03 — Summer 2026"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Year</label>
                  <input
                    type="number"
                    value={form.year}
                    onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#D4A853] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">
                    Page Count
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={form.pageCount}
                    onChange={(e) => setForm((f) => ({ ...f, pageCount: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#D4A853] focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="rounded-lg px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-[#D4A853] px-4 py-2 text-xs font-semibold text-white hover:bg-[#C49843] disabled:opacity-50"
                >
                  {saving ? "Creating…" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
