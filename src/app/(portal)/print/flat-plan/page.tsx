"use client";

import { useMemo, useState } from "react";
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
} from "lucide-react";
import { useMagazinePlan } from "@/components/print/usePlan";
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

type View = "tracker" | "flatplan";

export default function FlatPlanPage() {
  const { plan, loading, saving, error, savePages } = useMagazinePlan();
  const [view, setView] = useState<View>("tracker");
  const [editing, setEditing] = useState<number | null>(null); // index into pages
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const pages = plan?.pages ?? [];
  const stats = useMemo(() => computeStats(pages), [pages]);
  const blocks = Math.round(pages.length / 8);

  function mutate(next: MagazinePage[]) {
    savePages(next, next.length);
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
    mutate(next);
  }

  function removeRow(index: number) {
    mutate(pages.filter((_, i) => i !== index));
  }

  function addBlock(size: number) {
    const start = pages.length;
    const extra = Array.from({ length: size }, (_, i) => blankPage(start + i + 1));
    mutate([...pages, ...extra]);
  }

  function removeLastBlock() {
    if (pages.length <= 8) {
      alert("A magazine must keep at least one 8-page section.");
      return;
    }
    if (!confirm("Remove the last 8 pages? This can't be undone once saved.")) return;
    mutate(pages.slice(0, pages.length - 8));
  }

  function reorder(from: number, to: number) {
    if (from === to) return;
    const next = [...pages];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    mutate(next);
  }

  function printFlatPlan() {
    openPrintWindow(plan?.issueName ?? "", plan?.issueNumber ?? 0, pages);
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#0a0a0a]">
        <Loader2 className="h-6 w-6 animate-spin text-[#00ff88]" />
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-[#0a0a0a] text-center text-gray-400">
        <Cloud className="mb-3 h-8 w-8 text-gray-600" />
        <p className="text-sm">Couldn&apos;t load the magazine plan.</p>
        {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-[#0a0a0a] text-gray-200">
      {/* Header */}
      <div className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-white/5 bg-[#0a0a0a]/90 px-6 py-3 backdrop-blur">
        <div>
          <h1 className="flex items-center gap-2 text-base font-semibold text-white">
            <span className="h-2 w-2 rounded-full bg-[#00ff88]" />
            Flat Plan — Issue {String(plan.issueNumber).padStart(2, "0")} {plan.issueName}
          </h1>
          <p className="text-xs text-gray-500">
            {pages.length} pages ({blocks} × 8-page sections)
            {saving ? " · saving…" : plan.updatedBy ? ` · last edit ${plan.updatedBy}` : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg bg-white/5 p-0.5">
            <button
              onClick={() => setView("tracker")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                view === "tracker" ? "bg-[#00ff88] text-black" : "text-gray-400 hover:text-white"
              }`}
            >
              <Table2 className="h-3.5 w-3.5" /> Tracker
            </button>
            <button
              onClick={() => setView("flatplan")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                view === "flatplan" ? "bg-[#00ff88] text-black" : "text-gray-400 hover:text-white"
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Flat Plan
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

      <div className="flex-1 overflow-auto">
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
            advance={(i) => updatePage(i, { status: advanceStatus(pages[i].status) })}
          />
        ) : (
          <FlatPlanView pages={pages} onOpen={setEditing} />
        )}
      </div>

      {/* Totals bar */}
      <div className="flex flex-wrap items-center gap-x-8 gap-y-1 border-t border-white/5 bg-[#0d0d0d] px-6 py-3 text-xs">
        <Total label="Total Sections" value={stats.sections} />
        <Total label="Content Received" value={`${stats.contentReceivedPct}%`} accent="#fbbf24" />
        <Total label="In Progress" value={`${stats.inProgressPct}%`} accent="#c084fc" />
        <Total label="% Progress" value={`${stats.progressPct}%`} accent="#60a5fa" />
        <Total label="Complete" value={`${stats.completePct}%`} accent="#34d399" />
        <div className="ml-auto flex items-center gap-2 text-[10px] text-gray-600">
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

const btnGhost =
  "flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-gray-300 hover:bg-white/10";
const btnSolid =
  "flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-black hover:bg-gray-200";

function Total({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[10px] uppercase tracking-wider text-gray-500">{label}</span>
      <span className="font-mono text-sm font-bold" style={{ color: accent ?? "#fff" }}>
        {value}
      </span>
    </div>
  );
}

// ===================== TRACKER VIEW =====================

function TrackerView({
  pages,
  dragIndex,
  setDragIndex,
  reorder,
  updatePage,
  setStage,
  addRowAfter,
  removeRow,
  advance,
}: {
  pages: MagazinePage[];
  dragIndex: number | null;
  setDragIndex: (i: number | null) => void;
  reorder: (from: number, to: number) => void;
  updatePage: (i: number, patch: Partial<MagazinePage>) => void;
  setStage: (i: number, stage: PageStatus) => void;
  addRowAfter: (i: number) => void;
  removeRow: (i: number) => void;
  advance: (i: number) => void;
}) {
  return (
    <div className="min-w-full overflow-x-auto p-4">
      <table className="w-full border-separate border-spacing-0 text-xs">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-wider text-gray-500">
            <th className={th}>#</th>
            <th className={th}>Section</th>
            <th className={th}>Feature</th>
            <th className={th}>Content</th>
            <th className={th}>Type</th>
            <th className={th}>Photographer</th>
            <th className={th}>Shoot Date</th>
            <th className={th}>Talent / Interview</th>
            <th className={th}>Interview Date</th>
            <th className={th}>Editor</th>
            <th className={th}>Status Pipeline</th>
            <th className={`${th} text-center`}>Ready</th>
            <th className={`${th} text-center`}>In Design</th>
            <th className={`${th} text-center`}>Complete</th>
            <th className={th}>Notes</th>
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
                className={`group ${dragIndex === i ? "opacity-40" : ""}`}
                style={{ background: i % 2 ? "rgba(255,255,255,0.015)" : "transparent" }}
              >
                <td className={td} style={{ borderLeft: `3px solid ${colour}` }}>
                  <span className="flex items-center gap-1 text-gray-500">
                    <GripVertical className="h-3 w-3 cursor-grab text-gray-700 group-hover:text-gray-500" />
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
                      <option key={k} value={k} className="bg-[#141414] text-white">
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
                <td className={td}>
                  <StatusPill status={p.status} onClick={() => advance(i)} />
                </td>
                <CheckCell checked={p.readyForDesign} onToggle={(v) => setStage(i, v ? "READY_FOR_DESIGN" : "CONTENT_RECEIVED")} />
                <CheckCell checked={p.inDesign} onToggle={(v) => setStage(i, v ? "IN_DESIGN" : "READY_FOR_DESIGN")} />
                <CheckCell checked={p.complete} onToggle={(v) => setStage(i, v ? "COMPLETE" : "IN_DESIGN")} />
                <CellInput value={p.notes} onChange={(v) => updatePage(i, { notes: v })} wide />
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

const th = "border-b border-white/10 px-2 py-2 font-semibold whitespace-nowrap";
const td = "border-b border-white/5 px-2 py-1 align-middle";
const cellSelect =
  "w-full bg-transparent text-xs font-semibold focus:outline-none cursor-pointer";

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
        className={`${wide ? "min-w-[160px]" : "min-w-[90px]"} w-full rounded bg-transparent px-1 py-0.5 text-xs text-gray-200 placeholder-gray-700 focus:bg-white/5 focus:outline-none`}
        placeholder="—"
        style={date ? { colorScheme: "dark" } : undefined}
      />
    </td>
  );
}

function StatusPill({ status, onClick }: { status: PageStatus; onClick: () => void }) {
  const s = STATUS_STYLE[status];
  return (
    <button
      onClick={onClick}
      title="Click to advance"
      className="whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold transition hover:brightness-125"
      style={{ color: s.text, background: s.bg, borderColor: s.border }}
    >
      {STATUS_LABELS[status]}
    </button>
  );
}

function CheckCell({ checked, onToggle }: { checked: boolean; onToggle: (v: boolean) => void }) {
  return (
    <td className={`${td} text-center`}>
      <button
        onClick={() => onToggle(!checked)}
        className={`mx-auto flex h-4 w-4 items-center justify-center rounded border ${
          checked ? "border-[#00ff88] bg-[#00ff88] text-black" : "border-white/15 bg-transparent"
        }`}
      >
        {checked && <Check className="h-3 w-3" />}
      </button>
    </td>
  );
}

// ===================== FLAT PLAN VIEW =====================

function FlatPlanView({ pages, onOpen }: { pages: MagazinePage[]; onOpen: (i: number) => void }) {
  // Group into spreads: page 1 sits alone on the right (cover), then even-left /
  // odd-right pairs, like opening a physical magazine.
  const spreads: { left: number | null; right: number | null }[] = [];
  spreads.push({ left: null, right: 0 }); // cover
  for (let i = 1; i < pages.length; i += 2) {
    spreads.push({ left: i, right: i + 1 < pages.length ? i + 1 : null });
  }

  return (
    <div className="p-5">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {spreads.map((sp, si) => {
          // Cover is spread 0; after it, mark a divider every 4 spreads (8 pages).
          const showBlockDivider = si > 1 && (si - 1) % 4 === 0;
          return (
            <div key={si} className="space-y-2">
              {showBlockDivider && (
                <div className="flex items-center gap-2 text-[9px] uppercase tracking-widest text-gray-600">
                  <span className="h-px flex-1 bg-white/10" />
                  8-page section
                  <span className="h-px flex-1 bg-white/10" />
                </div>
              )}
              <div className="flex gap-1.5 rounded-lg bg-white/[0.02] p-1.5 ring-1 ring-white/5">
                <PageCard index={sp.left} pages={pages} onOpen={onOpen} />
                <PageCard index={sp.right} pages={pages} onOpen={onOpen} />
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
}: {
  index: number | null;
  pages: MagazinePage[];
  onOpen: (i: number) => void;
}) {
  if (index === null) {
    return <div className="flex-1 rounded-md border border-dashed border-white/5" />;
  }
  const p = pages[index];
  const colour = sectionColour(p.section);
  const isSpace = p.section === "Space" && !p.feature.trim();
  return (
    <button
      onClick={() => onOpen(index)}
      className="group relative flex aspect-[3/4] flex-1 flex-col overflow-hidden rounded-md p-2 text-left ring-1 transition hover:ring-2"
      style={{
        background: isSpace ? "rgba(255,255,255,0.02)" : `${colour}1a`,
        // @ts-expect-error CSS custom prop for hover ring
        "--tw-ring-color": `${colour}66`,
      }}
    >
      <span
        className="absolute left-0 top-0 h-full w-1"
        style={{ background: isSpace ? "rgba(255,255,255,0.06)" : colour }}
      />
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] font-bold text-gray-400">{p.pageNumber}</span>
        {!isSpace && (
          <span
            className="rounded px-1 py-px text-[7px] font-bold uppercase tracking-wide"
            style={{ background: `${colour}33`, color: colour }}
          >
            {p.section}
          </span>
        )}
      </div>
      <p className="mt-1 line-clamp-3 text-[10px] font-semibold leading-tight text-gray-100">
        {isSpace ? <span className="text-gray-700">Space</span> : p.feature}
      </p>
      {!isSpace && p.type && (
        <span className="mt-auto text-[8px] uppercase tracking-wide text-gray-500">{p.type}</span>
      )}
    </button>
  );
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
        className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#141414] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: colour }} />
            Page {page.pageNumber}
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white">
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
                <option key={k} value={k} className="bg-[#141414]">{k}</option>
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
                <option key={s} value={s} className="bg-[#141414]">{STATUS_LABELS[s]}</option>
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
            <input type="date" value={page.shootDate} onChange={(e) => onChange({ shootDate: e.target.value })} className={modalInput} style={{ colorScheme: "dark" }} />
          </Field>
          <Field label="Talent">
            <input value={page.talent} onChange={(e) => onChange({ talent: e.target.value })} className={modalInput} />
          </Field>
          <Field label="Interview Date">
            <input type="date" value={page.interviewDate} onChange={(e) => onChange({ interviewDate: e.target.value })} className={modalInput} style={{ colorScheme: "dark" }} />
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
  "w-full rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-xs text-gray-200 focus:border-[#00ff88]/50 focus:outline-none";

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
