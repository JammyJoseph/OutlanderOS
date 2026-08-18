"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Loader2, UserPlus, Users, Check, ChevronDown, ChevronUp, Copy, Mail,
  Trash2, Circle, CircleDot, ClipboardList,
} from "lucide-react";
import {
  WORKFLOW_TRACKS, trackById, trackForRole, renderWorkflowTemplate,
  type WorkflowContext,
} from "@/lib/production-workflows";

// ─────────────────────────────────────────────────────────────────────────────
// Workflows — the step-by-step for every person on the shoot.
//
// Designed so someone who has never produced can run the conversations: each
// person shows where their thread is up to, the current step explains itself,
// lists what to collect, and hands over a ready-to-send email with the
// production's real details already filled in. Copy it, adjust a line, send it
// from your own address. The system's job is that nobody stares at a blank
// compose window wondering what this stage is supposed to say.
// ─────────────────────────────────────────────────────────────────────────────

interface StepDone {
  id: string;
  doneAt: string;
  by: string;
}

interface Person {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  track: string;
  notes: string | null;
  steps: StepDone[];
}

interface Payload {
  context: WorkflowContext;
  people: Person[];
}

const TRACK_CHIP: Record<string, string> = {
  TALENT: "bg-pink-50 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300",
  CREATIVE: "bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  CREW: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

export default function WorkflowsTab({ productionId }: { productionId: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", role: "", email: "" });
  const [copied, setCopied] = useState<string | null>(null);
  const [me, setMe] = useState<string>("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/productions/${productionId}/workflows`, { cache: "no-store" });
      const d = await res.json();
      if (d.error) setError(d.error);
      else { setData(d); setError(null); }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [productionId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    void fetch("/api/me")
      .then((r) => r.json())
      .then((d) => setMe(d.user?.name ?? ""))
      .catch(() => undefined);
  }, []);

  async function act(key: string, body: Record<string, unknown>) {
    setBusy(key);
    setError(null);
    try {
      const res = await fetch(`/api/productions/${productionId}/workflows`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) { setError(String(d.error ?? "That didn’t work.")); return; }
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(null);
    }
  }

  function copy(key: string, text: string) {
    void navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 1600);
  }

  const people = data?.people ?? [];
  const suggestion = useMemo(() => trackById(trackForRole(addForm.role)), [addForm.role]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={22} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Actions ── */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setAdding((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-foreground px-3.5 py-2 text-sm font-medium text-background hover:opacity-90"
        >
          <UserPlus size={14} /> Add person
        </button>
        <button
          onClick={() => act("import", { action: "import" })}
          disabled={busy !== null}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3.5 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
          title="Pull everyone from the production team and the latest call sheet"
        >
          {busy === "import" ? <Loader2 size={14} className="animate-spin" /> : <Users size={14} />}
          Import from production
        </button>
      </div>

      {adding && (
        <form
          className="grid gap-2 rounded-2xl border border-border bg-card p-4 sm:grid-cols-[1.2fr_1fr_1.2fr_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            void act("add", { action: "add", ...addForm }).then(() => {
              setAdding(false);
              setAddForm({ name: "", role: "", email: "" });
            });
          }}
        >
          <input required autoFocus placeholder="Name" value={addForm.name}
            onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <input placeholder="Role (picks the workflow)" value={addForm.role}
            onChange={(e) => setAddForm({ ...addForm, role: e.target.value })}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <input type="email" placeholder="Email" value={addForm.email}
            onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <button type="submit" disabled={busy !== null}
            className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50">
            {busy === "add" ? <Loader2 size={13} className="animate-spin" /> : `Add to ${suggestion.label}`}
          </button>
        </form>
      )}

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/25 dark:text-red-300">
          {error}
        </p>
      )}

      {/* ── Empty state doubles as the explainer ── */}
      {people.length === 0 && (
        <div className="rounded-2xl border border-border bg-card px-6 py-12 text-center">
          <ClipboardList size={22} className="mx-auto text-muted-foreground" />
          <h3 className="mt-3 text-base font-semibold text-foreground">Walk every conversation, step by step</h3>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
            Add the people on this shoot and each gets a track for their role: talent go
            reach-out → budget → contract → sizes → dietary → schedule → unit base; creative leads go
            reach-out → rate → contract → brief → deliverables → schedule → kit. Every step explains
            itself and comes with a ready-to-send email, filled in from this production.
          </p>
        </div>
      )}

      {/* ── People ── */}
      {people.map((p) => {
        const track = trackById(p.track);
        const doneIds = new Set(p.steps.map((s) => s.id));
        const doneCount = track.steps.filter((st) => doneIds.has(st.id)).length;
        const current = track.steps.find((st) => !doneIds.has(st.id));
        const expanded = open === p.id;
        const ctx: WorkflowContext = {
          ...data!.context,
          name: p.name,
          firstName: p.name.trim().split(/\s+/)[0],
          role: p.role,
          senderName: me || null,
        };

        return (
          <div key={p.id} className="overflow-hidden rounded-2xl border border-border bg-card">
            {/* Row header */}
            <button
              onClick={() => setOpen(expanded ? null : p.id)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50"
            >
              <span className="min-w-0 flex-1">
                <span className="font-medium text-foreground">{p.name}</span>
                {p.role && <span className="ml-2 text-xs text-muted-foreground">{p.role}</span>}
              </span>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${TRACK_CHIP[track.id] ?? TRACK_CHIP.CREW}`}>
                {track.label}
              </span>
              <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">
                {current ? `Next: ${current.title}` : "Complete"}
              </span>
              {/* Progress dots — the whole track at a glance */}
              <span className="flex shrink-0 items-center gap-1">
                {track.steps.map((st) => (
                  <span
                    key={st.id}
                    className={`h-1.5 w-1.5 rounded-full ${
                      doneIds.has(st.id)
                        ? "bg-emerald-500"
                        : st.id === current?.id
                          ? "bg-foreground"
                          : "bg-border"
                    }`}
                  />
                ))}
              </span>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {doneCount}/{track.steps.length}
              </span>
              {expanded ? <ChevronUp size={14} className="shrink-0 text-muted-foreground" /> : <ChevronDown size={14} className="shrink-0 text-muted-foreground" />}
            </button>

            {/* The walk-through */}
            {expanded && (
              <div className="border-t border-border">
                {track.steps.map((st) => {
                  const done = p.steps.find((d) => d.id === st.id);
                  const isCurrent = st.id === current?.id;
                  const subject = st.email ? renderWorkflowTemplate(st.email.subject, ctx) : null;
                  const bodyText = st.email ? renderWorkflowTemplate(st.email.body, ctx) : null;
                  return (
                    <div
                      key={st.id}
                      className={`border-b border-border px-4 py-3 last:border-0 ${
                        isCurrent ? "" : done ? "opacity-75" : "opacity-50"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => act(`t-${p.id}-${st.id}`, { action: "toggle", id: p.id, stepId: st.id })}
                          disabled={busy !== null}
                          title={done ? "Mark not done" : "Mark done"}
                          className="mt-0.5 shrink-0"
                        >
                          {done ? (
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white"><Check size={12} /></span>
                          ) : isCurrent ? (
                            <CircleDot size={20} className="text-foreground" />
                          ) : (
                            <Circle size={20} className="text-border" />
                          )}
                        </button>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline gap-x-2">
                            <span className={`text-sm font-semibold ${done ? "text-muted-foreground line-through" : "text-foreground"}`}>
                              {st.title}
                            </span>
                            {done && (
                              <span className="text-[11px] text-muted-foreground">
                                {done.by} · {new Date(done.doneAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                              </span>
                            )}
                          </div>

                          {(isCurrent || !done) && (
                            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{st.guide}</p>
                          )}

                          {isCurrent && st.collect && (
                            <ul className="mt-2 space-y-0.5">
                              {st.collect.map((c) => (
                                <li key={c} className="flex items-start gap-1.5 text-xs text-foreground">
                                  <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-[#9C7C2E]" />
                                  {c}
                                </li>
                              ))}
                            </ul>
                          )}

                          {isCurrent && st.email && subject && bodyText && (
                            <div className="mt-3 rounded-xl border border-border bg-muted/40 p-3">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                The email for this step
                              </p>
                              <p className="mt-1.5 text-xs font-semibold text-foreground">{subject}</p>
                              <pre className="mt-2 whitespace-pre-wrap font-sans text-xs leading-relaxed text-foreground">
                                {bodyText}
                              </pre>
                              <div className="mt-2.5 flex flex-wrap gap-2">
                                <a
                                  href={`mailto:${encodeURIComponent(p.email ?? "")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`}
                                  className="inline-flex items-center gap-1 rounded-lg bg-foreground px-2.5 py-1.5 text-xs font-medium text-background hover:opacity-90"
                                >
                                  <Mail size={11} /> Open in mail
                                </a>
                                <button
                                  onClick={() => copy(`${p.id}-${st.id}`, `Subject: ${subject}\n\n${bodyText}`)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                                >
                                  <Copy size={11} /> {copied === `${p.id}-${st.id}` ? "Copied" : "Copy email"}
                                </button>
                              </div>
                              {/\[\w+ needed\]/.test(subject + bodyText) && (
                                <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-400">
                                  Bracketed gaps are details the system doesn&rsquo;t have yet. Fill them
                                  before sending.
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div className="flex items-center justify-between px-4 py-2">
                  <select
                    value={p.track}
                    onChange={(e) => act(`track-${p.id}`, { action: "update", id: p.id, track: e.target.value })}
                    className="rounded-lg border border-border bg-background px-2 py-1 text-xs"
                    title="Switch this person to a different conversation"
                  >
                    {WORKFLOW_TRACKS.map((t) => (
                      <option key={t.id} value={t.id}>{t.label} track</option>
                    ))}
                  </select>
                  <button
                    onClick={() => act(`del-${p.id}`, { action: "delete", id: p.id })}
                    className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline dark:text-red-400"
                  >
                    <Trash2 size={11} /> Remove
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
