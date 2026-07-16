"use client";

import { useState, useEffect, useCallback, useRef, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Loader2, Check, Edit2, Eye, FileDown, Plus, Trash2, Send, PenLine, Ban,
} from "lucide-react";
import { IODocument, type IOViewData } from "../IODocument";
import { IO_SIGNATORY, type IOLineItem, type IOStatus } from "@/lib/io-template";

// Same two-mode shape as the call sheet page:
//   editor  — the variable fields, auto-saved as you type.
//   preview — the printable IODocument; window.print() captures it as the PDF.
type Mode = "editor" | "preview";

const BRASS = "#9C7C2E";

const STATUS_BADGES: Record<IOStatus, { cls: string; label: string }> = {
  DRAFT: { cls: "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400", label: "Draft" },
  SENT: { cls: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300", label: "Sent" },
  SIGNED: { cls: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300", label: "Signed" },
  VOID: { cls: "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400", label: "Void" },
};

interface IORecord {
  id: string;
  ioNumber: string;
  status: IOStatus;
  advertiserName: string;
  campaignName: string;
  clientOrAgency: string;
  poNumber: string | null;
  contactName: string | null;
  contactEmail: string | null;
  lineItems: IOLineItem[];
  totalNet: number;
  notes: string | null;
  signedName: string | null;
  signedTitle: string | null;
  campaign: { id: string; title: string; client: { id: string; name: string } };
}

function emptyLine(): IOLineItem {
  return { startDate: "", endDate: "", description: "", quantity: 1, rate: 0, subtotal: 0 };
}

export default function InsertionOrderPage({
  params,
}: {
  params: Promise<{ id: string; ioId: string }>;
}) {
  const { id, ioId } = use(params);
  const router = useRouter();

  const [io, setIo] = useState<IORecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [mode, setMode] = useState<Mode>("editor");
  const [statusBusy, setStatusBusy] = useState(false);

  // ── Form state (the variable fields) ──
  const [advertiserName, setAdvertiserName] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [clientOrAgency, setClientOrAgency] = useState("CLIENT");
  const [poNumber, setPoNumber] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [lineItems, setLineItems] = useState<IOLineItem[]>([emptyLine()]);
  const [notes, setNotes] = useState("");
  const [signedName, setSignedName] = useState("");
  const [signedTitle, setSignedTitle] = useState("");

  const totalNet = lineItems.reduce((t, li) => t + (Number(li.subtotal) || 0), 0);

  // ── Load ──
  useEffect(() => {
    fetch(`/api/insertion-orders/${ioId}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.insertionOrder) return;
        const rec: IORecord = d.insertionOrder;
        setIo(rec);
        setAdvertiserName(rec.advertiserName);
        setCampaignName(rec.campaignName);
        setClientOrAgency(rec.clientOrAgency);
        setPoNumber(rec.poNumber ?? "");
        setContactName(rec.contactName ?? "");
        setContactEmail(rec.contactEmail ?? "");
        setLineItems(Array.isArray(rec.lineItems) && rec.lineItems.length ? rec.lineItems : [emptyLine()]);
        setNotes(rec.notes ?? "");
        setSignedName(rec.signedName ?? "");
        setSignedTitle(rec.signedTitle ?? "");
        // Signed / sent IOs open straight into the preview.
        if (rec.status === "SIGNED" || rec.status === "SENT") setMode("preview");
      })
      .finally(() => setLoading(false));
  }, [ioId]);

  // ── Auto-save (debounced, whole payload) ──
  // Everything the editor can change, serialised; the effect below diffs this
  // string so a render without edits never writes.
  const payload = {
    advertiserName, campaignName, clientOrAgency, poNumber, contactName,
    contactEmail, lineItems, notes, signedName, signedTitle,
  };
  const payloadJson = JSON.stringify(payload);
  const payloadRef = useRef(payloadJson);
  payloadRef.current = payloadJson;
  const baselineRef = useRef<string | null>(null); // last payload the server holds

  const persist = useCallback(async () => {
    const body = payloadRef.current;
    if (body === baselineRef.current) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/insertion-orders/${ioId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body,
      });
      const d = await res.json();
      if (d.insertionOrder) {
        baselineRef.current = body;
        setIo((prev) => (prev ? { ...prev, ...d.insertionOrder, campaign: prev.campaign } : prev));
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  }, [ioId]);

  useEffect(() => {
    if (!io) return;
    // First pass after load establishes the baseline instead of saving.
    if (baselineRef.current === null) {
      baselineRef.current = payloadJson;
      return;
    }
    if (payloadJson === baselineRef.current) return;
    const t = setTimeout(persist, 600);
    return () => clearTimeout(t);
  }, [payloadJson, io, persist]);

  // ── Line-item helpers ──
  function patchLine(i: number, patch: Partial<IOLineItem>) {
    setLineItems((rows) =>
      rows.map((row, idx) => {
        if (idx !== i) return row;
        const next = { ...row, ...patch };
        // Qty / rate changes recompute the subtotal; a direct subtotal edit
        // sticks (the printed PDF's subtotals aren't always qty × rate).
        if (patch.quantity !== undefined || patch.rate !== undefined) {
          next.subtotal = Math.round((Number(next.quantity) || 0) * (Number(next.rate) || 0) * 100) / 100;
        }
        return next;
      })
    );
  }

  // ── Status transitions ──
  async function setStatus(status: IOStatus) {
    setStatusBusy(true);
    try {
      await persist(); // don't let a status stamp race an unsaved edit
      const res = await fetch(`/api/insertion-orders/${ioId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const d = await res.json();
      if (d.insertionOrder) {
        setIo((prev) => (prev ? { ...prev, ...d.insertionOrder, campaign: prev.campaign } : prev));
      }
    } finally {
      setStatusBusy(false);
    }
  }

  async function deleteDraft() {
    if (!confirm("Delete this draft insertion order?")) return;
    const res = await fetch(`/api/insertion-orders/${ioId}`, { method: "DELETE" });
    if (res.ok) router.push(`/commercial/deals/${id}`);
  }

  async function goPreview() {
    await persist();
    setMode("preview");
  }

  const viewData: IOViewData = {
    ioNumber: io?.ioNumber ?? "",
    advertiserName, campaignName, clientOrAgency, poNumber, contactName,
    contactEmail, lineItems, totalNet, notes, signedName, signedTitle,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-card flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-gray-400 dark:text-gray-500" />
      </div>
    );
  }

  if (!io) {
    return (
      <div className="min-h-screen bg-card flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-4">Insertion order not found.</p>
          <Link href={`/commercial/deals/${id}`} className="text-[#9C7C2E] text-sm font-medium hover:underline">
            Back to Deal
          </Link>
        </div>
      </div>
    );
  }

  const badge = STATUS_BADGES[io.status] ?? STATUS_BADGES.DRAFT;

  return (
    <div className="min-h-screen bg-card print:bg-white" data-callsheet-print>
      <div className="max-w-4xl mx-auto px-6 py-10 print:px-0 print:py-0 print:max-w-none">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-6 print:hidden">
          <Link
            href={`/commercial/deals/${id}`}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
          >
            <ArrowLeft size={15} />
            {io.campaign.title}
          </Link>
          <div className="flex items-center gap-2">
            {saved && (
              <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                <Check size={13} /> Saved
              </span>
            )}
            {mode === "editor" ? (
              <button
                onClick={goPreview}
                disabled={saving}
                className="flex items-center gap-1.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-5 py-2 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60 shadow-sm"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
                Preview
              </button>
            ) : (
              <>
                <button
                  onClick={() => setMode("editor")}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <Edit2 size={13} /> Back to Editor
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-5 py-2 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity shadow-sm"
                >
                  <FileDown size={14} /> Download PDF
                </button>
              </>
            )}
          </div>
        </div>

        {/* Title / status / lifecycle controls */}
        <div className="mb-6 flex flex-wrap items-center gap-3 print:hidden">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
            {io.ioNumber}
          </h1>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badge.cls}`}>{badge.label}</span>
          <span className="text-xs text-gray-400 dark:text-gray-500">{io.campaign.client.name}</span>
          <div className="ml-auto flex items-center gap-2">
            {io.status === "DRAFT" && (
              <>
                <button
                  onClick={() => setStatus("SENT")}
                  disabled={statusBusy}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors disabled:opacity-50"
                >
                  <Send size={12} /> Mark as Sent
                </button>
                <button
                  onClick={deleteDraft}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-400 hover:text-red-500 hover:border-red-200 dark:hover:border-red-800 transition-colors"
                >
                  <Trash2 size={12} /> Delete
                </button>
              </>
            )}
            {io.status === "SENT" && (
              <>
                <button
                  onClick={() => setStatus("SIGNED")}
                  disabled={statusBusy}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors disabled:opacity-50"
                >
                  <PenLine size={12} /> Mark as Signed
                </button>
                <button
                  onClick={() => setStatus("VOID")}
                  disabled={statusBusy}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-400 hover:text-red-500 hover:border-red-200 dark:hover:border-red-800 transition-colors disabled:opacity-50"
                >
                  <Ban size={12} /> Void
                </button>
              </>
            )}
            {io.status === "SIGNED" && (
              <span className="text-xs text-gray-400">Signed — the deal&apos;s IO milestone is stamped.</span>
            )}
            {io.status === "VOID" && (
              <button
                onClick={() => setStatus("DRAFT")}
                disabled={statusBusy}
                className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                Reopen as Draft
              </button>
            )}
          </div>
        </div>

        {mode === "editor" ? (
          <div className="space-y-5 print:hidden">
            {/* Order details */}
            <Card title="Order details">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Advertiser">
                  <TextInput value={advertiserName} onChange={setAdvertiserName} placeholder="Advertiser / company name" />
                </Field>
                <Field label="Campaign Name">
                  <TextInput value={campaignName} onChange={setCampaignName} placeholder="Campaign name" />
                </Field>
                <Field label="Client or Agency">
                  <select
                    value={clientOrAgency}
                    onChange={(e) => setClientOrAgency(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#9C7C2E]/30 focus:border-[#9C7C2E]"
                  >
                    <option value="CLIENT">Client</option>
                    <option value="AGENCY">Agency</option>
                  </select>
                </Field>
                <Field label="PO Number">
                  <TextInput value={poNumber} onChange={setPoNumber} placeholder="Client PO number (optional)" />
                </Field>
              </div>
            </Card>

            {/* Contacts */}
            <Card title="Client contact" hint={`Outlander contact is fixed: ${IO_SIGNATORY.name} · ${IO_SIGNATORY.email}`}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Full Name">
                  <TextInput value={contactName} onChange={setContactName} placeholder="Client contact name" />
                </Field>
                <Field label="E-mail Address">
                  <TextInput value={contactEmail} onChange={setContactEmail} placeholder="name@client.com" type="email" />
                </Field>
              </div>
            </Card>

            {/* Media line items */}
            <Card title="Media">
              <div className="overflow-x-auto -mx-2 px-2">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide text-left">
                      <th className="pb-2 pr-2 font-semibold w-[13%]">Start</th>
                      <th className="pb-2 pr-2 font-semibold w-[13%]">End</th>
                      <th className="pb-2 pr-2 font-semibold">Description</th>
                      <th className="pb-2 pr-2 font-semibold w-[8%]">Qty</th>
                      <th className="pb-2 pr-2 font-semibold w-[13%]">Rate £</th>
                      <th className="pb-2 pr-2 font-semibold w-[14%]">Subtotal £</th>
                      <th className="pb-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((li, i) => (
                      <tr key={i} className="align-top">
                        <td className="py-1 pr-2">
                          <CellInput value={li.startDate} onChange={(v) => patchLine(i, { startDate: v })} placeholder="Feb 2026" />
                        </td>
                        <td className="py-1 pr-2">
                          <CellInput value={li.endDate} onChange={(v) => patchLine(i, { endDate: v })} placeholder="Feb 2026" />
                        </td>
                        <td className="py-1 pr-2">
                          <CellInput value={li.description} onChange={(v) => patchLine(i, { description: v })} placeholder="1x INSTAGRAM POST" />
                        </td>
                        <td className="py-1 pr-2">
                          <CellInput
                            value={String(li.quantity)}
                            onChange={(v) => patchLine(i, { quantity: Number(v) || 0 })}
                            type="number"
                          />
                        </td>
                        <td className="py-1 pr-2">
                          <CellInput
                            value={String(li.rate)}
                            onChange={(v) => patchLine(i, { rate: Number(v) || 0 })}
                            type="number"
                          />
                        </td>
                        <td className="py-1 pr-2">
                          <CellInput
                            value={String(li.subtotal)}
                            onChange={(v) => patchLine(i, { subtotal: Number(v) || 0 })}
                            type="number"
                          />
                        </td>
                        <td className="py-1">
                          <button
                            onClick={() => setLineItems((rows) => (rows.length > 1 ? rows.filter((_, idx) => idx !== i) : [emptyLine()]))}
                            className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            title="Remove line"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  onClick={() => setLineItems((rows) => [...rows, emptyLine()])}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <Plus size={12} /> Add line
                </button>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
                  Total Net Cost{" "}
                  <span style={{ color: BRASS }}>
                    £{totalNet.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} GBP
                  </span>
                </p>
              </div>
            </Card>

            {/* Notes */}
            <Card title="Additional notes">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Anything the client needs to know — payment schedule, usage, exclusivity…"
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#9C7C2E]/30 focus:border-[#9C7C2E] resize-y"
              />
            </Card>

            {/* Client signatory */}
            <Card title="Client signatory" hint="Who signs for the buyer — printed on the signature block.">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Name">
                  <TextInput value={signedName} onChange={setSignedName} placeholder="Signatory name" />
                </Field>
                <Field label="Job Title">
                  <TextInput value={signedTitle} onChange={setSignedTitle} placeholder="e.g. Marketing Director" />
                </Field>
              </div>
            </Card>
          </div>
        ) : (
          /* Preview — the live document; printing captures exactly this. */
          <div className="bg-white rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-8 print:p-0 print:border-none print:shadow-none print:rounded-none">
            <IODocument data={viewData} />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Small form primitives (Paper Standard) ───────────────────────────────────

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-6">
      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">{title}</h3>
      {hint && <p className="text-xs text-gray-400 mb-3">{hint}</p>}
      <div className={hint ? "" : "mt-3"}>{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">{label}</span>
      {children}
    </label>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#9C7C2E]/30 focus:border-[#9C7C2E]"
    />
  );
}

function CellInput({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#9C7C2E]/30 focus:border-[#9C7C2E]"
    />
  );
}
