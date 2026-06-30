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
import BudgetView from "@/components/print/BudgetView";
import {
  SECTIONS,
  SECTION_KEYS,
  STATUS_PIPELINE,
  STATUS_LABELS,
  STATUS_STYLE,
  advanceStatus,
  blankPage,
  computeStats,
  sectionColour,
  syncStatusFlags,
  type MagazinePage,
  type PageStatus,
  type SectionKey,
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
  const [view, setView] = useState<View>("tracker");
  const [editing, setEditing] = useState<number | null>(null); // index into pages
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const pages = plan?.pages ?? [];
  const stats = useMemo(() => computeStats(pages), [pages]);
  const blocks = Math.round(pages.length / 8);

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
  function removePage(index: number) {
    const p = pages[index];
    if (!p) return;
    if (
      !confirm(
        `Remove page ${p.pageNumber}? This will remove the page and renumber remaining pages.`
      )
    )
      return;
    mutateStructural(pages.filter((_, i) => i !== index));
  }

  function addBlock(size: number) {
    const start = pages.length;
    const extra = Array.from({ length: size }, (_, i) => blankPage(start + i + 1));
    mutateStructural([...pages, ...extra]);
  }

  function removeLastBlock() {
    if (pages.length <= 8) {
      alert("A magazine must keep at least one 8-page section.");
      return;
    }
    if (!confirm("Remove the last 8 pages? This can't be undone once saved.")) return;
    mutateStructural(pages.slice(0, pages.length - 8));
  }

  function reorder(from: number, to: number) {
    if (from === to) return;
    const next = [...pages];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    mutateStructural(next);
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
      <div className="flex h-full flex-col items-center justify-center bg-background text-center text-gray-500">
        <Cloud className="mb-3 h-8 w-8 text-gray-400" />
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
      {/* Header */}
      <div className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background/90 px-6 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <Link
            href="/print"
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-secondary text-gray-500 hover:text-foreground"
            title="All issues"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </Link>
          <div>
            <h1 className="flex items-center gap-2 text-base font-semibold text-foreground">
              <span className="h-2 w-2 rounded-full bg-[#00ff88]" />
              Issue {String(plan.issueNumber).padStart(2, "0")} — {plan.issueName}
            </h1>
            <p className="text-xs text-gray-500">
              {pages.length} pages ({blocks} × 8-page sections)
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
                view === "tracker" ? "bg-[#00ff88] text-black" : "text-gray-500 hover:text-foreground"
              }`}
            >
              <Table2 className="h-3.5 w-3.5" /> Tracker
            </button>
            <button
              onClick={() => setView("flatplan")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                view === "flatplan" ? "bg-[#00ff88] text-black" : "text-gray-500 hover:text-foreground"
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Flat Plan
            </button>
            <button
              onClick={() => setView("budget")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                view === "budget" ? "bg-[#00ff88] text-black" : "text-gray-500 hover:text-foreground"
              }`}
            >
              <PoundSterling className="h-3.5 w-3.5" /> Budget
            </button>
          </div>

          {/* Block management */}
          <button onClick={() => addBlock(8)} className={btnGhost}>
            <Plus className="h-3.5 w-3.5" /> 8 Pages
          </button>
          <button onClick={() => addBlock(16)} className={btnGhost}>
            <Plus className="h-3.5 w-3.5" /> 16 Pages
          </button>
          <button onClick={removeLastBlock} className={btnGhost}>
            <Minus className="h-3.5 w-3.5" /> Last Block
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
            dragIndex={dragIndex}
            setDragIndex={setDragIndex}
            reorder={reorder}
            updatePage={updatePage}
            setStage={setStage}
            addRowAfter={addRowAfter}
            removeRow={removeRow}
          />
        ) : view === "budget" ? (
          <BudgetView issueId={plan.id} pages={pages} updatePage={updatePage} />
        ) : (
          <FlatPlanView
            pages={pages}
            onOpen={setEditing}
            reorder={reorder}
            removePage={removePage}
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
        <div className="ml-auto flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-gray-700">
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
  "flex items-center gap-1 rounded-lg border border-border bg-secondary px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-muted";
const btnSolid =
  "flex items-center gap-1 rounded-lg bg-gray-900 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-gray-700";

function Total({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[10px] uppercase tracking-wider text-gray-500">{label}</span>
      <span className="font-mono text-sm font-bold" style={{ color: accent ?? "var(--foreground)" }}>
        {value}
      </span>
    </div>
  );
}

// ===================== TRACKER VIEW (dense spreadsheet) =====================

function TrackerView({
  pages,
  dragIndex,
  setDragIndex,
  reorder,
  updatePage,
  setStage,
  addRowAfter,
  removeRow,
}: {
  pages: MagazinePage[];
  dragIndex: number | null;
  setDragIndex: (i: number | null) => void;
  reorder: (from: number, to: number) => void;
  updatePage: (i: number, patch: Partial<MagazinePage>) => void;
  setStage: (i: number, stage: PageStatus) => void;
  addRowAfter: (i: number) => void;
  removeRow: (i: number) => void;
}) {
  return (
    <div className="h-full overflow-auto">
      <table className="w-full border-separate border-spacing-0 text-[11px]">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-wider text-gray-500">
            <th className={th}>#</th>
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
                  <span className="flex items-center gap-1 font-semibold text-gray-900">
                    <GripVertical className="h-3 w-3 cursor-grab text-gray-400 group-hover:text-gray-600" />
                    {p.pageNumber}
                  </span>
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
                    <button onClick={() => addRowAfter(i)} title="Add row" className="rounded p-0.5 text-gray-500 hover:text-[#00ff88]">
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => removeRow(i)} title="Remove row" className="rounded p-0.5 text-gray-500 hover:text-red-400">
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
        className={`${wide ? "min-w-[150px]" : "min-w-[80px]"} w-full rounded bg-transparent px-1 py-0.5 text-[11px] text-gray-800 placeholder-gray-400 focus:bg-muted focus:outline-none`}
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
              <X className="h-2.5 w-2.5 text-gray-400 hover:text-red-400" />
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
            className="w-full rounded bg-muted px-1 py-0.5 text-[10px] text-gray-800 focus:outline-none"
          />
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-0.5 text-[10px] text-gray-400 hover:text-[#00ff88]"
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

const PAGES_PER_ROW = 16; // 8 spread pairs

function FlatPlanView({
  pages,
  onOpen,
  reorder,
  removePage,
}: {
  pages: MagazinePage[];
  onOpen: (i: number) => void;
  reorder: (from: number, to: number) => void;
  removePage: (i: number) => void;
}) {
  // Drag-to-reorder state. `dragIndex` is the page being dragged; `dropBefore` is
  // the array index the dragged page would be inserted in front of (a value of
  // pages.length means "drop at the very end"). The blue rule renders at that seam.
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropBefore, setDropBefore] = useState<number | null>(null);

  function handleDrop() {
    if (dragIndex !== null && dropBefore !== null) {
      // dropBefore is an insert-before index in the ORIGINAL array; once the dragged
      // page is spliced out, every later target shifts down by one.
      let to = dropBefore;
      if (dragIndex < dropBefore) to = dropBefore - 1;
      reorder(dragIndex, to);
    }
    setDragIndex(null);
    setDropBefore(null);
  }

  // Chunk pages into rows of 16; each row renders as 8 tight spread pairs.
  const rows: number[][] = [];
  for (let i = 0; i < pages.length; i += PAGES_PER_ROW) {
    rows.push(Array.from({ length: Math.min(PAGES_PER_ROW, pages.length - i) }, (_, k) => i + k));
  }

  return (
    <div className="h-full overflow-auto p-4">
      <div className="flex min-w-max flex-col" onDragEnd={() => { setDragIndex(null); setDropBefore(null); }}>
        {rows.map((row, ri) => {
          const first = row[0];
          const last = row[row.length - 1];
          return (
            <div key={ri} className={ri > 0 ? "mt-3 border-t border-border/50 pt-3" : ""}>
              <div className="mb-1 font-mono text-[8px] uppercase tracking-wider text-gray-400">
                pp. {pages[first]?.pageNumber}–{pages[last]?.pageNumber}
              </div>
              <div className="flex items-start gap-[5px]">
                {Array.from({ length: Math.ceil(row.length / 2) }, (_, sp) => {
                  const li = row[sp * 2];
                  const ri2 = row[sp * 2 + 1];
                  return (
                    <div key={sp} className="flex gap-[1.5px]">
                      <PageCard
                        index={li}
                        pages={pages}
                        onOpen={onOpen}
                        dragIndex={dragIndex}
                        dropBefore={dropBefore}
                        setDragIndex={setDragIndex}
                        setDropBefore={setDropBefore}
                        onDrop={handleDrop}
                        removePage={removePage}
                        total={pages.length}
                      />
                      <PageCard
                        index={ri2 ?? null}
                        pages={pages}
                        onOpen={onOpen}
                        dragIndex={dragIndex}
                        dropBefore={dropBefore}
                        setDragIndex={setDragIndex}
                        setDropBefore={setDropBefore}
                        onDrop={handleDrop}
                        removePage={removePage}
                        total={pages.length}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PageCard({
  index,
  pages,
  onOpen,
  dragIndex,
  dropBefore,
  setDragIndex,
  setDropBefore,
  onDrop,
  removePage,
  total,
}: {
  index: number | null;
  pages: MagazinePage[];
  onOpen: (i: number) => void;
  dragIndex: number | null;
  dropBefore: number | null;
  setDragIndex: (i: number | null) => void;
  setDropBefore: (i: number | null) => void;
  onDrop: () => void;
  removePage: (i: number) => void;
  total: number;
}) {
  if (index === null) {
    return <div className="h-[86px] w-[64px] rounded-sm border border-dashed border-border" />;
  }
  const p = pages[index];
  const colour = sectionColour(p.section);
  const isSpace = p.section === "Space" && !p.feature.trim();
  const isCover = index === 0;
  const isBack = index === total - 1;

  // Where the blue insertion rule sits relative to THIS card: on its left when the
  // pointer is over the left half (insert before), on its right for the last card.
  const showLeftRule = dropBefore === index && dragIndex !== null;
  const showRightRule = dropBefore === index + 1 && dragIndex !== null;

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const after = e.clientX > rect.left + rect.width / 2;
    setDropBefore(after ? index! + 1 : index!);
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
        onDragStart={() => setDragIndex(index)}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onClick={() => onOpen(index)}
        className={`group relative flex h-[86px] w-[64px] cursor-grab flex-col overflow-hidden rounded-sm p-1 text-left ring-1 transition hover:ring-2 active:cursor-grabbing ${
          dragIndex === index ? "opacity-40" : ""
        }`}
        style={{
          background: isSpace ? "var(--secondary)" : `${colour}5e`, // ~37% tint
          // @ts-expect-error CSS custom prop for hover ring
          "--tw-ring-color": `${colour}99`,
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
          title={`Remove page ${p.pageNumber}`}
          onClick={(e) => {
            e.stopPropagation();
            removePage(index!);
          }}
          className="absolute right-0.5 top-0.5 z-10 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition hover:bg-red-500 group-hover:opacity-100"
        >
          <X className="h-2.5 w-2.5" />
        </span>
        <div className="flex items-start justify-between pl-1">
          <span className="font-mono text-[7px] font-bold text-gray-900">{p.pageNumber}</span>
          {!isSpace && (
            <span
              className="rounded px-0.5 text-[6px] font-bold uppercase leading-tight tracking-wide text-black"
              style={{ background: colour }}
            >
              {sectionAbbr(p.section)}
            </span>
          )}
        </div>
        <p className="mt-0.5 line-clamp-3 pl-1 text-[8px] font-semibold leading-[1.1] text-gray-900">
          {isSpace ? <span className="text-gray-500">Space</span> : truncate(p.feature, 28)}
        </p>
        {(isCover || isBack) && (
          <span className="mt-auto pl-1 text-[6px] font-bold uppercase tracking-wide text-gray-700">
            {isCover ? "Front Cover" : "Back Cover"}
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
          <button onClick={onClose} className="text-gray-500 hover:text-foreground">
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

        <p className="mt-3 text-[10px] text-gray-600">Index {index} · changes save automatically.</p>
      </div>
    </div>
  );
}

const modalInput =
  "w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-gray-900 placeholder:text-gray-400 focus:border-[#00ff88]/50 focus:outline-none";

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={`flex flex-col gap-1 ${full ? "col-span-2" : ""}`}>
      <span className="text-[10px] uppercase tracking-wider text-gray-500">{label}</span>
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
      return `<div class="card" style="border-top:4px solid ${isSpace ? "#ddd" : colour}">
        <div class="pn">${p.pageNumber}</div>
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
