"use client";

// Creative Rounds — the iterative brief → submit → review → approve loop that
// replaces the old single brief/response section. Each round is INTERNAL (team
// ideation) or CLIENT (pitched to the client); a revision request auto-creates
// the next round on the server.

import { useState, useEffect, useCallback } from "react";
import {
  Loader2,
  Plus,
  Send,
  CheckCircle2,
  MessageSquare,
  Palette,
  Users,
  ChevronDown,
  ChevronRight,
  ArrowUpRight,
  LinkIcon,
  CalendarDays,
  RotateCcw,
  Circle,
} from "lucide-react";
import { format, parseISO } from "date-fns";

export interface CreativeRound {
  id: string;
  campaignId: string;
  roundNumber: number;
  type: "INTERNAL" | "CLIENT";
  status: "IN_PROGRESS" | "SUBMITTED" | "REVIEWED" | "APPROVED" | "REVISION_NEEDED";
  title: string | null;
  brief: string | null;
  feedback: string | null;
  deadline: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  deckUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_STYLES: Record<
  CreativeRound["status"],
  { label: string; bg: string; text: string; dot: string }
> = {
  IN_PROGRESS: { label: "In Progress", bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-300", dot: "bg-amber-400" },
  SUBMITTED: { label: "Submitted", bg: "bg-sky-100 dark:bg-sky-900/30", text: "text-sky-700 dark:text-sky-300", dot: "bg-sky-500" },
  REVIEWED: { label: "Reviewed", bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-300", dot: "bg-blue-500" },
  APPROVED: { label: "Approved", bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500" },
  REVISION_NEEDED: { label: "Revision Needed", bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-700 dark:text-orange-300", dot: "bg-orange-500" },
};

const TYPE_STYLES: Record<CreativeRound["type"], { label: string; bg: string; text: string; icon: typeof Palette }> = {
  INTERNAL: { label: "Internal", bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-600 dark:text-slate-300", icon: Palette },
  CLIENT: { label: "Client", bg: "bg-purple-100 dark:bg-purple-900/30", text: "text-purple-700 dark:text-purple-300", icon: Users },
};

const STATUS_STEPS: CreativeRound["status"][] = ["IN_PROGRESS", "SUBMITTED", "REVIEWED", "APPROVED"];

function normUrl(u: string) {
  return u.startsWith("http") ? u : `https://${u}`;
}

export default function CreativeRoundsTab({
  dealId,
  initial,
  onChanged,
}: {
  dealId: string;
  initial: CreativeRound[];
  onChanged?: () => void;
}) {
  const [rounds, setRounds] = useState<CreativeRound[]>(initial ?? []);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const reload = useCallback(async () => {
    const res = await fetch(`/api/campaigns/${dealId}/rounds`);
    if (res.ok) setRounds(await res.json());
    onChanged?.();
  }, [dealId, onChanged]);

  useEffect(() => {
    setRounds(initial ?? []);
  }, [initial]);

  const sorted = [...rounds].sort((a, b) => a.roundNumber - b.roundNumber);
  const latest = sorted[sorted.length - 1] ?? null;
  const canStartNext = latest != null && latest.status === "APPROVED";

  async function createRound(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(`/api/campaigns/${dealId}/rounds`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const created = (await res.json()) as CreativeRound;
        setExpanded((s) => new Set(s).add(created.id));
        await reload();
      }
    } finally {
      setBusy(false);
    }
  }

  async function updateRound(roundId: string, body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(`/api/campaigns/${dealId}/rounds/${roundId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) await reload();
    } finally {
      setBusy(false);
    }
  }

  function toggle(id: string) {
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Empty state — kick off the first internal round.
  if (sorted.length === 0) {
    return (
      <div className="max-w-3xl">
        <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm p-10 text-center">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center mb-4">
            <Palette size={24} className="text-purple-500" />
          </div>
          <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
            No creative rounds yet
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-md mx-auto">
            Send the brief to start Round 1 — an internal round where the team develops the first
            set of ideas before anything goes to the client.
          </p>
          <button
            onClick={() =>
              createRound({ type: "INTERNAL", title: "V1 Ideas", status: "IN_PROGRESS" })
            }
            disabled={busy}
            className="mt-5 inline-flex items-center gap-2 bg-purple-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-50"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            Send Brief — Start Round 1
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-5">
      {/* Progress rail — one node per round */}
      <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Creative progress</h3>
          <span className="text-xs text-gray-400">
            {sorted.length} round{sorted.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {sorted.map((r, i) => {
            const s = STATUS_STYLES[r.status];
            const t = TYPE_STYLES[r.type];
            return (
              <div key={r.id} className="flex items-center shrink-0">
                <button
                  onClick={() => toggle(r.id)}
                  className={`flex items-center gap-1.5 rounded-full pl-2 pr-3 py-1.5 border transition-colors ${
                    r.status === "APPROVED"
                      ? "border-emerald-200 dark:border-emerald-800"
                      : "border-gray-200 dark:border-gray-700"
                  } hover:bg-gray-50 dark:hover:bg-gray-800`}
                  title={`Round ${r.roundNumber} — ${t.label} · ${s.label}`}
                >
                  <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                  <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">
                    R{r.roundNumber}
                  </span>
                  <span className={`text-[10px] font-medium ${t.text}`}>{t.label}</span>
                </button>
                {i < sorted.length - 1 && <div className="w-4 h-px bg-gray-200 dark:bg-gray-700" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Round cards */}
      {sorted.map((round) => (
        <RoundCard
          key={round.id}
          round={round}
          open={expanded.has(round.id)}
          busy={busy}
          onToggle={() => toggle(round.id)}
          onUpdate={(body) => updateRound(round.id, body)}
        />
      ))}

      {/* Start next round */}
      {canStartNext && latest && (
        <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/40 p-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                Round {latest.roundNumber} approved
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {latest.type === "INTERNAL"
                  ? "Internal ideas signed off — pitch them to the client next."
                  : "Client sign-off logged — this deal is ready to clear for production."}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {latest.type === "INTERNAL" ? (
                <button
                  onClick={() =>
                    createRound({ type: "CLIENT", title: "Client Pitch 1", status: "IN_PROGRESS" })
                  }
                  disabled={busy}
                  className="inline-flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-50"
                >
                  {busy ? <Loader2 size={14} className="animate-spin" /> : <Users size={14} />}
                  Start Client Round
                </button>
              ) : (
                <button
                  onClick={() =>
                    createRound({
                      type: "CLIENT",
                      title: `Client Pitch ${sorted.filter((r) => r.type === "CLIENT").length + 1}`,
                      status: "IN_PROGRESS",
                    })
                  }
                  disabled={busy}
                  className="inline-flex items-center gap-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  <Plus size={14} /> Another Client Round
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RoundCard({
  round,
  open,
  busy,
  onToggle,
  onUpdate,
}: {
  round: CreativeRound;
  open: boolean;
  busy: boolean;
  onToggle: () => void;
  onUpdate: (body: Record<string, unknown>) => Promise<void>;
}) {
  const s = STATUS_STYLES[round.status];
  const t = TYPE_STYLES[round.type];
  const TypeIcon = t.icon;

  const [brief, setBrief] = useState(round.brief ?? "");
  const [deckUrl, setDeckUrl] = useState(round.deckUrl ?? "");
  const [feedback, setFeedback] = useState(round.feedback ?? "");

  useEffect(() => setBrief(round.brief ?? ""), [round.brief]);
  useEffect(() => setDeckUrl(round.deckUrl ?? ""), [round.deckUrl]);
  useEffect(() => setFeedback(round.feedback ?? ""), [round.feedback]);

  const stepIdx = STATUS_STEPS.indexOf(round.status);

  return (
    <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
      {/* Header row */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-gray-50/60 dark:hover:bg-gray-800/60 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-gray-400 shrink-0">
            {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </span>
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 shrink-0">
            Round {round.roundNumber}
          </span>
          {round.title && (
            <span className="text-sm text-gray-500 dark:text-gray-400 truncate">{round.title}</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {round.deadline && (
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-gray-400">
              <CalendarDays size={11} /> {format(parseISO(round.deadline), "d MMM")}
            </span>
          )}
          <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${t.bg} ${t.text}`}>
            <TypeIcon size={11} /> {t.label}
          </span>
          <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} /> {s.label}
          </span>
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5 pt-1 border-t border-gray-50 dark:border-gray-800 space-y-4">
          {/* Status stepper */}
          {round.status !== "REVISION_NEEDED" && (
            <div className="flex items-center gap-1 pt-3">
              {STATUS_STEPS.map((step, i) => (
                <div key={step} className="flex items-center flex-1 last:flex-none">
                  <div
                    className={`flex items-center gap-1.5 ${
                      i <= stepIdx ? "text-emerald-600 dark:text-emerald-400" : "text-gray-300 dark:text-gray-600"
                    }`}
                  >
                    {i <= stepIdx ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                    <span className="text-[10px] font-medium uppercase tracking-wide">
                      {STATUS_STYLES[step].label}
                    </span>
                  </div>
                  {i < STATUS_STEPS.length - 1 && (
                    <div
                      className={`flex-1 h-px mx-2 ${
                        i < stepIdx ? "bg-emerald-400" : "bg-gray-200 dark:bg-gray-700"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
          {round.status === "REVISION_NEEDED" && (
            <div className="flex items-center gap-2 pt-3 text-orange-600 dark:text-orange-400 text-xs font-medium">
              <RotateCcw size={14} /> Revision requested — a new round was opened to carry the changes.
            </div>
          )}

          {/* Brief */}
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
              Brief / notes
            </p>
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              onBlur={() => brief !== (round.brief ?? "") && onUpdate({ brief })}
              rows={3}
              placeholder="What this round is exploring — direction, mandatories, what changed since last time…"
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-purple-400/30 focus:border-purple-400"
            />
          </div>

          {/* Deck link + deadline */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                Deck / Figma link
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="url"
                  value={deckUrl}
                  onChange={(e) => setDeckUrl(e.target.value)}
                  onBlur={() =>
                    deckUrl.trim() !== (round.deckUrl ?? "") &&
                    onUpdate({ deckUrl: deckUrl.trim() || null })
                  }
                  placeholder="https://figma.com/…"
                  className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400/30 focus:border-purple-400"
                />
                {round.deckUrl && (
                  <a
                    href={normUrl(round.deckUrl)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-purple-600 dark:text-purple-400 px-2.5 py-2 rounded-lg border border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors shrink-0"
                  >
                    <LinkIcon size={12} /> Open <ArrowUpRight size={11} />
                  </a>
                )}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                Deadline
              </p>
              <input
                type="date"
                value={round.deadline ? round.deadline.slice(0, 10) : ""}
                onChange={(e) => onUpdate({ deadline: e.target.value || null })}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400/30 focus:border-purple-400"
              />
            </div>
          </div>

          {/* Review feedback — shown once submitted */}
          {(round.status === "SUBMITTED" ||
            round.status === "REVIEWED" ||
            round.status === "REVISION_NEEDED" ||
            round.feedback) && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                <MessageSquare size={11} /> Review feedback
              </p>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                onBlur={() => feedback !== (round.feedback ?? "") && onUpdate({ feedback })}
                rows={2}
                placeholder="What the reviewers said — notes, requested changes, or approval reasoning…"
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-purple-400/30 focus:border-purple-400"
              />
            </div>
          )}

          {/* Timestamps */}
          {(round.submittedAt || round.reviewedAt) && (
            <div className="flex items-center gap-4 text-[11px] text-gray-400">
              {round.submittedAt && <span>Submitted {format(parseISO(round.submittedAt), "d MMM HH:mm")}</span>}
              {round.reviewedAt && <span>Reviewed {format(parseISO(round.reviewedAt), "d MMM HH:mm")}</span>}
            </div>
          )}

          {/* Status actions */}
          <div className="flex items-center justify-end gap-2 pt-1 border-t border-gray-50 dark:border-gray-800">
            <div className="mt-3 flex items-center gap-2 flex-wrap justify-end">
              {round.status === "IN_PROGRESS" && (
                <ActionBtn busy={busy} onClick={() => onUpdate({ status: "SUBMITTED" })} tone="sky">
                  <Send size={13} /> Submit for review
                </ActionBtn>
              )}
              {round.status === "SUBMITTED" && (
                <ActionBtn busy={busy} onClick={() => onUpdate({ status: "REVIEWED", feedback })} tone="blue">
                  <MessageSquare size={13} /> Mark reviewed
                </ActionBtn>
              )}
              {round.status === "REVIEWED" && (
                <>
                  <ActionBtn
                    busy={busy}
                    onClick={() => onUpdate({ status: "REVISION_NEEDED", feedback })}
                    tone="orange"
                  >
                    <RotateCcw size={13} /> Request revision
                  </ActionBtn>
                  <ActionBtn busy={busy} onClick={() => onUpdate({ status: "APPROVED" })} tone="emerald">
                    <CheckCircle2 size={13} /> Approve
                  </ActionBtn>
                </>
              )}
              {round.status === "APPROVED" && (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 size={14} /> Approved
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ActionBtn({
  children,
  onClick,
  busy,
  tone,
}: {
  children: React.ReactNode;
  onClick: () => void;
  busy: boolean;
  tone: "sky" | "blue" | "orange" | "emerald";
}) {
  const tones: Record<string, string> = {
    sky: "bg-sky-600 hover:bg-sky-700 text-white",
    blue: "bg-blue-600 hover:bg-blue-700 text-white",
    orange: "border border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/30",
    emerald: "bg-emerald-600 hover:bg-emerald-700 text-white",
  };
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium transition-colors disabled:opacity-50 ${tones[tone]}`}
    >
      {children}
    </button>
  );
}
