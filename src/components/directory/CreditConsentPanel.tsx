"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Loader2, RefreshCw, Send, Check, X, AlertTriangle, Lock,
  ChevronDown, ChevronUp, Pencil, Trash2, Copy, FlaskConical, UserPlus, BadgeCheck,
  CalendarClock, PauseCircle, Download, Table2, RotateCw, ExternalLink,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Print credit consent — the tracker. Who we're crediting, who has been asked,
// who has signed, who said no, and which rows can't be sent at all because the
// sheet's email is missing or malformed.
//
// The test-mode banner is loud on purpose. Until CREDIT_SEND_LIVE=true exists
// on the server, every send goes to the test inbox — the banner is the one
// place that state is visible, so it must never be subtle.
// ─────────────────────────────────────────────────────────────────────────────

interface CreditRow {
  id: string;
  contactId: string | null;
  token: string;
  name: string;
  role: string | null;
  instagram: string | null;
  email: string | null;
  tier: number | null;
  status: string;
  scheduledFor: string | null;
  sentAt: string | null;
  sentTo: string | null;
  isTest: boolean;
  emailError: string | null;
  openedAt: string | null;
  respondedAt: string | null;
  confirmedName: string | null;
  confirmedRole: string | null;
  confirmedBio: string | null;
  // Characters this person's description may run to — 90 at tier 1, 75 at
  // tier 2, null when their tier is never asked. Derived server-side.
  bioLimit: number | null;
  confirmedInstagram: string | null;
  confirmedEmail: string | null;
  address: Record<string, string> | null;
  agreementAcceptedAt: string | null;
  agreementVersion: string | null;
  printConsent: boolean | null;
  declineNote: string | null;
}

interface Payload {
  sendingLive: boolean;
  testInbox: string;
  /** The public host invites point at. Null = links carry this host instead. */
  publicBase: string | null;
  defaultPerHour: number;
  deadline: { at: string; label: string; open: boolean };
  queue: { queued: number; nextDue: string | null; lastOf: string | null };
  sheet: {
    spreadsheetUrl: string;
    lastSyncedAt: string | null;
    lastError: string | null;
    rowsWritten: number;
  } | null;
  rows: CreditRow[];
  summary: {
    total: number; draft: number; sent: number; opened: number;
    confirmed: number; queued: number; declined: number; failed: number; unsendable: number;
  };
}

const emailOk = (v: string | null) => !!v && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);

