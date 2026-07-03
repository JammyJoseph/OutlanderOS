"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Plus, Newspaper, Calendar, DollarSign, X } from "lucide-react";
import Link from "next/link";

const TYPE_STYLES: Record<string, { bg: string; border: string; dot: string; label: string }> = {
  editorial: { bg: "bg-blue-50 dark:bg-blue-900/30", border: "border-blue-200 dark:border-blue-800", dot: "bg-blue-500", label: "Editorial" },
  ad: { bg: "bg-amber-50 dark:bg-amber-900/30", border: "border-amber-200 dark:border-amber-800", dot: "bg-amber-500", label: "Ad" },
  cover: { bg: "bg-purple-50 dark:bg-purple-900/30", border: "border-purple-200 dark:border-purple-800", dot: "bg-purple-500", label: "Cover" },
};

const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  planned: { text: "Planned", color: "text-gray-400 dark:text-gray-500" },
  draft: { text: "Draft", color: "text-amber-600 dark:text-amber-400" },
  confirmed: { text: "Confirmed", color: "text-emerald-600 dark:text-emerald-400" },
};

const ISSUE_STATUS_STYLES: Record<string, string> = {
  planning: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  design: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  proofing: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  print: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  distributed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
};

interface PrintPage {
  id: string;
  pageNumber: number;
  type: string;
  clientId: string | null;
  client: { name: string } | null;
  assignedTo: string | null;
  status: string;
  contentUrl: string | null;
}

interface PrintIssue {
  id: string;
  title: string;
  year: number;
  pageCount: number;
  status: string;
  printer: string | null;
  printDate: string | null;
  pages: PrintPage[];
}

