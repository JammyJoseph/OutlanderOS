"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Edit2, Loader2, Check, FileDown, Send, Users, Info, Share2,
} from "lucide-react";
import { CallSheetDocument, type CallSheetViewData } from "./CallSheetDocument";
import type { CallSheet, DistributionEntry, SectionKey } from "./types";
import { allSectionsVisible } from "./types";
import { ShareModal } from "./ShareModal";
import { PdfExportModal } from "./PdfExportModal";

export function FinalView({
  productionTitle,
  productionId,
  sheet,
  viewData,
  onRevert,
  saving,
  onSaveDistributions,
}: {
  productionTitle: string;
  productionId: string;
  sheet: CallSheet;
  viewData: CallSheetViewData;
  onRevert: () => void;
  saving: boolean;
  onSaveDistributions: (d: DistributionEntry[]) => Promise<void>;
}) {
  const [shareOpen, setShareOpen] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [docSections, setDocSections] = useState<Record<SectionKey, boolean>>(
    allSectionsVisible()
  );
  const [docRedacted, setDocRedacted] = useState(false);

  // Apply the chosen sections/redaction, print, then restore the full view.
  function handleExport(sections: Record<SectionKey, boolean>, includeContacts: boolean) {
    setDocSections(sections);
    setDocRedacted(!includeContacts);
    setPdfOpen(false);
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        setDocSections(allSectionsVisible());
        setDocRedacted(false);
      }, 500);
    }, 100);
  }

  return (
    <div className="min-h-screen bg-[#141414] print:bg-white" data-callsheet-print>
      <div className="max-w-4xl mx-auto px-6 py-10 print:px-0 print:py-0 print:max-w-none">
        <div className="flex items-center justify-between mb-6 print:hidden">
          <Link
            href={`/production/${productionId}`}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft size={15} />
            Back to Project
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPdfOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <FileDown size={13} /> Download PDF
            </button>
            <button
              onClick={onRevert}
              disabled={saving}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-60"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Edit2 size={13} />}
              Back to Editor
            </button>
            <button
              onClick={() => setShareOpen(true)}
              className="flex items-center gap-1.5 bg-[#ff4444] text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-[#ff4444] transition-colors shadow-sm"
            >
              <Share2 size={13} /> Share Call Sheet
            </button>
          </div>
        </div>

        <div className="mb-4 flex items-center gap-2 print:hidden">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">
            Published
          </span>
          <span className="text-xs text-gray-400">{productionTitle}</span>
          {sheet.shareToken && (
            <span className="text-xs text-gray-400 truncate">
              · Public link: /call-sheet/{sheet.shareToken.slice(0, 8)}…
            </span>
          )}
        </div>

        <CallSheetDocument data={viewData} sections={docSections} redacted={docRedacted} />

        <div className="print:hidden">
          <DistributionPanel sheet={sheet} viewData={viewData} onSave={onSaveDistributions} />
        </div>
      </div>

      {shareOpen && (
        <ShareModal
          onClose={() => setShareOpen(false)}
          shareToken={sheet.shareToken}
          clientShareToken={sheet.clientShareToken}
          shootTitle={viewData.shootTitle}
          shootDate={viewData.shootDate}
        />
      )}
      {pdfOpen && <PdfExportModal onClose={() => setPdfOpen(false)} onExport={handleExport} />}
    </div>
  );
}

// ─── Distribution tracker ──────────────────────────────────────────────────────

function distKey(name: string, email: string): string {
  return `${(name || "").trim().toLowerCase()}|${(email || "").trim().toLowerCase()}`;
}