const STATUS_META: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: "Not sent", cls: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
  QUEUED: { label: "Queued", cls: "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300" },
  SENDING: { label: "Sending", cls: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200" },
  SENT: { label: "Sent", cls: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  OPENED: { label: "Opened", cls: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  CONFIRMED: { label: "Confirmed", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
  DECLINED: { label: "Declined", cls: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
  FAILED: { label: "Send failed", cls: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
};

type Filter = "all" | "unsent" | "queued" | "awaiting" | "confirmed" | "declined" | "problems";

export default function CreditConsentPanel() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null); // action key, for spinners
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<string | null>(null); // expanded row id
  const [editingEmail, setEditingEmail] = useState<{ id: string; value: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", email: "", role: "", instagram: "", tier: "" });
  const [perHour, setPerHour] = useState(20);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/directory/credits", { cache: "no-store" });
      const d = await res.json();
      if (d.error) setError(d.error);
      else { setData(d); setError(null); }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function act(key: string, body: Record<string, unknown>, done?: (d: Record<string, unknown>) => void) {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/directory/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) { setError(String(d.error ?? "That didn’t work.")); return; }
      done?.(d);
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(null);
    }
  }

  // Confirmed people lead the list wherever they'd appear: they're the result
  // this tool exists to produce, and their signed credentials are what goes to
  // print. Within the group, most recent signature first.
  const confirmedFirst = useCallback((list: CreditRow[]) => {
    const confirmed = list
      .filter((r) => r.status === "CONFIRMED")
      .sort((a, b) => (b.respondedAt ?? "").localeCompare(a.respondedAt ?? ""));
    return [...confirmed, ...list.filter((r) => r.status !== "CONFIRMED")];
  }, []);

  const rows = useMemo(() => {
    if (!data) return [];
    switch (filter) {
      case "unsent": return data.rows.filter((r) => r.status === "DRAFT" && emailOk(r.email));
      case "queued": return data.rows
        .filter((r) => r.status === "QUEUED" || r.status === "SENDING")
        .sort((a, b) => (a.scheduledFor ?? "").localeCompare(b.scheduledFor ?? ""));
      case "awaiting": return data.rows.filter((r) => r.status === "SENT" || r.status === "OPENED");
      case "confirmed": return data.rows.filter((r) => r.status === "CONFIRMED");
      case "declined": return data.rows.filter((r) => r.status === "DECLINED");
      case "problems":
        return data.rows.filter((r) => r.status === "FAILED" || !emailOk(r.email));
      default: return confirmedFirst(data.rows);
    }
  }, [data, filter, confirmedFirst]);

  const sendableUnsent = useMemo(
    () => (data?.rows ?? []).filter((r) => r.status === "DRAFT" && emailOk(r.email)).map((r) => r.id),
    [data]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={22} className="animate-spin text-gray-400" />
      </div>
    );
  }

  const s = data?.summary;

  return (
    <div className="space-y-4">
      {/* ── Mode banner — the single loudest thing on the page ── */}
      {data && !data.sendingLive ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-700 dark:bg-amber-900/25">
          <FlaskConical size={16} className="mt-0.5 shrink-0 text-amber-700 dark:text-amber-400" />
          <div>
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              Test mode — nothing reaches a real contributor
            </p>
            <p className="mt-0.5 text-xs text-amber-800 dark:text-amber-300">
              Every send, including &ldquo;send all&rdquo;, is redirected to{" "}
              <span className="font-mono">{data.testInbox}</span> with the intended recipient named
              in the subject line. Going live requires setting{" "}
              <span className="font-mono">CREDIT_SEND_LIVE=true</span> on the server — there is no
              switch on this page.
            </p>
          </div>
        </div>
      ) : data ? (
        <div className="flex items-center gap-2 rounded-xl border border-red-300 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-900/25">
          <AlertTriangle size={15} className="text-red-700 dark:text-red-300" />
          <p className="text-sm font-semibold text-red-800 dark:text-red-200">
            LIVE — sends go to real contributors.
          </p>
        </div>
      ) : null}

      {/* ── Summary ── */}
      {s && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-8">
          <Tile label="People" value={s.total} onClick={() => setFilter("all")} active={filter === "all"} />
          <Tile label="Not sent" value={s.draft} onClick={() => setFilter("unsent")} active={filter === "unsent"} />
          <Tile label="Queued" value={s.queued} onClick={() => setFilter("queued")} active={filter === "queued"} />
          <Tile label="Awaiting" value={s.sent + s.opened} onClick={() => setFilter("awaiting")} active={filter === "awaiting"} />
          <Tile label="Confirmed" value={s.confirmed} tone="good" onClick={() => setFilter("confirmed")} active={filter === "confirmed"} />
          <Tile label="Declined" value={s.declined} tone={s.declined > 0 ? "bad" : undefined} onClick={() => setFilter("declined")} active={filter === "declined"} />
          <Tile label="Failed" value={s.failed} tone={s.failed > 0 ? "bad" : undefined} onClick={() => setFilter("problems")} active={filter === "problems"} />
          <Tile label="Bad email" value={s.unsendable} tone={s.unsendable > 0 ? "warn" : undefined} onClick={() => setFilter("problems")} active={false} />
        </div>
      )}

      {/* ── The sendout ──
          Pacing is the whole point: 239 near-identical emails out of one Gmail
          mailbox in five minutes is what gets a sender filtered, and a filtered
          invite is a contributor who never appears in the Directory. Nothing
          here sends immediately — it stamps each invite with the moment it is
          due, and the server works through them. */}
      {data && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h3 className="text-sm font-semibold text-foreground">Sendout</h3>
            <p className="text-xs text-muted-foreground">
              {data.deadline.open ? (
                <>Confirmations close <span className="font-medium text-foreground">{data.deadline.label}</span></>
              ) : (
                <span className="font-medium text-red-600 dark:text-red-400">
                  Closed {data.deadline.label} — the queue is holding and the public page is shut
                </span>
              )}
            </p>
          </div>

          {!data.publicBase && (
            <p className="mt-2.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-900/25 dark:text-amber-200">
              <b>CREDIT_PUBLIC_URL isn&rsquo;t set</b>, so invites will carry whichever host you
              opened this page on. Set it to the public domain before a real sendout, or 239
              people get a link to the staff system.
            </p>
          )}

          {data.queue.queued > 0 ? (
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
              <span className="text-foreground">
                <b className="tabular-nums">{data.queue.queued}</b> waiting to go out
              </span>
              {data.queue.nextDue && (
                <span className="text-muted-foreground">Next at {fmt(data.queue.nextDue)}</span>
              )}
              {data.queue.lastOf && (
                <span className="text-muted-foreground">Last at {fmt(data.queue.lastOf)}</span>
              )}
              {data.queue.lastOf && data.queue.lastOf > data.deadline.at && (
                <span className="font-medium text-red-600 dark:text-red-400">
                  The tail of this queue lands after the deadline — raise the rate
                </span>
              )}
              <button
                onClick={() => act("pause", { action: "unschedule" }, (d) =>
                  setNotice(`Paused — ${d.paused} invite${d.paused === 1 ? "" : "s"} taken off the queue.`)
                )}
                disabled={busy !== null}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
              >
                {busy === "pause" ? <Loader2 size={11} className="animate-spin" /> : <PauseCircle size={12} />}
                Pause the queue
              </button>
              <button
                onClick={() => act("drain", { action: "drain" }, (d) =>
                  setNotice(
                    d.closed
                      ? "Holding — the deadline has passed, so nothing was sent."
                      : `${d.sent} sent now${d.failed ? `, ${d.failed} failed` : ""}.`
                  )
                )}
                disabled={busy !== null}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
              >
                {busy === "drain" ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
                Send anything due now
              </button>
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <label className="text-xs text-muted-foreground">
                <span className="mb-1 block font-semibold uppercase tracking-wide">Rate</span>
                <select
                  value={perHour}
                  onChange={(e) => setPerHour(Number(e.target.value))}
                  className="rounded-lg border border-border bg-background px-2.5 py-2 text-sm text-foreground"
                >
                  <option value={10}>10 an hour — one every 6 min</option>
                  <option value={20}>20 an hour — one every 3 min</option>
                  <option value={30}>30 an hour — one every 2 min</option>
                  <option value={60}>60 an hour — one a minute</option>
                </select>
              </label>
              <button
                onClick={() =>
                  act("schedule", { action: "schedule", ids: sendableUnsent, perHour }, (d) =>
                    setNotice(
                      `${d.queued} invite${d.queued === 1 ? "" : "s"} queued at ${d.perHour}/hour — ` +
                      `first ${fmt(String(d.firstAt))}, last ${fmt(String(d.lastAt))}` +
                      `${d.skipped ? ` · ${d.skipped} skipped for a bad address` : ""}.`
                    )
                  )
                }
                disabled={busy !== null || sendableUnsent.length === 0 || !data.deadline.open}
                className="inline-flex items-center gap-1.5 rounded-xl bg-foreground px-3.5 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
              >
                {busy === "schedule" ? <Loader2 size={14} className="animate-spin" /> : <CalendarClock size={14} />}
                Queue {sendableUnsent.length} unsent
              </button>
              <p className="max-w-md text-xs text-muted-foreground">
                Spread across 09:00–19:00 London, resuming the next morning if a day fills up.
                Closing this page doesn&rsquo;t stop it — the schedule lives on the server.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── The designer's live sheet ──
          One URL the designer keeps, rewritten from the ledger every time a
          credit is signed. Created private: pre-announcement the contributor
          list IS the confidential part of Issue 02, and every contributor has
          signed an agreement to keep it quiet. */}
      {data && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Table2 size={14} className="text-muted-foreground" />
              Designer&rsquo;s sheet
            </h3>
            {data.sheet ? (
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={data.sheet.spreadsheetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                >
                  <ExternalLink size={11} /> Open the sheet
                </a>
                <button
                  onClick={() => act("sheet-sync", { action: "sheet-sync" }, (d) =>
                    setNotice(`Sheet rewritten — ${d.rows} confirmed credit${d.rows === 1 ? "" : "s"}.`)
                  )}
                  disabled={busy !== null}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
                >
                  {busy === "sheet-sync" ? <Loader2 size={11} className="animate-spin" /> : <RotateCw size={11} />}
                  Rewrite now
                </button>
              </div>
            ) : (
              <button
                onClick={() => act("sheet-create", { action: "sheet-create" }, () =>
                  setNotice("Sheet created in your Google Drive. Share it with the designer from there.")
                )}
                disabled={busy !== null}
                className="inline-flex items-center gap-1.5 rounded-xl bg-foreground px-3.5 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
              >
                {busy === "sheet-create" ? <Loader2 size={14} className="animate-spin" /> : <Table2 size={14} />}
                Create it in my Drive
              </button>
            )}
          </div>

          {data.sheet ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {data.sheet.rowsWritten} confirmed credit{data.sheet.rowsWritten === 1 ? "" : "s"} in it
              {data.sheet.lastSyncedAt ? `, last written ${fmt(data.sheet.lastSyncedAt)}` : ""}. It
              rewrites itself whenever somebody confirms. Names, disciplines, handles and
              descriptions only — no emails, no addresses. Only columns A&ndash;F are touched,
              so your own notes and filters elsewhere in the file survive.
            </p>
          ) : (
            <p className="mt-2 max-w-2xl text-xs text-muted-foreground">
              A single Google Sheet the designer can keep open, rewritten from here every time a
              credit is signed. It&rsquo;s made in your own Drive with your Google connection and
              stays private until you share it — the contributor list is the confidential part of
              Issue 02, and they&rsquo;ve each signed an agreement saying so.
            </p>
          )}

          {data.sheet?.lastError && (
            <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-900/25 dark:text-red-300">
              Last write failed: {data.sheet.lastError}
            </p>
          )}
        </div>
      )}

      {/* ── Actions ── */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => act("import", { action: "import" }, (d) =>
            setNotice(`Imported from the sheet — ${d.created} new, ${d.updated} refreshed.`)
          )}
          disabled={busy !== null}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3.5 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
        >
          {busy === "import" ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          {data?.rows.length ? "Re-import sheet" : "Import from sheet"}
        </button>
        <a
          href="/api/directory/credits?export=designer"
          className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3.5 py-2 text-sm font-medium text-foreground hover:bg-muted"
          title="Confirmed credits only — no emails, no addresses"
        >
          <Download size={14} />
          Export for the designer
        </a>
        <button
          onClick={() => setAdding((v) => !v)}
          disabled={busy !== null}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3.5 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
        >
          <UserPlus size={14} />
          Add person
        </button>
      </div>

      {adding && (
        <form
          className="grid gap-2 rounded-2xl border border-border bg-card p-4 sm:grid-cols-[1.2fr_1.4fr_1fr_1fr_90px_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            void act("add", { action: "add", ...addForm }, () => {
              setNotice(`${addForm.name} added to the list.`);
              setAdding(false);
              setAddForm({ name: "", email: "", role: "", instagram: "", tier: "" });
            });
          }}
        >
          <input required autoFocus placeholder="Name" value={addForm.name}
            onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <input type="email" placeholder="Email" value={addForm.email}
            onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <input placeholder="Skill" value={addForm.role}
            onChange={(e) => setAddForm({ ...addForm, role: e.target.value })}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <input placeholder="Instagram" value={addForm.instagram}
            onChange={(e) => setAddForm({ ...addForm, instagram: e.target.value })}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <select value={addForm.tier}
            onChange={(e) => setAddForm({ ...addForm, tier: e.target.value })}
            className="rounded-lg border border-border bg-background px-2 py-2 text-sm">
            <option value="">Tier</option><option value="1">1</option><option value="2">2</option><option value="3">3</option>
          </select>
          <button type="submit" disabled={busy !== null}
            className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50">
            {busy === "add" ? <Loader2 size={13} className="animate-spin" /> : "Add"}
          </button>
        </form>
      )}

      {notice && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/25 dark:text-emerald-200">
          {notice}
        </p>
      )}
      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/25 dark:text-red-300">
          {error}
        </p>
      )}

      {/* ── Empty state ── */}
      {data && data.rows.length === 0 && (
        <div className="rounded-2xl border border-border bg-card px-6 py-14 text-center">
          <h3 className="text-base font-semibold text-foreground">No credit requests yet</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Import the contributor sheet to create one request per person. Nothing is emailed until
            you press send — and in test mode, sends only ever reach {data.testInbox}.
          </p>
        </div>
      )}

      {/* ── The list ── */}
      {rows.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="grid grid-cols-[minmax(140px,1.4fr)_minmax(100px,1fr)_minmax(160px,1.6fr)_90px_110px_150px] items-center gap-2 border-b border-border bg-muted px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            <span>Name</span><span>Skill</span><span>Email</span><span>Tier</span><span>Status</span><span className="text-right">Actions</span>
          </div>
          {rows.map((r, i) => {
            const meta = STATUS_META[r.status] ?? STATUS_META.DRAFT;
            const bad = !emailOk(r.email);
            const expanded = open === r.id;
            const isConfirmed = r.status === "CONFIRMED";
            // The divider between the signed group and everyone else.
            const firstUnconfirmed =
              filter === "all" && !isConfirmed && (i === 0 || rows[i - 1].status === "CONFIRMED");
            const showConfirmedHeader = filter === "all" && isConfirmed && i === 0;
            return (
              <div key={r.id} className="border-b border-border last:border-0">
                {showConfirmedHeader && (
                  <div className="flex items-center gap-1.5 border-b border-border bg-emerald-50/60 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
                    <BadgeCheck size={12} /> Confirmed for print — credentials as signed
                  </div>
                )}
                {firstUnconfirmed && i > 0 && (
                  <div className="border-b border-border bg-muted px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Everyone else
                  </div>
                )}
                <div className="grid grid-cols-[minmax(140px,1.4fr)_minmax(100px,1fr)_minmax(160px,1.6fr)_90px_110px_150px] items-center gap-2 px-4 py-2.5 text-sm">
                  <span className="truncate font-medium text-foreground">
                    {/* A confirmed row shows what was SIGNED, not what the sheet
                        guessed — the signed version is what goes to print. */}
                    {isConfirmed ? (r.confirmedName ?? r.name) : r.name}
                    {(isConfirmed ? r.confirmedInstagram : r.instagram) && (
                      <span className="ml-1.5 text-xs text-muted-foreground">
                        @{isConfirmed ? r.confirmedInstagram : r.instagram}
                      </span>
                    )}
                  </span>
                  <span className="truncate text-muted-foreground">
                    {isConfirmed ? (r.confirmedRole ?? r.role ?? "—") : (r.role ?? "—")}
                  </span>
                  <span className="flex min-w-0 items-center gap-1.5">
                    {editingEmail?.id === r.id ? (
                      <form
                        className="flex w-full items-center gap-1"
                        onSubmit={(e) => {
                          e.preventDefault();
                          void act(`update-${r.id}`, { action: "update", id: r.id, email: editingEmail.value });
                          setEditingEmail(null);
                        }}
                      >
                        <input
                          autoFocus
                          type="text"
                          value={editingEmail.value}
                          onChange={(e) => setEditingEmail({ id: r.id, value: e.target.value })}
                          className="w-full rounded border border-border bg-background px-1.5 py-0.5 text-xs"
                        />
                        <button type="submit" className="text-emerald-700"><Check size={13} /></button>
                        <button type="button" onClick={() => setEditingEmail(null)} className="text-muted-foreground"><X size={13} /></button>
                      </form>
                    ) : (
                      <>
                        <span className={`truncate text-xs ${bad ? "font-medium text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
                          {r.email || "no email"}
                        </span>
                        <button
                          onClick={() => setEditingEmail({ id: r.id, value: r.email ?? "" })}
                          title="Fix email"
                          className="shrink-0 text-muted-foreground hover:text-foreground"
                        >
                          <Pencil size={12} />
                        </button>
                        {bad && <AlertTriangle size={12} className="shrink-0 text-red-500" />}
                      </>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {r.tier ? `Tier ${r.tier}` : "—"}
                    {r.scheduledFor && (r.status === "QUEUED" || r.status === "SENDING") && (
                      <span className="block text-[11px] text-violet-700 dark:text-violet-300">
                        {fmt(r.scheduledFor)}
                      </span>
                    )}
                  </span>
                  <span>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.cls}`}>
                      {meta.label}
                      {r.isTest && r.sentAt && r.status !== "DRAFT" && (
                        <FlaskConical size={10} className="opacity-70" aria-label="test send" />
                      )}
                    </span>
                  </span>
                  <span className="flex items-center justify-end gap-1.5">
                    {r.status !== "CONFIRMED" && r.status !== "DECLINED" && emailOk(r.email) && (
                      <button
                        onClick={() => act(`send-${r.id}`, { action: "send", ids: [r.id] }, () =>
                          setNotice(
                            data?.sendingLive
                              ? `Invite sent to ${r.email}.`
                              : `Test invite for ${r.name} sent to ${data?.testInbox}.`
                          )
                        )}
                        disabled={busy !== null}
                        className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
                      >
                        {busy === `send-${r.id}` ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
                        {r.sentAt ? "Resend" : "Send"}
                      </button>
                    )}
                    <button
                      onClick={() => {
                        void navigator.clipboard.writeText(`${location.origin}/credit/${r.token}`);
                        setNotice(`Link for ${r.name} copied.`);
                      }}
                      title="Copy their personal link"
                      className="rounded-lg border border-border p-1 text-muted-foreground hover:bg-muted"
                    >
                      <Copy size={12} />
                    </button>
                    <button
                      onClick={() => setOpen(expanded ? null : r.id)}
                      title="Details"
                      className="rounded-lg border border-border p-1 text-muted-foreground hover:bg-muted"
                    >
                      {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                  </span>
                </div>

                {expanded && (
                  <div className="border-t border-border bg-muted/40 px-4 py-3 text-sm">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        {r.scheduledFor && <DetailRow k="Due" v={fmt(r.scheduledFor)} />}
                        <DetailRow k="Sent" v={r.sentAt ? `${fmt(r.sentAt)} → ${r.sentTo}${r.isTest ? " (test)" : ""}` : "not yet"} />
                        <DetailRow k="Opened" v={r.openedAt ? fmt(r.openedAt) : "—"} />
                        <DetailRow k="Agreement" v={r.agreementAcceptedAt ? `accepted ${fmt(r.agreementAcceptedAt)} · ${r.agreementVersion}` : "not accepted"} />
                        <DetailRow k="Responded" v={r.respondedAt ? fmt(r.respondedAt) : "—"} />
                        {r.emailError && <DetailRow k="Error" v={r.emailError} bad />}
                        {r.declineNote && <DetailRow k="Their note" v={r.declineNote} />}
                      </div>
                      <div className="space-y-1.5">
                        {r.status === "CONFIRMED" ? (
                          <>
                            <DetailRow k="Credit as" v={r.confirmedName ?? "—"} strong />
                            <DetailRow k="Discipline" v={r.confirmedRole ?? "—"} strong />
                            {r.bioLimit !== null && (
                              <DetailRow
                                k={`Description (${r.bioLimit} max)`}
                                v={
                                  r.confirmedBio
                                    ? `${r.confirmedBio}  ·  ${[...r.confirmedBio].length} chars`
                                    : "— none given"
                                }
                                strong={!!r.confirmedBio}
                                bad={!r.confirmedBio}
                              />
                            )}
                            <DetailRow k="Handle" v={r.confirmedInstagram ? `@${r.confirmedInstagram}` : "—"} />
                            <DetailRow k="Email" v={r.confirmedEmail ?? "—"} />
                            {r.address && (
                              <div className="mt-2 rounded-lg border border-border bg-card p-2.5">
                                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                  <Lock size={10} /> Address — delivery only, never printed
                                </p>
                                <p className="mt-1 whitespace-pre-line text-xs text-foreground">
                                  {["line1", "line2", "city", "region", "postcode", "country"]
                                    .map((k) => r.address?.[k])
                                    .filter(Boolean)
                                    .join("\n")}
                                </p>
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            <p className="text-xs text-muted-foreground">No response yet.</p>
                            <p className="text-xs text-muted-foreground">
                              {r.bioLimit !== null
                                ? `Tier ${r.tier} — will be asked for a ${r.bioLimit}-character description.`
                                : "No description asked at this tier."}
                            </p>
                          </>
                        )}
                        {r.status === "DRAFT" && (
                          <button
                            onClick={() => act(`del-${r.id}`, { action: "delete", id: r.id })}
                            className="mt-2 inline-flex items-center gap-1 text-xs text-red-600 hover:underline dark:text-red-400"
                          >
                            <Trash2 size={11} /> Remove from the list
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function fmt(v: string) {
  return new Date(v).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function DetailRow({ k, v, bad, strong }: { k: string; v: string; bad?: boolean; strong?: boolean }) {
  return (
    <p className="text-xs">
      <span className="font-semibold uppercase tracking-wide text-muted-foreground">{k}: </span>
      <span className={bad ? "text-red-600 dark:text-red-400" : strong ? "font-semibold text-foreground" : "text-foreground"}>{v}</span>
    </p>
  );
}

function Tile({
  label, value, tone, onClick, active,
}: {
  label: string; value: number; tone?: "good" | "bad" | "warn"; onClick: () => void; active: boolean;
}) {
  const toneCls =
    tone === "good" ? "text-emerald-700 dark:text-emerald-400"
    : tone === "bad" ? "text-red-700 dark:text-red-400"
    : tone === "warn" ? "text-amber-700 dark:text-amber-400"
    : "text-foreground";
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border px-3 py-2 text-left transition-colors ${
        active ? "border-foreground bg-card" : "border-border bg-card hover:bg-muted"
      }`}
    >
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`text-xl font-semibold tabular-nums ${toneCls}`}>{value}</p>
    </button>
  );
}
