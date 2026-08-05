"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Loader2, RefreshCw, Send, Check, X, AlertTriangle, Lock,
  ChevronDown, ChevronUp, Pencil, Trash2, Copy, FlaskConical,
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
  sentAt: string | null;
  sentTo: string | null;
  isTest: boolean;
  emailError: string | null;
  openedAt: string | null;
  respondedAt: string | null;
  confirmedName: string | null;
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
  rows: CreditRow[];
  summary: {
    total: number; draft: number; sent: number; opened: number;
    confirmed: number; declined: number; failed: number; unsendable: number;
  };
}

const emailOk = (v: string | null) => !!v && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);

const STATUS_META: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: "Not sent", cls: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
  SENT: { label: "Sent", cls: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  OPENED: { label: "Opened", cls: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  CONFIRMED: { label: "Confirmed", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
  DECLINED: { label: "Declined", cls: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
  FAILED: { label: "Send failed", cls: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
};

type Filter = "all" | "unsent" | "awaiting" | "confirmed" | "declined" | "problems";

export default function CreditConsentPanel() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null); // action key, for spinners
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<string | null>(null); // expanded row id
  const [editingEmail, setEditingEmail] = useState<{ id: string; value: string } | null>(null);

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

  const rows = useMemo(() => {
    if (!data) return [];
    switch (filter) {
      case "unsent": return data.rows.filter((r) => r.status === "DRAFT" && emailOk(r.email));
      case "awaiting": return data.rows.filter((r) => r.status === "SENT" || r.status === "OPENED");
      case "confirmed": return data.rows.filter((r) => r.status === "CONFIRMED");
      case "declined": return data.rows.filter((r) => r.status === "DECLINED");
      case "problems":
        return data.rows.filter((r) => r.status === "FAILED" || !emailOk(r.email));
      default: return data.rows;
    }
  }, [data, filter]);

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
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-7">
          <Tile label="People" value={s.total} onClick={() => setFilter("all")} active={filter === "all"} />
          <Tile label="Not sent" value={s.draft} onClick={() => setFilter("unsent")} active={filter === "unsent"} />
          <Tile label="Awaiting" value={s.sent + s.opened} onClick={() => setFilter("awaiting")} active={filter === "awaiting"} />
          <Tile label="Confirmed" value={s.confirmed} tone="good" onClick={() => setFilter("confirmed")} active={filter === "confirmed"} />
          <Tile label="Declined" value={s.declined} tone={s.declined > 0 ? "bad" : undefined} onClick={() => setFilter("declined")} active={filter === "declined"} />
          <Tile label="Failed" value={s.failed} tone={s.failed > 0 ? "bad" : undefined} onClick={() => setFilter("problems")} active={filter === "problems"} />
          <Tile label="Bad email" value={s.unsendable} tone={s.unsendable > 0 ? "warn" : undefined} onClick={() => setFilter("problems")} active={false} />
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
        {sendableUnsent.length > 0 && (
          <button
            onClick={() => act("sendAll", { action: "send", ids: sendableUnsent }, (d) => {
              const fails = (d.failures as unknown[])?.length ?? 0;
              setNotice(
                `${d.sent} invite${d.sent === 1 ? "" : "s"} ${data?.sendingLive ? "sent" : `sent to ${data?.testInbox} (test mode)`}${fails ? ` · ${fails} failed` : ""}.`
              );
            })}
            disabled={busy !== null}
            className="inline-flex items-center gap-1.5 rounded-xl bg-foreground px-3.5 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
          >
            {busy === "sendAll" ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Send all unsent ({sendableUnsent.length})
          </button>
        )}
      </div>

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
          {rows.map((r) => {
            const meta = STATUS_META[r.status] ?? STATUS_META.DRAFT;
            const bad = !emailOk(r.email);
            const expanded = open === r.id;
            return (
              <div key={r.id} className="border-b border-border last:border-0">
                <div className="grid grid-cols-[minmax(140px,1.4fr)_minmax(100px,1fr)_minmax(160px,1.6fr)_90px_110px_150px] items-center gap-2 px-4 py-2.5 text-sm">
                  <span className="truncate font-medium text-foreground">
                    {r.name}
                    {r.instagram && (
                      <span className="ml-1.5 text-xs text-muted-foreground">@{r.instagram}</span>
                    )}
                  </span>
                  <span className="truncate text-muted-foreground">{r.role ?? "—"}</span>
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
                  <span className="text-xs text-muted-foreground">{r.tier ? `Tier ${r.tier}` : "—"}</span>
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
                          <p className="text-xs text-muted-foreground">No response yet.</p>
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