export default function PrintIssuePage() {
  const { id } = useParams<{ id: string }>();
  const [issue, setIssue] = useState<PrintIssue | null>(null);
  const [loading, setLoading] = useState(true);
  const [addPageOpen, setAddPageOpen] = useState(false);
  const [newPage, setNewPage] = useState({ pageNumber: "", type: "editorial", assignedTo: "" });
  const [savingPage, setSavingPage] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/print-issues/${id}`)
      .then((r) => r.json())
      .then((d) => setIssue(d.issue ?? null))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleAddPage(e: React.FormEvent) {
    e.preventDefault();
    if (!issue) return;
    setPageError(null);

    // Page number must be a positive integer.
    const num = Number(newPage.pageNumber);
    if (!newPage.pageNumber.trim() || !Number.isInteger(num) || num < 1) {
      setPageError("Page number must be a whole number of 1 or more.");
      return;
    }
    // No duplicate page numbers in the same issue.
    if (issue.pages.some((p) => p.pageNumber === num)) {
      setPageError(`Page ${num} already exists in this issue.`);
      return;
    }

    setSavingPage(true);
    try {
      const res = await fetch(`/api/print-issues/${id}/pages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageNumber: parseInt(newPage.pageNumber),
          type: newPage.type,
          assignedTo: newPage.assignedTo || null,
        }),
      });
      const data = await res.json();
      if (data.page) {
        setIssue((prev) =>
          prev
            ? {
                ...prev,
                pages: [...prev.pages, data.page].sort((a, b) => a.pageNumber - b.pageNumber),
              }
            : prev
        );
        setAddPageOpen(false);
        setNewPage({ pageNumber: "", type: "editorial", assignedTo: "" });
      }
    } finally {
      setSavingPage(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-full flex-col">
        <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-6 py-3">
          <div className="h-5 w-48 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        </div>
        <div className="flex-1 p-6">
          <div className="grid grid-cols-6 gap-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!issue) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Issue not found</p>
          <Link href="/print" className="mt-2 block text-xs text-[#ffd700] hover:underline">
            Back to Issues
          </Link>
        </div>
      </div>
    );
  }

  const confirmed = issue.pages.filter((p) => p.status === "confirmed").length;
  const draft = issue.pages.filter((p) => p.status === "draft").length;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-6 py-3">
        <Link
          href="/print"
          className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Issues
        </Link>
        <span className="text-gray-300 dark:text-gray-600">/</span>
        <div className="flex flex-1 items-center gap-2">
          <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100">{issue.title}</h1>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${
              ISSUE_STATUS_STYLES[issue.status] ?? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
            }`}
          >
            {issue.status}
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-400 dark:text-gray-500">
          <span>{issue.year}</span>
          <span>{issue.pageCount} pp</span>
          {issue.printDate && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {new Date(issue.printDate).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
              })}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 space-y-6 overflow-auto p-6">
        {/* Flat Plan section */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Flat Plan</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {issue.pages.length} pages · {confirmed} confirmed · {draft} in draft
              </p>
            </div>
            <button
              onClick={() => {
                setPageError(null);
                setNewPage({ pageNumber: "", type: "editorial", assignedTo: "" });
                setAddPageOpen(true);
              }}
              className="flex items-center gap-1.5 rounded-lg bg-[#ffd700] px-3 py-1.5 text-xs font-semibold text-black hover:bg-[#ffd700]"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Page
            </button>
          </div>

          {/* Legend */}
          <div className="mb-3 flex flex-wrap items-center gap-4">
            {Object.entries(TYPE_STYLES).map(([type, s]) => (
              <div key={type} className="flex items-center gap-1.5">
                <div className={`h-2.5 w-2.5 rounded-full ${s.dot}`} />
                <span className="text-xs text-gray-500 dark:text-gray-400">{s.label}</span>
              </div>
            ))}
            <div className="ml-2 flex items-center gap-4 border-l border-gray-200 dark:border-gray-700 pl-4">
              <span className="text-xs text-emerald-600 dark:text-emerald-400">● Confirmed</span>
              <span className="text-xs text-amber-600 dark:text-amber-400">● Draft</span>
              <span className="text-xs text-gray-400 dark:text-gray-500">● Planned</span>
            </div>
          </div>

          {issue.pages.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 py-12 text-center">
              <Newspaper className="mb-2 h-8 w-8 text-gray-300 dark:text-gray-600" />
              <p className="text-xs text-gray-400 dark:text-gray-500">
                No pages added yet. Click "Add Page" to start building the flat plan.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-3 md:grid-cols-6">
              {issue.pages.map((page) => {
                const ts = TYPE_STYLES[page.type] ?? TYPE_STYLES.editorial;
                const ss = STATUS_LABEL[page.status] ?? { text: page.status, color: "text-gray-400" };
                return (
                  <div
                    key={page.id}
                    className={`rounded-xl border p-3 transition-opacity hover:opacity-80 ${ts.bg} ${ts.border}`}
                  >
                    <div className="flex items-start justify-between">
                      <span className="text-xs font-bold text-gray-600 dark:text-gray-400">p.{page.pageNumber}</span>
                      <span className={`text-[9px] font-semibold uppercase tracking-wide ${ss.color}`}>
                        {ss.text}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-[10px] font-semibold text-gray-700 dark:text-gray-300">
                      {page.client?.name ?? <span className="text-gray-300 dark:text-gray-600">—</span>}
                    </p>
                    <p className="truncate text-[10px] text-gray-400 dark:text-gray-500">{page.assignedTo ?? "—"}</p>
                    <div className="mt-2">
                      <span
                        className={`inline-block rounded-full px-1.5 py-0.5 text-[9px] font-semibold text-white ${ts.dot}`}
                      >
                        {ts.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Issue metadata cards */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <div className="card-apple p-4">
            <div className="mb-2 flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-gray-400 dark:text-gray-500" />
              <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300">Budget</h3>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500">No budget data set</p>
          </div>

          <div className="card-apple p-4">
            <div className="mb-2 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-400 dark:text-gray-500" />
              <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300">Timeline</h3>
            </div>
            {issue.printDate ? (
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Print:{" "}
                {new Date(issue.printDate).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            ) : (
              <p className="text-xs text-gray-400 dark:text-gray-500">No dates set</p>
            )}
          </div>

          <div className="card-apple p-4">
            <div className="mb-2 flex items-center gap-2">
              <Newspaper className="h-4 w-4 text-gray-400 dark:text-gray-500" />
              <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300">Printer</h3>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400">{issue.printer ?? "Not specified"}</p>
          </div>
        </div>
      </div>

      {/* Add Page Modal */}
      {addPageOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-900 p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Add Page</h2>
              <button
                onClick={() => setAddPageOpen(false)}
                className="rounded-lg p-1 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleAddPage} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Page Number *
                </label>
                <input
                  required
                  type="number"
                  min="1"
                  step="1"
                  value={newPage.pageNumber}
                  onChange={(e) => {
                    setNewPage((p) => ({ ...p, pageNumber: e.target.value }));
                    if (pageError) setPageError(null);
                  }}
                  className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none ${
                    pageError
                      ? "border-red-400 focus:border-red-400"
                      : "border-gray-200 dark:border-gray-700 focus:border-[#ffd700]"
                  }`}
                />
                {pageError && (
                  <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">{pageError}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">Type</label>
                <select
                  value={newPage.type}
                  onChange={(e) => setNewPage((p) => ({ ...p, type: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm focus:border-[#ffd700] focus:outline-none"
                >
                  <option value="editorial">Editorial</option>
                  <option value="ad">Ad</option>
                  <option value="cover">Cover</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">Assigned To</label>
                <input
                  value={newPage.assignedTo}
                  onChange={(e) => setNewPage((p) => ({ ...p, assignedTo: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm focus:border-[#ffd700] focus:outline-none"
                  placeholder="Name or team"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAddPageOpen(false)}
                  className="rounded-lg px-4 py-2 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPage}
                  className="rounded-lg bg-[#ffd700] px-4 py-2 text-xs font-semibold text-black hover:bg-[#ffd700] disabled:opacity-50"
                >
                  {savingPage ? "Adding…" : "Add"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