function DistributionPanel({
  sheet,
  viewData,
  onSave,
}: {
  sheet: CallSheet;
  viewData: CallSheetViewData;
  onSave: (d: DistributionEntry[]) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  // Recipients = everyone on the crew + talent roster, merged with whatever
  // distribution state has already been recorded.
  const entries = useMemo<DistributionEntry[]>(() => {
    const stored = Array.isArray(sheet.distributions) ? sheet.distributions : [];
    const byKey = new Map(stored.map((d) => [distKey(d.name, d.email), d]));
    const roster = [...viewData.crew, ...viewData.talent].filter((m) => (m.name || "").trim());
    const merged: DistributionEntry[] = roster.map((m) => {
      const key = distKey(m.name, m.email || "");
      const existing = byKey.get(key);
      byKey.delete(key);
      return (
        existing ?? { name: m.name, role: m.role, email: m.email || "", sentAt: "" }
      );
    });
    // Keep recorded recipients even if they were later removed from the roster.
    merged.push(...byKey.values());
    return merged;
  }, [sheet.distributions, viewData.crew, viewData.talent]);

  const confirmed = entries.filter((e) => e.confirmedAt).length;
  const sent = entries.filter((e) => e.sentAt).length;

  async function sendToAll() {
    setBusy(true);
    try {
      const now = new Date().toISOString();
      await onSave(entries.map((e) => (e.sentAt ? e : { ...e, sentAt: now })));
    } finally {
      setBusy(false);
    }
  }

  async function toggleConfirmed(target: DistributionEntry) {
    setBusy(true);
    try {
      await onSave(
        entries.map((e) =>
          distKey(e.name, e.email) === distKey(target.name, target.email)
            ? e.confirmedAt
              ? { name: e.name, role: e.role, email: e.email, sentAt: e.sentAt }
              : { ...e, confirmedAt: new Date().toISOString() }
            : e
        )
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Users size={15} className="text-[#ff4444]" />
          <h3 className="text-sm font-bold text-gray-800">Distribution</h3>
          {entries.length > 0 && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
              {confirmed}/{entries.length} confirmed
            </span>
          )}
        </div>
        <button
          onClick={sendToAll}
          disabled={busy || entries.length === 0 || sent === entries.length}
          className="flex items-center gap-1.5 bg-gray-900 text-white px-3.5 py-2 rounded-xl text-xs font-medium hover:bg-gray-700 transition-colors disabled:opacity-40"
        >
          {busy ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
          {sent === entries.length && entries.length > 0 ? "All sent" : "Send to All"}
        </button>
      </div>

      <div className="px-5 py-2.5 bg-amber-50/60 border-b border-amber-100/60 flex items-start gap-2">
        <Info size={13} className="text-amber-600 mt-0.5 shrink-0" />
        <p className="text-xs text-amber-700">
          Email distribution coming soon. Share the link manually for now — &ldquo;Send to
          All&rdquo; records who the call sheet has gone out to.
        </p>
      </div>

      {entries.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-gray-400">
          Add crew or talent to the call sheet to track distribution.
        </p>
      ) : (
        <>
          {/* Progress */}
          <div className="px-5 pt-4">
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all"
                style={{ width: `${entries.length ? (confirmed / entries.length) * 100 : 0}%` }}
              />
            </div>
          </div>
          <div className="divide-y divide-gray-50 mt-2">
            {entries.map((e, i) => (
              <div key={i} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {e.name}
                    {e.role && <span className="text-gray-400 font-normal"> · {e.role}</span>}
                  </p>
                  <p className="text-xs text-gray-400 truncate">{e.email || "No email"}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {e.sentAt ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                      <Check size={12} /> Sent
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">Pending</span>
                  )}
                  {e.confirmedAt ? (
                    <button
                      onClick={() => toggleConfirmed(e)}
                      disabled={busy}
                      className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors disabled:opacity-50"
                      title="Click to undo"
                    >
                      <Check size={12} /> Confirmed
                    </button>
                  ) : (
                    <button
                      onClick={() => toggleConfirmed(e)}
                      disabled={busy}
                      className="text-xs font-medium px-2.5 py-1 rounded-full border border-gray-200 text-gray-500 hover:border-emerald-300 hover:text-emerald-700 transition-colors disabled:opacity-50"
                    >
                      Mark Confirmed
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
