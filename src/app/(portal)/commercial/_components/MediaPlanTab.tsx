"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Loader2,
  Lock as LockIcon,
  Unlock,
  CheckCircle2,
  Film,
  History,
  PencilLine,
  X,
  Banknote,
  Link as LinkIcon,
  FileText,
  Upload,
  ExternalLink,
  Trash2,
  Sheet,
} from "lucide-react";
import { format, parseISO } from "date-fns";

const GOLD = "#ffd700";
const DEFAULT_PRODUCTION_MARGIN_PCT = 60;

function gbp0(n: number): string {
  return `£${(n || 0).toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
}

interface Economics {
  dealValue: number;
  mediaSpend: number;
  productionBudget: number;
  productionMarginPct: number;
  companyMargin: number;
  hardCostBudget: number;
  totalCompanyRevenue: number;
}

// Convert a Google Sheets edit URL into an embeddable /preview URL.
function sheetsPreviewUrl(raw: string | null): string | null {
  if (!raw) return null;
  const link = raw.trim();
  if (!/docs\.google\.com\/spreadsheets/.test(link)) return null;
  let base = link.split(/\/edit/)[0];
  base = base.split(/[?#]/)[0].replace(/\/$/, "");
  return `${base}/preview`;
}

export default function MediaPlanTab({
  dealId,
  workflowType,
  onSaved,
}: {
  dealId: string;
  workflowType?: string;
  onSaved: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lockBusy, setLockBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Document fields
  const [link, setLink] = useState("");
  const [file, setFile] = useState<string | null>(null);

  // Economics inputs (kept as strings for clean editing)
  const [dealValue, setDealValue] = useState("");
  const [mediaSpend, setMediaSpend] = useState("");
  const [marginPct, setMarginPct] = useState(String(DEFAULT_PRODUCTION_MARGIN_PCT));

  // Lock + meta
  const [locked, setLocked] = useState(false);
  const [lockedAt, setLockedAt] = useState<string | null>(null);
  const [lockedByName, setLockedByName] = useState<string | null>(null);
  const [version, setVersion] = useState(1);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [updatedBy, setUpdatedBy] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [editingLocked, setEditingLocked] = useState(false);
  const [showLockConfirm, setShowLockConfirm] = useState(false);
  const [showUnlockConfirm, setShowUnlockConfirm] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    const d = await fetch(`/api/commercial/deals/${dealId}/media-plan`).then((r) => r.json());
    const eco: Economics = d.economics ?? {
      dealValue: 0,
      mediaSpend: 0,
      productionBudget: 0,
      productionMarginPct: DEFAULT_PRODUCTION_MARGIN_PCT,
      companyMargin: 0,
      hardCostBudget: 0,
      totalCompanyRevenue: 0,
    };
    setLink(d.mediaPlanLink ?? "");
    setFile(d.mediaPlanFile ?? null);
    setDealValue(eco.dealValue ? String(eco.dealValue) : "");
    // Supplied-assets / print deals have no production — the whole deal value
    // is media spend. Prefill that when no split has been entered yet.
    const noProduction = workflowType === "SUPPLIED_ASSETS";
    if (eco.mediaSpend > 0) {
      setMediaSpend(String(eco.mediaSpend));
    } else if (noProduction && eco.dealValue > 0) {
      setMediaSpend(String(eco.dealValue));
    } else {
      setMediaSpend("");
    }
    setMarginPct(String(eco.productionMarginPct || DEFAULT_PRODUCTION_MARGIN_PCT));
    setLocked(Boolean(d.locked));
    setLockedAt(d.lockedAt ?? null);
    setLockedByName(d.lockedByName ?? null);
    setVersion(d.version ?? 1);
    setUpdatedAt(d.updatedAt ?? null);
    setUpdatedBy(d.updatedBy ?? null);
    setEditingLocked(false);
  }, [dealId, workflowType]);

  useEffect(() => {
    Promise.all([
      load(),
      fetch("/api/me")
        .then((r) => r.json())
        .then((d) => setIsAdmin(d.user?.role === "ADMIN"))
        .catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [load]);

  const editable = !locked || editingLocked;

  // ── Derived economics (mirrors lib/deal-economics) ──────────────────────────
  const dv = Math.max(0, Number(dealValue) || 0);
  const ms = Math.min(Math.max(0, Number(mediaSpend) || 0), dv);
  const productionBudget = Math.max(0, dv - ms);
  const companyPct = Math.min(100, Math.max(0, Number(marginPct) || 0));
  const hardPct = 100 - companyPct;
  const companyMargin = Math.round(((productionBudget * companyPct) / 100) * 100) / 100;
  const hardCostBudget = Math.round((productionBudget - companyMargin) * 100) / 100;
  const totalCompanyRevenue = Math.round((ms + companyMargin) * 100) / 100;
  const summaryTotal = Math.round((totalCompanyRevenue + hardCostBudget) * 100) / 100;
  const balanced = dv > 0 && Math.abs(summaryTotal - dv) < 0.5;
  const canLock = dv > 0;

  const preview = sheetsPreviewUrl(link);

  // ── Save / lock ─────────────────────────────────────────────────────────────
  async function save(): Promise<boolean> {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/commercial/deals/${dealId}/media-plan`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dealValue: dv,
          mediaSpend: ms,
          productionMarginPct: companyPct,
          mediaPlanLink: link.trim() || null,
          mediaPlanFile: file,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to save media plan");
        return false;
      }
      setSavedAt(Date.now());
      await load();
      await onSaved();
      return true;
    } finally {
      setSaving(false);
    }
  }

  async function setLock(nextLocked: boolean) {
    setLockBusy(true);
    setError(null);
    try {
      if (nextLocked) {
        const ok = await save();
        if (!ok) return;
      }
      const res = await fetch(`/api/commercial/deals/${dealId}/media-plan/lock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locked: nextLocked }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to update lock");
        return;
      }
      setShowLockConfirm(false);
      setShowUnlockConfirm(false);
      await load();
      await onSaved();
    } finally {
      setLockBusy(false);
    }
  }

  async function uploadFile(f: File) {
    setError(null);
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
      setError("Only PDF files are accepted");
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setError("File too large — max 10MB");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      fd.append("campaignId", dealId);
      const res = await fetch("/api/upload/media-plan", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to upload file");
        return;
      }
      setFile(data.filePath);
      await onSaved();
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={20} className="animate-spin text-gray-400 dark:text-gray-500" />
      </div>
    );
  }

  const inputCls =
    "px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-800 dark:text-gray-200 bg-transparent focus:outline-none focus:ring-2 focus:ring-[#ffd700]/30 focus:border-[#ffd700] disabled:opacity-60 disabled:cursor-not-allowed";
  const autoCls =
    "px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-800 text-sm font-semibold text-gray-700 dark:text-gray-300 tabular-nums";

  return (
    <div className="space-y-5">
      {/* Version / lock banner */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <History size={13} className="text-gray-400 dark:text-gray-500" />
          <span className="font-medium text-gray-700 dark:text-gray-300">Version {version}</span>
          {updatedAt && (
            <span>
              — Last updated {format(parseISO(updatedAt), "d MMM yyyy")}
              {updatedBy ? ` by ${updatedBy}` : ""}
            </span>
          )}
        </div>
        {locked && (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
            <LockIcon size={11} /> Locked
            {lockedAt ? ` · ${format(parseISO(lockedAt), "d MMM yyyy")}` : ""}
            {lockedByName ? ` · ${lockedByName}` : ""}
          </span>
        )}
      </div>

      {locked && !editingLocked && (
        <div className="bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 rounded-2xl px-5 py-4 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
            <LockIcon size={14} /> Media plan locked — this is the deal budget.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setEditingLocked(true)}
              className="text-xs font-medium text-emerald-700 dark:text-emerald-300 hover:text-emerald-900 dark:hover:text-emerald-100 underline underline-offset-2 inline-flex items-center gap-1"
            >
              <PencilLine size={12} /> Edit
            </button>
            {isAdmin && (
              <button
                onClick={() => setShowUnlockConfirm(true)}
                className="text-xs font-medium text-emerald-700 dark:text-emerald-300 hover:text-emerald-900 dark:hover:text-emerald-100 underline underline-offset-2 inline-flex items-center gap-1"
              >
                <Unlock size={12} /> Unlock (admin)
              </button>
            )}
          </div>
        </div>
      )}

      {locked && editingLocked && (
        <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-2xl px-5 py-3 text-sm font-medium text-amber-800 dark:text-amber-300">
          Unsaved changes since lock. Click <span className="font-bold">Update &amp; Re-lock</span> to apply.
        </div>
      )}

      {/* ── Media Plan ────────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
            <Banknote size={15} style={{ color: GOLD }} />
            Media Plan
          </h3>
          {savedAt && !saving && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <CheckCircle2 size={13} /> Saved
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 -mt-3">
          Shreeya builds the plan with the client in Google Sheets — paste the link or upload the
          final PDF, then set the deal value below.
        </p>

        {/* Google Sheets link */}
        <div>
          <label className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
            <Sheet size={12} /> Google Sheets link
          </label>
          <div className="flex items-center gap-2">
            <input
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              disabled={!editable}
              placeholder="https://docs.google.com/spreadsheets/d/…/edit"
              className={`${inputCls} flex-1`}
            />
            {preview && (
              <a
                href={link}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-[var(--portal-commercial)] hover:text-[var(--portal-commercial)] px-2.5 py-2 rounded-lg border border-gray-200 dark:border-gray-700 transition-colors"
              >
                <ExternalLink size={12} /> Open
              </a>
            )}
          </div>
        </div>

        {/* PDF upload */}
        <div>
          <label className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
            <FileText size={12} /> PDF media plan
          </label>
          {file ? (
            <div className="flex items-center gap-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/60 px-4 py-3">
              <FileText size={16} className="text-red-600 shrink-0" />
              <a
                href={file}
                target="_blank"
                rel="noreferrer"
                className="flex-1 truncate text-sm text-gray-700 dark:text-gray-300 hover:text-[var(--portal-commercial)] transition-colors"
              >
                {file.split("/").pop()}
              </a>
              <a
                href={file}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-[var(--portal-commercial)] hover:text-[var(--portal-commercial)]"
              >
                <ExternalLink size={12} /> View
              </a>
              {editable && (
                <button
                  onClick={() => setFile(null)}
                  className="shrink-0 p-1.5 rounded-lg text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                  title="Remove PDF"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ) : (
            <div
              onDragOver={(e) => {
                if (!editable) return;
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                if (!editable) return;
                const f = e.dataTransfer.files?.[0];
                if (f) uploadFile(f);
              }}
              onClick={() => editable && fileInputRef.current?.click()}
              className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors ${
                editable ? "cursor-pointer" : "cursor-not-allowed opacity-60"
              } ${dragOver ? "border-[#ffd700] bg-[#ffd700]/5" : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"}`}
            >
              {uploading ? (
                <Loader2 size={20} className="animate-spin text-gray-400 dark:text-gray-500" />
              ) : (
                <Upload size={20} className="text-gray-400 dark:text-gray-500" />
              )}
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {uploading ? "Uploading…" : "Drag a PDF here, or click to upload"}
              </p>
              <p className="text-[11px] text-gray-400 dark:text-gray-500">PDF only · max 10MB</p>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadFile(f);
              e.target.value = "";
            }}
          />
        </div>

        {/* Deal value */}
        <div>
          <label className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1.5 block">
            Deal value <span className="text-gray-400 dark:text-gray-500 normal-case">— the total from the media plan</span>
          </label>
          <div className="relative w-56">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 dark:text-gray-500">£</span>
            <input
              type="number"
              min="0"
              value={dealValue}
              onChange={(e) => setDealValue(e.target.value)}
              disabled={!editable}
              placeholder="0"
              className={`${inputCls} w-full pl-7 text-lg font-bold`}
            />
          </div>
        </div>

        {/* Preview */}
        <div>
          <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1.5">Preview</p>
          <div className="rounded-xl border border-border overflow-hidden bg-background">
            {preview ? (
              <iframe
                src={preview}
                title="Media plan (Google Sheets)"
                className="w-full"
                style={{ height: 520, border: "none" }}
              />
            ) : file ? (
              <iframe
                src={file}
                title="Media plan (PDF)"
                className="w-full"
                style={{ height: 520, border: "none" }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                <LinkIcon size={22} className="text-gray-600 dark:text-gray-400" />
                <p className="text-sm text-gray-500 dark:text-gray-400">No media plan attached yet</p>
                <p className="text-[11px] text-gray-600 dark:text-gray-400">Paste a Google Sheets link or upload a PDF above.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Deal Economics ────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-6 max-w-3xl">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2 mb-1">
          <Film size={15} style={{ color: GOLD }} />
          Deal Economics
        </h3>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-5">
          Media spend is 100% margin (no hard costs). Only production carries hard costs, split
          between the company margin and the budget handed to the Production team.
        </p>

        {/* Deal value (read-only) */}
        <div className="flex items-center justify-between rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-800 px-4 py-3 mb-5">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Deal Value</span>
          <span className="text-lg font-bold text-gray-900 dark:text-gray-100 tabular-nums">{gbp0(dv)}</span>
        </div>

        {/* Media vs Production split */}
        <SectionLabel>Media vs Production Split</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-2">
          <div>
            <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1.5">Media Spend</p>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 dark:text-gray-500">£</span>
              <input
                type="number"
                min="0"
                max={dv || undefined}
                value={mediaSpend}
                onChange={(e) => setMediaSpend(e.target.value)}
                disabled={!editable}
                placeholder="0"
                className={`${inputCls} w-full pl-7`}
              />
            </div>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1.5">
              Production Budget <span className="normal-case text-gray-400">(auto)</span>
            </p>
            <div className={`${autoCls} flex items-center`}>{gbp0(productionBudget)}</div>
          </div>
        </div>
        {editable && dv > 0 && (
          <div className="flex items-center gap-3 mb-5 text-[11px]">
            <button
              onClick={() => setMediaSpend(String(dv))}
              className="text-gray-400 dark:text-gray-500 hover:text-[var(--portal-commercial)] transition-colors"
            >
              No production — all media spend
            </button>
            {ms > 0 && (
              <button
                onClick={() => setMediaSpend("0")}
                className="text-gray-400 dark:text-gray-500 hover:text-[var(--portal-commercial)] transition-colors"
              >
                Reset media spend
              </button>
            )}
          </div>
        )}

        {/* Production margin */}
        <SectionLabel>Production Margin</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
          <div>
            <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1.5">
              Margin Split (company / hard cost)
            </p>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={marginPct}
                  onChange={(e) => setMarginPct(e.target.value)}
                  disabled={!editable}
                  className={`${inputCls} w-full pr-6 text-center`}
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 dark:text-gray-500">%</span>
              </div>
              <span className="text-gray-400 dark:text-gray-500 font-semibold">/</span>
              <div className="relative flex-1">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={Math.round(hardPct)}
                  onChange={(e) =>
                    setMarginPct(String(100 - (Number(e.target.value) || 0)))
                  }
                  disabled={!editable}
                  className={`${inputCls} w-full pr-6 text-center`}
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 dark:text-gray-500">%</span>
              </div>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1.5">
              Company Margin <span className="normal-case text-gray-400">({Math.round(companyPct)}%)</span>
            </p>
            <div className={`${autoCls} flex items-center`}>{gbp0(companyMargin)}</div>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1.5">
              Hard Cost Budget <span className="normal-case text-red-600">→ Production</span>
            </p>
            <div className={`${autoCls} flex items-center !text-red-500`}>{gbp0(hardCostBudget)}</div>
          </div>
        </div>

        {/* Summary */}
        <SectionLabel>Summary</SectionLabel>
        <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/40 dark:bg-gray-800/40 divide-y divide-gray-100 dark:divide-gray-800">
          <SummaryRow label="Total Company Revenue" detail="media spend + production margin" value={gbp0(totalCompanyRevenue)} accent />
          <SummaryRow label="Production Hard Costs" detail="goes to the production team" value={gbp0(hardCostBudget)} />
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm font-bold text-gray-800 dark:text-gray-200">Total</span>
            <span className="inline-flex items-center gap-1.5 text-sm font-bold text-gray-900 dark:text-gray-100 tabular-nums">
              {gbp0(summaryTotal)}
              {balanced ? (
                <CheckCircle2 size={15} className="text-emerald-500" />
              ) : (
                <span className="text-[11px] font-medium text-amber-600">vs {gbp0(dv)} deal</span>
              )}
            </span>
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/30 rounded-lg px-3 py-2">{error}</p>}

      {/* ── Actions ───────────────────────────────────────────────────────────── */}
      {editable && (
        <div className="flex items-center justify-end gap-3">
          {!locked && (
            <button
              onClick={save}
              disabled={saving || lockBusy}
              className="flex items-center gap-2 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              Save Draft
            </button>
          )}
          {locked && editingLocked && (
            <button
              onClick={() => {
                setEditingLocked(false);
                load();
              }}
              className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            onClick={() => (locked ? save() : setShowLockConfirm(true))}
            disabled={saving || lockBusy || !canLock}
            title={canLock ? "Lock the media plan" : "Set the deal value first"}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              locked
                ? "bg-[#ffd700] text-black hover:bg-[#ffd700]"
                : "bg-emerald-500 text-white hover:bg-emerald-600 shadow-[0_0_18px_rgba(16,185,129,0.35)]"
            }`}
          >
            {saving || lockBusy ? <Loader2 size={14} className="animate-spin" /> : <LockIcon size={14} />}
            {locked ? "Update & Re-lock" : "Lock Media Plan"}
          </button>
        </div>
      )}

      {/* Lock confirm */}
      {showLockConfirm && (
        <ConfirmModal
          title="Lock media plan?"
          icon={<LockIcon size={16} className="text-emerald-500" />}
          body={
            <>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                The economics become read-only and the hard-cost budget of{" "}
                <span className="font-semibold text-gray-800 dark:text-gray-200">{gbp0(hardCostBudget)}</span> is finalised
                for the Production team. Only an admin can unlock it afterwards.
              </p>
              <div className="mt-4 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-800 px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 tabular-nums space-y-1">
                <p className="flex justify-between"><span className="text-gray-400 dark:text-gray-500">Deal value</span> {gbp0(dv)}</p>
                <p className="flex justify-between"><span className="text-gray-400 dark:text-gray-500">Media spend</span> {gbp0(ms)}</p>
                <p className="flex justify-between"><span className="text-gray-400 dark:text-gray-500">Company margin</span> {gbp0(companyMargin)}</p>
                <p className="flex justify-between"><span className="text-gray-400 dark:text-gray-500">Hard costs → production</span> {gbp0(hardCostBudget)}</p>
              </div>
            </>
          }
          confirmLabel="Lock Media Plan"
          busy={lockBusy}
          onConfirm={() => setLock(true)}
          onClose={() => setShowLockConfirm(false)}
        />
      )}
      {showUnlockConfirm && (
        <ConfirmModal
          title="Unlock media plan?"
          body={
            <p className="text-sm text-gray-600 dark:text-gray-400">
              The economics become editable again. If the deal has already been cleared for
              production, re-lock it after editing so downstream numbers stay correct.
            </p>
          }
          confirmLabel="Unlock"
          confirmTone="dark"
          busy={lockBusy}
          onConfirm={() => setLock(false)}
          onClose={() => setShowUnlockConfirm(false)}
        />
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
        {children}
      </span>
      <span className="h-px flex-1 bg-gray-100 dark:bg-gray-800" />
    </div>
  );
}

function SummaryRow({
  label,
  detail,
  value,
  accent,
}: {
  label: string;
  detail: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div>
        <p className={`text-sm font-medium ${accent ? "text-gray-800 dark:text-gray-200" : "text-gray-600 dark:text-gray-400"}`}>{label}</p>
        <p className="text-[11px] text-gray-400 dark:text-gray-500">{detail}</p>
      </div>
      <span className={`text-sm font-bold tabular-nums ${accent ? "text-[var(--portal-commercial)]" : "text-gray-700 dark:text-gray-300"}`}>
        {value}
      </span>
    </div>
  );
}

// ─── Confirm modal ────────────────────────────────────────────────────────────
function ConfirmModal({
  title,
  icon,
  body,
  confirmLabel,
  confirmTone = "gold",
  busy,
  onConfirm,
  onClose,
}: {
  title: string;
  icon?: React.ReactNode;
  body: React.ReactNode;
  confirmLabel: string;
  confirmTone?: "gold" | "dark";
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="border-b border-gray-50 dark:border-gray-800 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            {icon}
            {title}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5">
          {body}
          <div className="flex gap-3 mt-5">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={busy}
              className={`flex-1 flex items-center justify-center gap-2 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 ${
                confirmTone === "dark" ? "bg-gray-900 hover:bg-gray-800" : "bg-emerald-500 hover:bg-emerald-600"
              }`}
            >
              {busy && <Loader2 size={15} className="animate-spin" />}
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
