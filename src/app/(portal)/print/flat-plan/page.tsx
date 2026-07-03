"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  Table2,
  LayoutGrid,
  Plus,
  Minus,
  Printer,
  Check,
  GripVertical,
  Trash2,
  X,
  Cloud,
  ArrowLeft,
  PoundSterling,
  ExternalLink,
} from "lucide-react";
import { useMagazinePlan } from "@/components/print/usePlan";
import { useConfirm } from "@/components/ui/confirm-provider";
import BudgetView from "@/components/print/BudgetView";
import {
  SECTIONS,
  SECTION_KEYS,
  STATUS_PIPELINE,
  STATUS_LABELS,
  STATUS_STYLE,
  DEFAULT_STOCK,
  blankPage,
  computeStats,
  groupSignatures,
  flattenSignatures,
  sectionColour,
  syncStatusFlags,
  type MagazinePage,
  type MagazineSignature,
  type PageStatus,
  type SectionKey,
  type StockType,
} from "@/lib/magazine-plan";

type View = "tracker" | "flatplan" | "budget";

export default function FlatPlanPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center bg-background">
          <Loader2 className="h-6 w-6 animate-spin text-[#00ff88]" />
        </div>
      }
    >
      <FlatPlanInner />
    </Suspense>
  );
}

function FlatPlanInner() {
  const searchParams = useSearchParams();
  const issueParam = searchParams.get("issue");
  const issueNumber = issueParam ? parseInt(issueParam, 10) : null;

  const { plan, loading, saving, error, savePages } = useMagazinePlan(issueNumber);
  const confirm = useConfirm();
  const [notice, setNotice] = useState<string | null>(null);
  const [view, setView] = useState<View>("tracker");
  const [editing, setEditing] = useState<number | null>(null); // index into pages
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const pages = plan?.pages ?? [];
  const stats = useMemo(() => computeStats(pages), [pages]);
  const signatures = useMemo(() => groupSignatures(pages), [pages]);

  // Per-page signature lookup for the tracker's Signature / Stock columns.
  const sigByIndex = useMemo(() => {
    const map: { sigNumber: number; sigIndex: number; stock: StockType }[] = [];
    signatures.forEach((s, si) =>
      s.pages.forEach(() => map.push({ sigNumber: si + 1, sigIndex: si, stock: s.stockType }))
    );
    return map;
  }, [signatures]);

  function mutate(next: MagazinePage[]) {
    savePages(next, next.length);
  }

  // Any structural change (add / remove / reorder) must keep pageNumber in lockstep
  // with array order so the flat plan and tracker always agree on numbering.
  function mutateStructural(next: MagazinePage[]) {
    mutate(renumber(next));
  }

  function updatePage(index: number, patch: Partial<MagazinePage>) {
    mutate(pages.map((p, i) => (i === index ? syncStatusFlags({ ...p, ...patch }) : p)));
  }

  function setStage(index: number, stage: PageStatus) {
    updatePage(index, { status: stage });
  }

  function addRowAfter(index: number) {
    const next = [...pages];
    next.splice(index + 1, 0, blankPage(index + 2));
    mutateStructural(next);
  }

  function removeRow(index: number) {
    mutateStructural(pages.filter((_, i) => i !== index));
  }

  // Remove a single page with confirmation, then renumber the rest. Used by the
  // flat plan's per-card × button for fine-tuning (bulk add/remove still uses blocks).
  async function removePage(index: number) {
    const p = pages[index];
    if (!p) return;
    const ok = await confirm({
      title: `Remove page ${p.pageNumber}?`,
      message: "This removes the page and renumbers the remaining pages.",
      confirmLabel: "Remove",
      confirmVariant: "danger",
    });
    if (!ok) return;
    mutateStructural(pages.filter((_, i) => i !== index));
  }

  function reorder(from: number, to: number) {
    if (from === to) return;
    const next = [...pages];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    mutateStructural(next);
  }

  // ── Signature operations (flat-plan) ──
  // Each rebuilds the signature groups, mutates them, then flattens back to the
  // canonical page array (which re-stamps signatureIndex/stockType + page numbers).

  function setSignatureStock(sigIndex: number, stock: StockType) {
    const next = signatures.map((s) =>
      s.signatureIndex === sigIndex ? { ...s, stockType: stock } : s
    );
    mutate(flattenSignatures(next));
  }

  function moveSignature(from: number, to: number) {
    if (from === to) return;
    const next = signatures.map((s) => ({ ...s, pages: [...s.pages] }));
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    mutate(flattenSignatures(next));
  }

  function addSignature(size: 8 | 16) {
    const blanks = Array.from({ length: size }, () => blankPage(1));
    const next: MagazineSignature[] = [
      ...signatures.map((s) => ({ ...s, pages: [...s.pages] })),
      {
        signatureIndex: signatures.length,
        startIndex: pages.length,
        pageCount: size,
        stockType: DEFAULT_STOCK,
        pages: blanks,
      },
    ];
    mutate(flattenSignatures(next));
  }

  async function removeSignature(sigIndex: number) {
    if (signatures.length <= 1) {
      setNotice("A magazine must keep at least one signature.");
      return;
    }
    const sig = signatures[sigIndex];
    if (!sig) return;
    const ok = await confirm({
      title: `Remove Signature ${sigIndex + 1}?`,
      message: `This removes those ${sig.pageCount} pages and renumbers the rest. Can't be undone once saved.`,
      confirmLabel: "Remove",
      confirmVariant: "danger",
    });
    if (!ok) return;
    const next = signatures.filter((s) => s.signatureIndex !== sigIndex);
    mutate(flattenSignatures(next));
  }

  function removeLastSignature() {
    void removeSignature(signatures.length - 1);
  }

  // Move a single page card from one slot to another (within or across signatures).
  function movePage(fromSig: number, fromSlot: number, toSig: number, toSlot: number) {
    const next = signatures.map((s) => ({ ...s, pages: [...s.pages] }));
    const [moved] = next[fromSig].pages.splice(fromSlot, 1);
    let slot = toSlot;
    if (fromSig === toSig && fromSlot < toSlot) slot -= 1; // splice-out shifts later slots down
    next[toSig].pages.splice(slot, 0, moved);
    mutate(flattenSignatures(next));
  }

  function printFlatPlan() {
    openPrintWindow(plan?.issueName ?? "", plan?.issueNumber ?? 0, pages);
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-[#00ff88]" />
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-background text-center text-gray-500 dark:text-gray-400">
        <Cloud className="mb-3 h-8 w-8 text-gray-400 dark:text-gray-500" />
        <p className="text-sm">Couldn&apos;t load the magazine plan.</p>
        {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
        <Link href="/print" className="mt-3 text-xs text-[#00ff88] hover:underline">
          ← Back to all issues
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      {notice && (
        <div className="fixed inset-x-0 top-4 z-[60] flex justify-center px-4">
          <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-800 shadow-lg dark:border-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
            {notice}
            <button
              onClick={() => setNotice(null)}
              className="text-amber-600 hover:text-amber-800 dark:text-amber-300 dark:hover:text-amber-100"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background/90 px-6 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <Link
            href="/print"
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-secondary text-gray-500 dark:text-gray-400 hover:text-foreground"
            title="All issues"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </Link>
          <div>
            <h1 className="flex items-center gap-2 text-base font-semibold text-foreground">
              <span className="h-2 w-2 rounded-full bg-[#00ff88]" />
              Issue {String(plan.issueNumber).padStart(2, "0")} — {plan.issueName}
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {pages.length} pages · {signatures.length} signature{signatures.length === 1 ? "" : "s"}
              {saving ? " · saving…" : plan.updatedBy ? ` · last edit ${plan.updatedBy}` : ""}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg bg-secondary p-0.5">
            <button
              onClick={() => setView("tracker")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                view === "tracker" ? "bg-[#00ff88] text-black" : "text-gray-500 dark:text-gray-400 hover:text-foreground"
              }`}
            >
              <Table2 className="h-3.5 w-3.5" /> Tracker
            </button>
            <button
              onClick={() => setView("flatplan")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                view === "flatplan" ? "bg-[#00ff88] text-black" : "text-gray-500 dark:text-gray-400 hover:text-foreground"
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Flat Plan
            </button>
            <button
              onClick={() => setView("budget")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                view === "budget" ? "bg-[#00ff88] text-black" : "text-gray-500 dark:text-gray-400 hover:text-foreground"
              }`}
            >
              <PoundSterling className="h-3.5 w-3.5" /> Budget
            </button>
          </div>

          {/* Signature management */}
          <button onClick={() => addSignature(8)} className={btnGhost} title="Add an 8-page signature at the end">
            <Plus className="h-3.5 w-3.5" /> Sig 8pp
          </button>
          <button onClick={() => addSignature(16)} className={btnGhost} title="Add a 16-page signature at the end">
            <Plus className="h-3.5 w-3.5" /> Sig 16pp
          </button>
          <button onClick={removeLastSignature} className={btnGhost} title="Remove the last signature">
            <Minus className="h-3.5 w-3.5" /> Sig
          </button>
          <button onClick={printFlatPlan} className={btnSolid}>
            <Printer className="h-3.5 w-3.5" /> Print
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {view === "tracker" ? (
          <TrackerView
            pages={pages}
            sigByIndex={sigByIndex}
            dragIndex={dragIndex}
            setDragIndex={setDragIndex}
            reorder={reorder}
            updatePage={updatePage}
            setStage={setStage}
            setSignatureStock={setSignatureStock}
            addRowAfter={addRowAfter}
            removeRow={removeRow}
          />
        ) : view === "budget" ? (
          <BudgetView issueId={plan.id} pages={pages} updatePage={updatePage} />
        ) : (
          <FlatPlanView
            signatures={signatures}
            onOpen={setEditing}
            movePage={movePage}
            moveSignature={moveSignature}
            setSignatureStock={setSignatureStock}
            removeSignature={removeSignature}
            removePage={removePage}
            total={pages.length}
          />
        )}
      </div>

      {/* Totals bar */}
      <div className="flex flex-wrap items-center gap-x-8 gap-y-1 border-t border-border bg-card px-6 py-3 text-xs">
        <Total label="Total Sections" value={stats.sections} />
        <Total label="Total Content Received" value={`${stats.contentReceivedPct}%`} accent="#fbbf24" />
        <Total label="Total In Progress" value={`${stats.inProgressPct}%`} accent="#c084fc" />
        <Total label="% Progress" value={`${stats.progressPct}%`} accent="#60a5fa" />
        <Total label="Total Complete" value={`${stats.completePct}%`} accent="#34d399" />
        <div className="ml-auto flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-gray-700 dark:text-gray-300">
          {SECTION_KEYS.map((k) => (
            <span key={k} className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ background: SECTIONS[k].hex }} />
              {SECTIONS[k].label}
            </span>
          ))}
        </div>
      </div>

      {editing !== null && pages[editing] && (
        <EditModal
          page={pages[editing]}
          index={editing}
          onClose={() => setEditing(null)}
          onChange={(patch) => updatePage(editing, patch)}
        />
      )}
    </div>
  );
}

// Re-sequence pageNumber to match array order after any structural change.
function renumber(pages: MagazinePage[]): MagazinePage[] {
  return pages.map((p, i) => (p.pageNumber === i + 1 ? p : { ...p, pageNumber: i + 1 }));
}

const btnGhost =
  "flex items-center gap-1 rounded-lg border border-border bg-secondary px-2.5 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-400 hover:bg-muted";
const btnSolid =
  "flex items-center gap-1 rounded-lg bg-gray-900 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-gray-700";

function Total({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400">{label}</span>
      <span className="font-mono text-sm font-bold" style={{ color: accent ?? "var(--foreground)" }}>
        {value}
      </span>
    </div>
  );
}

// ===================== TRACKER VIEW (dense spreadsheet) =====================

function TrackerView({
  pages,
  sigByIndex,
  dragIndex,
  setDragIndex,
  reorder,
  updatePage,
  setStage,
  setSignatureStock,
  addRowAfter,
  removeRow,
}: {
  pages: MagazinePage[];
  sigByIndex: { sigNumber: number; sigIndex: number; stock: StockType }[];
  dragIndex: number | null;
  setDragIndex: (i: number | null) => void;
  reorder: (from: number, to: number) => void;
  updatePage: (i: number, patch: Partial<MagazinePage>) => void;
  setStage: (i: number, stage: PageStatus) => void;
  setSignatureStock: (sigIndex: number, stock: StockType) => void;
  addRowAfter: (i: number) => void;
  removeRow: (i: number) => void;
}) {
  return (
    <div className="h-full overflow-auto">
      <table className="w-full border-separate border-spacing-0 text-[11px]">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400">
            <th className={th}>#</th>
            <th className={`${th} text-center`}>Sig</th>
            <th className={`${th} text-center`}>Stock</th>
            <th className={th}>Section</th>
            <th className={th}>Feature</th>
            <th className={th}>Content</th>
            <th className={th}>Type</th>
            <th className={th}>Photographer</th>
            <th className={th}>Shoot</th>
            <th className={th}>Talent / Interview</th>
            <th className={th}>Int. Date</th>
            <th className={th}>Editor</th>
            <th className={`${th} text-center`}>Status</th>
            <th className={`${th} text-center`}>Rdy</th>
            <th className={`${th} text-center`}>Dsn</th>
            <th className={`${th} text-center`}>Cmp</th>
            <th className={th}>Notes</th>
            <th className={th}>Assets</th>
            <th className={th}></th>
          </tr>
        </thead>
        <tbody>
          {pages.map((p, i) => {
            const colour = sectionColour(p.section);
            const sig = sigByIndex[i] ?? { sigNumber: 1, sigIndex: 0, stock: "coated" as StockType };
            return (
              <tr
                key={i}
                draggable
                onDragStart={() => setDragIndex(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragIndex !== null) reorder(dragIndex, i);
                  setDragIndex(null);
                }}
                className={`group h-7 ${dragIndex === i ? "opacity-40" : ""} ${i % 2 ? "bg-muted/40" : ""}`}
              >
                <td className={td} style={{ borderLeft: `3px solid ${colour}` }}>
                  <span className="flex items-center gap-1 font-semibold text-gray-900 dark:text-gray-100">
                    <GripVertical className="h-3 w-3 cursor-grab text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-400" />
                    {p.pageNumber}
                  </span>
                </td>
                <td className={`${td} text-center`}>
                  <span className="font-mono text-[10px] font-bold text-gray-600 dark:text-gray-400">{sig.sigNumber}</span>
                </td>
                <td className={`${td} text-center`}>
                  <select
                    value={sig.stock}
                    onChange={(e) => setSignatureStock(sig.sigIndex, e.target.value as StockType)}
                    title="Stock applies to the whole signature"
                    className="cursor-pointer rounded bg-transparent text-[10px] font-bold uppercase focus:outline-none"
                    style={{ color: sig.stock === "coated" ? "#2563eb" : "#6b7280" }}
                  >
                    <option value="coated" className="bg-popover text-foreground">Coated</option>
                    <option value="uncoated" className="bg-popover text-foreground">Uncoated</option>
                  </select>
                </td>
                <td className={td}>
                  <select
                    value={p.section}
                    onChange={(e) => updatePage(i, { section: e.target.value as SectionKey })}
                    className={cellSelect}
                    style={{ color: colour }}
                  >
                    {SECTION_KEYS.map((k) => (
                      <option key={k} value={k} className="bg-popover text-foreground">
                        {k}
                      </option>
                    ))}
                  </select>
                </td>
                <CellInput value={p.feature} onChange={(v) => updatePage(i, { feature: v })} wide />
                <CellInput value={p.content} onChange={(v) => updatePage(i, { content: v })} />
                <CellInput value={p.type} onChange={(v) => updatePage(i, { type: v })} />
                <CellInput value={p.photographer} onChange={(v) => updatePage(i, { photographer: v })} />
                <CellInput value={p.shootDate} onChange={(v) => updatePage(i, { shootDate: v })} date />
                <CellInput value={p.talent} onChange={(v) => updatePage(i, { talent: v })} />
                <CellInput value={p.interviewDate} onChange={(v) => updatePage(i, { interviewDate: v })} date />
                <CellInput value={p.editor} onChange={(v) => updatePage(i, { editor: v })} />
                <td className={`${td} text-center`}>
                  <StatusDots status={p.status} onSet={(s) => setStage(i, s)} />
                </td>
                <CheckCell checked={p.readyForDesign} onToggle={(v) => setStage(i, v ? "READY_FOR_DESIGN" : "CONTENT_RECEIVED")} />
                <CheckCell checked={p.inDesign} onToggle={(v) => setStage(i, v ? "IN_DESIGN" : "READY_FOR_DESIGN")} />
                <CheckCell checked={p.complete} onToggle={(v) => setStage(i, v ? "COMPLETE" : "IN_DESIGN")} />
                <CellInput value={p.notes} onChange={(v) => updatePage(i, { notes: v })} wide />
                <AssetsCell
                  links={p.assetLinks ?? []}
                  onChange={(links) => updatePage(i, { assetLinks: links })}
                />
                <td className={td}>
                  <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                    <button onClick={() => addRowAfter(i)} title="Add row" className="rounded p-0.5 text-gray-500 dark:text-gray-400 hover:text-[#00ff88]">
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => removeRow(i)} title="Remove row" className="rounded p-0.5 text-gray-500 dark:text-gray-400 hover:text-red-400">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const th =
  "sticky top-0 z-20 border-b border-border bg-secondary px-2 py-1.5 font-semibold whitespace-nowrap";
const td = "border-b border-border px-2 py-0.5 align-middle";
const cellSelect =
  "w-full bg-transparent text-[11px] font-semibold focus:outline-none cursor-pointer";

function CellInput({
  value,
  onChange,
  wide,
  date,
}: {
  value: string;
  onChange: (v: string) => void;
  wide?: boolean;
  date?: boolean;
}) {
  return (
    <td className={td}>
      <input
        type={date ? "date" : "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${wide ? "min-w-[150px]" : "min-w-[80px]"} w-full rounded bg-transparent px-1 py-0.5 text-[11px] text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:bg-muted focus:outline-none`}
        placeholder="—"
      />
    </td>
  );
}

// Assets column — paste Google Drive / Figma / any URL. Stored URLs render as
// truncated blue links that open in a new tab; the "+" reveals an input to add
// another, and each link gets a hover × to remove it.
function AssetsCell({
  links,
  onChange,
}: {
  links: string[];
  onChange: (links: string[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  function commit() {
    const url = draft.trim();
    if (url) onChange([...links, normaliseUrl(url)]);
    setDraft("");
    setAdding(false);
  }

  return (
    <td className={td}>
      <div className="flex min-w-[120px] flex-col gap-0.5">
        {links.map((url, li) => (
          <span key={li} className="group/link flex items-center gap-1">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              title={url}
              className="flex items-center gap-0.5 truncate text-[10px] text-blue-500 hover:underline"
            >
              <ExternalLink className="h-2.5 w-2.5 shrink-0" />
              <span className="truncate">{linkLabel(url)}</span>
            </a>
            <button
              onClick={() => onChange(links.filter((_, i) => i !== li))}
              title="Remove link"
              className="opacity-0 transition group-hover/link:opacity-100"
            >
              <X className="h-2.5 w-2.5 text-gray-400 dark:text-gray-500 hover:text-red-400" />
            </button>
          </span>
        ))}
        {adding ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") {
                setDraft("");
                setAdding(false);
              }
            }}
            placeholder="Paste URL…"
            className="w-full rounded bg-muted px-1 py-0.5 text-[10px] text-gray-800 dark:text-gray-200 focus:outline-none"
          />
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-0.5 text-[10px] text-gray-400 dark:text-gray-500 hover:text-[#00ff88]"
          >
            <Plus className="h-2.5 w-2.5" /> {links.length ? "Add" : "Link"}
          </button>
        )}
      </div>
    </td>
  );
}

// Prefix a bare domain so it becomes a valid, openable link.
function normaliseUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

// Short, readable label: host + a hint of the path, truncated.
function linkLabel(url: string): string {
  try {
    const u = new URL(normaliseUrl(url));
    const tail = u.pathname.length > 1 ? u.pathname : "";
    return truncate(`${u.hostname.replace(/^www\./, "")}${tail}`, 22);
  } catch {
    return truncate(url, 22);
  }
}

// Status pipeline rendered as five 8px dots. Each is clickable to jump straight
// to that stage; dots up to the current stage are filled with that stage colour.
function StatusDots({ status, onSet }: { status: PageStatus; onSet: (s: PageStatus) => void }) {
  const currentIdx = STATUS_PIPELINE.indexOf(status);
  return (
    <div className="flex items-center justify-center gap-1" title={STATUS_LABELS[status]}>
      {STATUS_PIPELINE.map((s, idx) => {
        const reached = currentIdx >= idx;
        return (
          <button
            key={s}
            onClick={() => onSet(s)}
            title={STATUS_LABELS[s]}
            className="h-2 w-2 rounded-full transition hover:scale-125"
            style={{
              background: reached ? STATUS_STYLE[s].text : "var(--border)",
              boxShadow: idx === currentIdx ? `0 0 0 2px ${STATUS_STYLE[s].bg}` : undefined,
            }}
          />
        );
      })}
    </div>
  );
}

function CheckCell({ checked, onToggle }: { checked: boolean; onToggle: (v: boolean) => void }) {
  return (
    <td className={`${td} text-center`}>
      <button
        onClick={() => onToggle(!checked)}
        className={`mx-auto flex h-4 w-4 items-center justify-center rounded border ${
          checked ? "border-[#00ff88] bg-[#00ff88] text-black" : "border-border bg-transparent"
        }`}
      >
        {checked && <Check className="h-3 w-3" />}
      </button>
    </td>
  );
}

// ===================== FLAT PLAN VIEW (compact magazine layout) =====================

// Drop coordinate: insert BEFORE `slot` within signature `sig` (slot === pageCount
// means "append to the end of that signature").
type PageDrop = { sig: number; slot: number };

function FlatPlanView({
  signatures,
  onOpen,
  movePage,
  moveSignature,
  setSignatureStock,
  removeSignature,
  removePage,
  total,
}: {
  signatures: MagazineSignature[];
  onOpen: (i: number) => void;
  movePage: (fromSig: number, fromSlot: number, toSig: number, toSlot: number) => void;
  moveSignature: (from: number, to: number) => void;
  setSignatureStock: (sigIndex: number, stock: StockType) => void;
  removeSignature: (sigIndex: number) => void;
  removePage: (i: number) => void;
  total: number;
}) {
  const [pageDrag, setPageDrag] = useState<PageDrop | null>(null);
  const [pageTarget, setPageTarget] = useState<PageDrop | null>(null);
  const [sigDrag, setSigDrag] = useState<number | null>(null);
  const [sigTarget, setSigTarget] = useState<number | null>(null);

  function endDrag() {
    setPageDrag(null);
    setPageTarget(null);
    setSigDrag(null);
    setSigTarget(null);
  }
  function onPageDrop() {
    if (pageDrag && pageTarget) movePage(pageDrag.sig, pageDrag.slot, pageTarget.sig, pageTarget.slot);
    endDrag();
  }
  function onSigDrop() {
    if (sigDrag !== null && sigTarget !== null) moveSignature(sigDrag, sigTarget);
    endDrag();
  }

  return (
    <div className="h-full overflow-auto p-4 pl-6" onDragEnd={endDrag}>
      <div className="flex min-w-max flex-col gap-[9px]">
        {signatures.map((sig, si) => (
          <SignatureBlock
            key={si}
            sig={sig}
            isFirst={si === 0}
            total={total}
            onlySignature={signatures.length === 1}
            onOpen={onOpen}
            removePage={removePage}
            removeSignature={removeSignature}
            setSignatureStock={setSignatureStock}
            pageDrag={pageDrag}
            pageTarget={pageTarget}
            setPageDrag={setPageDrag}
            setPageTarget={setPageTarget}
            onPageDrop={onPageDrop}
            sigDrag={sigDrag}
            sigTarget={sigTarget}
            setSigDrag={setSigDrag}
            setSigTarget={setSigTarget}
            onSigDrop={onSigDrop}
          />
        ))}
      </div>
    </div>
  );
}

function SignatureBlock({
  sig,
  isFirst,
  total,
  onlySignature,
  onOpen,
  removePage,
  removeSignature,
  setSignatureStock,
  pageDrag,
  pageTarget,
  setPageDrag,
  setPageTarget,
  onPageDrop,
  sigDrag,
  sigTarget,
  setSigDrag,
  setSigTarget,
  onSigDrop,
}: {
  sig: MagazineSignature;
  isFirst: boolean;
  total: number;
  onlySignature: boolean;
  onOpen: (i: number) => void;
  removePage: (i: number) => void;
  removeSignature: (sigIndex: number) => void;
  setSignatureStock: (sigIndex: number, stock: StockType) => void;
  pageDrag: PageDrop | null;
  pageTarget: PageDrop | null;
  setPageDrag: (d: PageDrop | null) => void;
  setPageTarget: (d: PageDrop | null) => void;
  onPageDrop: () => void;
  sigDrag: number | null;
  sigTarget: number | null;
  setSigDrag: (i: number | null) => void;
  setSigTarget: (i: number | null) => void;
  onSigDrop: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const si = sig.signatureIndex;
  const coated = sig.stockType === "coated";
  const slots = sig.pages.map((_, k) => k);

  // The first signature gets the special cover treatment: Cover A as a single,
  // then Cover B + Cover C as a spread, a gap, then the rest as normal spreads.
  const coverSingle = isFirst && slots.length > 0 ? 0 : null;
  const coverSpread =
    isFirst && slots.length > 1 ? ([1, slots.length > 2 ? 2 : null] as [number, number | null]) : null;
  const bodyStart = isFirst ? 3 : 0;
  const bodySlots = slots.slice(bodyStart);

  // Split the body into runs of normal vs gatefold pages, preserving order. A
  // gatefold is a fold-out strip of panels, so it gets its own row of uniform
  // single cards (NOT an over-wide card) — exactly how it reads in the printed
  // flat plan. Normal runs chunk into rows of 16.
  const runs: { gatefold: boolean; slots: number[] }[] = [];
  for (const slot of bodySlots) {
    const gf = !!sig.pages[slot]?.isGatefold;
    const last = runs[runs.length - 1];
    if (last && last.gatefold === gf) last.slots.push(slot);
    else runs.push({ gatefold: gf, slots: [slot] });
  }
  const bodyRows: { gatefold: boolean; slots: number[] }[] = [];
  for (const run of runs) {
    if (run.gatefold) {
      bodyRows.push(run);
    } else {
      for (let i = 0; i < run.slots.length; i += 16)
        bodyRows.push({ gatefold: false, slots: run.slots.slice(i, i + 16) });
    }
  }

  const slotProps = (slot: number) => ({
    si,
    slot,
    globalIndex: sig.startIndex + slot,
    page: sig.pages[slot],
    total,
    onOpen,
    removePage,
    pageDrag,
    pageTarget,
    setPageDrag,
    setPageTarget,
    onPageDrop,
  });

  const showSigRule = sigDrag !== null && sigTarget === si && sigDrag !== si;

  // Tab (and signature) colours — coated reads blue, uncoated neutral grey. This
  // is how a real print flat plan flags a stock change: a small overhanging tab on
  // the left edge of the signature, not a space-eating inline header.
  const tabBg = coated ? "#2563eb" : "#9ca3af";

  return (
    <div className="relative ml-3">
      {showSigRule && (
        <span className="absolute -top-[5px] left-0 z-10 h-[3px] w-full rounded bg-[#3b82f6]" />
      )}

      {/* ── Left signature tab (overhangs the block; drag to move, click for stock) ── */}
      <div
        draggable
        onDragStart={() => setSigDrag(si)}
        onDragOver={(e) => {
          e.preventDefault();
          if (sigDrag !== null) setSigTarget(si);
        }}
        onDrop={onSigDrop}
        onClick={() => setMenuOpen((v) => !v)}
        title={`Sig ${si + 1} · ${sig.pageCount}pp · ${coated ? "Coated" : "Uncoated"} — drag to move, click for stock`}
        className={`absolute -left-3 top-2 z-10 flex w-6 cursor-grab flex-col items-center gap-0.5 rounded-l-md rounded-r-sm py-1.5 text-white shadow-sm active:cursor-grabbing ${
          sigDrag === si ? "opacity-40" : ""
        }`}
        style={{ background: tabBg }}
      >
        <span className="text-[11px] font-extrabold leading-none">{coated ? "C" : "U"}</span>
        <span className="text-[8px] font-bold leading-none opacity-90">S{si + 1}</span>
      </div>

      {/* Stock / remove menu */}
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} />
          <div className="absolute -left-3 top-[58px] z-30 w-36 overflow-hidden rounded-md border border-border bg-popover text-foreground shadow-lg">
            <div className="border-b border-border px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Sig {si + 1} · {sig.pageCount}pp
            </div>
            {(["coated", "uncoated"] as StockType[]).map((st) => (
              <button
                key={st}
                onClick={() => {
                  setSignatureStock(si, st);
                  setMenuOpen(false);
                }}
                className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[11px] hover:bg-muted ${
                  sig.stockType === st ? "font-bold" : ""
                }`}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: st === "coated" ? "#2563eb" : "#9ca3af" }}
                />
                {st === "coated" ? "Coated" : "Uncoated"}
                {sig.stockType === st && <Check className="ml-auto h-3 w-3" />}
              </button>
            ))}
            {!onlySignature && (
              <button
                onClick={() => {
                  setMenuOpen(false);
                  removeSignature(si);
                }}
                className="flex w-full items-center gap-2 border-t border-border px-2.5 py-1.5 text-left text-[11px] text-red-500 hover:bg-red-500/10"
              >
                <Trash2 className="h-3 w-3" /> Remove signature
              </button>
            )}
          </div>
        </>
      )}

      {/* ── Signature block ── */}
      <div
        className="rounded-lg p-2 pl-3.5"
        style={{
          border: coated ? "1px solid rgba(37,99,235,0.40)" : "1px solid var(--border)",
          background: coated
            ? "linear-gradient(180deg, rgba(219,234,254,0.45), rgba(255,255,255,0))"
            : "var(--card)",
          boxShadow: coated ? "inset 0 1px 0 rgba(255,255,255,0.7)" : undefined,
        }}
      >
        {/* ── Pages ── */}
        <div className="flex flex-col gap-[3px]">
          {/* Cover treatment row (first signature only) */}
          {isFirst && (coverSingle !== null || coverSpread) && (
            <div className="flex items-start gap-[3px]">
              {coverSingle !== null && <PageSlot {...slotProps(coverSingle)} />}
              {coverSpread && (
                <div className="flex gap-[1px]">
                  <PageSlot {...slotProps(coverSpread[0])} />
                  {coverSpread[1] !== null ? (
                    <PageSlot {...slotProps(coverSpread[1])} />
                  ) : (
                    <div className="h-[86px] w-[64px] rounded-sm border border-dashed border-border" />
                  )}
                </div>
              )}
              {/* gap before the first ad / body starts */}
              <div className="w-3" />
            </div>
          )}

          {/* Body rows. A normal 16pp row reads as the signature folds: a single
              right-hand page, seven tight spreads, then a single left-hand page.
              Facing pages within a spread sit flush (1px); spreads are split by a
              3px gap. Gatefold runs render as their own row of uniform singles. */}
          {bodyRows.map((row, ri) =>
            row.gatefold ? (
              <div key={ri} className="flex items-start gap-[3px]">
                {row.slots.map((slot) => (
                  <PageSlot key={slot} {...slotProps(slot)} />
                ))}
              </div>
            ) : (
              <div key={ri} className="flex items-start gap-[3px]">
                {/* leading single right-hand page */}
                <PageSlot {...slotProps(row.slots[0])} />
                {/* tight spreads, with the trailing odd page as a single */}
                {Array.from({ length: Math.ceil((row.slots.length - 1) / 2) }, (_, sp) => {
                  const left = row.slots[1 + sp * 2];
                  const right = row.slots[1 + sp * 2 + 1];
                  return (
                    <div key={sp} className="flex gap-[1px]">
                      <PageSlot {...slotProps(left)} />
                      {right !== undefined && <PageSlot {...slotProps(right)} />}
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function PageSlot({
  si,
  slot,
  globalIndex,
  page,
  total,
  onOpen,
  removePage,
  pageDrag,
  pageTarget,
  setPageDrag,
  setPageTarget,
  onPageDrop,
}: {
  si: number;
  slot: number;
  globalIndex: number;
  page: MagazinePage | undefined;
  total: number;
  onOpen: (i: number) => void;
  removePage: (i: number) => void;
  pageDrag: PageDrop | null;
  pageTarget: PageDrop | null;
  setPageDrag: (d: PageDrop | null) => void;
  setPageTarget: (d: PageDrop | null) => void;
  onPageDrop: () => void;
}) {
  if (!page) {
    return <div className="h-[86px] w-[64px] rounded-sm border border-dashed border-border" />;
  }
  const colour = sectionColour(page.section);
  const isSpace = page.section === "Space" && !page.feature.trim();
  const isCover = globalIndex === 0;
  const isBack = globalIndex === total - 1;
  const isGatefold = !!page.isGatefold;
  const dragging = pageDrag?.sig === si && pageDrag?.slot === slot;

  // The blue insertion rule renders on this card's left (insert before) or right
  // (insert after) edge when a drag is targeting that seam within this signature.
  const showLeftRule = pageDrag !== null && pageTarget?.sig === si && pageTarget?.slot === slot;
  const showRightRule = pageDrag !== null && pageTarget?.sig === si && pageTarget?.slot === slot + 1;

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    if (!pageDrag) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const after = e.clientX > rect.left + rect.width / 2;
    setPageTarget({ sig: si, slot: after ? slot + 1 : slot });
  }

  return (
    <div className="relative">
      {showLeftRule && (
        <span className="absolute -left-[1px] top-0 z-10 h-full w-[2px] rounded bg-[#3b82f6]" />
      )}
      {showRightRule && (
        <span className="absolute -right-[1px] top-0 z-10 h-full w-[2px] rounded bg-[#3b82f6]" />
      )}
      <button
        draggable
        onDragStart={() => setPageDrag({ sig: si, slot })}
        onDragOver={onDragOver}
        onDrop={onPageDrop}
        onClick={() => onOpen(globalIndex)}
        className={`group relative flex h-[86px] w-[64px] cursor-grab flex-col overflow-hidden rounded-sm p-1 text-left ring-1 transition hover:ring-2 active:cursor-grabbing ${
          dragging ? "opacity-40" : ""
        }`}
        style={{
          background: isSpace ? "var(--secondary)" : `${colour}5e`, // ~37% tint
          // @ts-expect-error CSS custom prop for hover ring
          "--tw-ring-color": `${colour}99`,
          outline: isGatefold ? `1px dashed ${colour}` : undefined,
          outlineOffset: isGatefold ? "-3px" : undefined,
        }}
      >
        <span
          className="absolute left-0 top-0 h-full w-[2px]"
          style={{ background: isSpace ? "var(--border)" : colour }}
        />
        {/* Remove button — only on hover so it doesn't clutter the plan. */}
        <span
          role="button"
          tabIndex={0}
          title={`Remove page ${page.pageNumber}`}
          onClick={(e) => {
            e.stopPropagation();
            removePage(globalIndex);
          }}
          className="absolute right-0.5 top-0.5 z-10 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition hover:bg-red-500 group-hover:opacity-100"
        >
          <X className="h-2.5 w-2.5" />
        </span>
        <div className="flex items-start justify-between pl-1">
          <span className="font-mono text-[7px] font-bold text-gray-900 dark:text-gray-100">{page.pageNumber}</span>
          {!isSpace && (
            <span
              className="rounded px-0.5 text-[6px] font-bold uppercase leading-tight tracking-wide text-black"
              style={{ background: colour }}
            >
              {sectionAbbr(page.section)}
            </span>
          )}
        </div>
        <p className="mt-0.5 line-clamp-3 pl-1 text-[8px] font-semibold leading-[1.1] text-gray-900 dark:text-gray-100">
          {isSpace ? <span className="text-gray-500 dark:text-gray-400">Space</span> : truncate(page.feature, 28)}
        </p>
        {(isCover || isBack || isGatefold) && (
          <span className="mt-auto flex flex-wrap gap-0.5 pl-1">
            {isGatefold && (
              <span className="rounded-sm bg-black/70 px-1 text-[6px] font-bold uppercase tracking-wide text-white">
                Gatefold
              </span>
            )}
            {(isCover || isBack) && (
              <span className="text-[6px] font-bold uppercase tracking-wide text-gray-700 dark:text-gray-300">
                {isCover ? "Front Cover" : "Back Cover"}
              </span>
            )}
          </span>
        )}
      </button>
    </div>
  );
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s;
}

function sectionAbbr(section: string): string {
  const map: Record<string, string> = {
    Cover: "COV",
    FOB: "FOB",
    Fashion: "FAS",
    "Fashion Shoot": "SHO",
    "Cover Talent": "CT",
    Feature: "FEA",
    Special: "SPL",
    Community: "COM",
    Advertorial: "AD",
    "Art & Design": "A&D",
    "Digital Focus": "DIG",
    Space: "SPC",
  };
  return map[section] ?? section.slice(0, 3).toUpperCase();
}

// ===================== EDIT MODAL =====================

function EditModal({
  page,
  index,
  onClose,
  onChange,
}: {
  page: MagazinePage;
  index: number;
  onClose: () => void;
  onChange: (patch: Partial<MagazinePage>) => void;
}) {
  const colour = sectionColour(page.section);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl border border-border bg-popover p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: colour }} />
            Page {page.pageNumber}
          </h3>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <Field label="Section">
            <select
              value={page.section}
              onChange={(e) => onChange({ section: e.target.value as SectionKey })}
              className={modalInput}
            >
              {SECTION_KEYS.map((k) => (
                <option key={k} value={k} className="bg-popover">{k}</option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select
              value={page.status}
              onChange={(e) => onChange({ status: e.target.value as PageStatus })}
              className={modalInput}
            >
              {STATUS_PIPELINE.map((s) => (
                <option key={s} value={s} className="bg-popover">{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </Field>
          <Field label="Feature" full>
            <input value={page.feature} onChange={(e) => onChange({ feature: e.target.value })} className={modalInput} />
          </Field>
          <Field label="Content">
            <input value={page.content} onChange={(e) => onChange({ content: e.target.value })} className={modalInput} />
          </Field>
          <Field label="Type">
            <input value={page.type} onChange={(e) => onChange({ type: e.target.value })} className={modalInput} />
          </Field>
          <Field label="Photographer">
            <input value={page.photographer} onChange={(e) => onChange({ photographer: e.target.value })} className={modalInput} />
          </Field>
          <Field label="Shoot Date">
            <input type="date" value={page.shootDate} onChange={(e) => onChange({ shootDate: e.target.value })} className={modalInput} />
          </Field>
          <Field label="Talent">
            <input value={page.talent} onChange={(e) => onChange({ talent: e.target.value })} className={modalInput} />
          </Field>
          <Field label="Interview Date">
            <input type="date" value={page.interviewDate} onChange={(e) => onChange({ interviewDate: e.target.value })} className={modalInput} />
          </Field>
          <Field label="Editor" full>
            <input value={page.editor} onChange={(e) => onChange({ editor: e.target.value })} className={modalInput} />
          </Field>
          <Field label="Notes" full>
            <textarea value={page.notes} onChange={(e) => onChange({ notes: e.target.value })} rows={2} className={modalInput} />
          </Field>
        </div>

        <p className="mt-3 text-[10px] text-gray-600 dark:text-gray-400">Index {index} · changes save automatically.</p>
      </div>
    </div>
  );
}

const modalInput =
  "w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-[#00ff88]/50 focus:outline-none";

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={`flex flex-col gap-1 ${full ? "col-span-2" : ""}`}>
      <span className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400">{label}</span>
      {children}
    </label>
  );
}

// ===================== PRINT =====================

function openPrintWindow(issueName: string, issueNumber: number, pages: MagazinePage[]) {
  const win = window.open("", "_blank");
  if (!win) return;
  const cards = pages
    .map((p) => {
      const colour = sectionColour(p.section);
      const isSpace = p.section === "Space" && !p.feature.trim();
      return `<div class="card${p.isGatefold ? " gf" : ""}" style="border-top:4px solid ${isSpace ? "#ddd" : colour}">
        <div class="pn">${p.pageNumber}${p.isGatefold ? ' <span class="gflbl">GATEFOLD</span>' : ""}</div>
        <div class="ft">${escapeHtml(isSpace ? "Space" : p.feature)}</div>
        <div class="sec" style="color:${colour}">${escapeHtml(p.section)}</div>
        <div class="ty">${escapeHtml(p.type)}</div>
      </div>`;
    })
    .join("");
  win.document.write(`<!doctype html><html><head><title>Flat Plan — Issue ${String(issueNumber).padStart(2, "0")} ${escapeHtml(issueName)}</title>
  <style>
    body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#fff;color:#111;margin:24px}
    h1{font-size:18px;margin:0 0 4px}
    .meta{font-size:11px;color:#666;margin-bottom:16px}
    .grid{display:grid;grid-template-columns:repeat(8,1fr);gap:6px}
    .card{border:1px solid #e5e5e5;border-radius:4px;padding:6px;min-height:72px;break-inside:avoid}
    .card.gf{outline:1px dashed #999;outline-offset:-3px}
    .gflbl{display:inline-block;background:#111;color:#fff;font-size:6px;padding:0 3px;border-radius:2px;vertical-align:middle}
    .pn{font-size:9px;font-weight:700;color:#999}
    .ft{font-size:9px;font-weight:600;line-height:1.2;margin-top:2px}
    .sec{font-size:7px;text-transform:uppercase;letter-spacing:.05em;margin-top:3px;font-weight:700}
    .ty{font-size:7px;color:#999;text-transform:uppercase;margin-top:1px}
    @media print{.card{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
  </style></head><body>
  <h1>Outlander Magazine — Issue ${String(issueNumber).padStart(2, "0")} ${escapeHtml(issueName)}</h1>
  <div class="meta">${pages.length} pages · Flat plan</div>
  <div class="grid">${cards}</div>
  <script>window.onload=function(){window.print()}</script>
  </body></html>`);
  win.document.close();
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string
  );
}
