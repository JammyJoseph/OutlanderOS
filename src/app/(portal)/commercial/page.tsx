"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Calendar,
  Check,
  ExternalLink,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";

interface TrelloLabel {
  id: string;
  name: string;
  color: string | null;
}

interface TrelloMember {
  id: string;
  fullName: string;
  username: string;
  initials?: string;
  avatarUrl?: string | null;
}

interface PipelineCard {
  id: string;
  name: string;
  client: string;
  description: string;
  budget: number | null;
  budgetLabel: string;
  dueDate: string | null;
  lastActivity: string;
  labels: TrelloLabel[];
  members: TrelloMember[];
  url: string;
  listId: string;
}

interface PipelineStage {
  id: string;
  name: string;
  position: number;
  cards: PipelineCard[];
}

interface PipelineSnapshot {
  boardId: string;
  boardUrl: string;
  fetchedAt: string | null;
  stages: PipelineStage[];
  members: TrelloMember[];
  labels: TrelloLabel[];
  cached?: boolean;
  synced?: boolean;
  error?: string;
}

interface TrelloComment {
  id: string;
  text: string;
  date: string;
  memberCreator: { id: string; fullName: string; initials?: string; avatarUrl?: string | null };
}

interface TrelloCheckItem {
  id: string;
  name: string;
  state: "complete" | "incomplete";
  pos: number;
  idChecklist: string;
}

interface TrelloChecklist {
  id: string;
  name: string;
  pos: number;
  checkItems: TrelloCheckItem[];
}

const STAGE_TONE: Record<string, string> = {
  "CARD TEMPLATES": "bg-gray-100 text-gray-600",
  "2025 SPILL": "bg-rose-50 text-rose-700",
  "NEW CLIENT BRIEF": "bg-sky-50 text-sky-700",
  "BRIEF IN PROGRESS": "bg-blue-50 text-blue-700",
  "WORK IN PROGRESS": "bg-amber-50 text-amber-700",
  "WORK LIVE": "bg-emerald-50 text-emerald-700",
  "WORK PAID": "bg-green-50 text-green-700",
  "BRIEF LOST": "bg-stone-100 text-stone-600",
};

const STAGE_BG: Record<string, string> = {
  "CARD TEMPLATES": "bg-gray-50/60",
  "2025 SPILL": "bg-rose-50/40",
  "NEW CLIENT BRIEF": "bg-sky-50/40",
  "BRIEF IN PROGRESS": "bg-blue-50/40",
  "WORK IN PROGRESS": "bg-amber-50/40",
  "WORK LIVE": "bg-emerald-50/40",
  "WORK PAID": "bg-green-50/40",
  "BRIEF LOST": "bg-stone-50/60",
};

const LABEL_TONE: Record<string, string> = {
  green: "bg-emerald-100 text-emerald-700",
  yellow: "bg-amber-100 text-amber-700",
  yellow_light: "bg-amber-50 text-amber-700",
  orange: "bg-orange-100 text-orange-700",
  red: "bg-rose-100 text-rose-700",
  purple: "bg-purple-100 text-purple-700",
  blue: "bg-blue-100 text-blue-700",
  sky: "bg-sky-100 text-sky-700",
  lime: "bg-lime-100 text-lime-700",
  pink: "bg-pink-100 text-pink-700",
  black: "bg-gray-900 text-white",
  gray: "bg-gray-100 text-gray-700",
};

function stageTone(name: string): string {
  return STAGE_TONE[name.toUpperCase()] ?? "bg-gray-50 text-gray-700";
}

function stageBg(name: string): string {
  return STAGE_BG[name.toUpperCase()] ?? "bg-gray-50/40";
}

function labelTone(color: string | null): string {
  if (!color) return "bg-gray-100 text-gray-600";
  return LABEL_TONE[color] ?? "bg-gray-100 text-gray-600";
}

function formatDue(due: string | null): string | null {
  if (!due) return null;
  const d = new Date(due);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });
}

function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const now = Date.now();
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diff = Math.max(0, now - then);
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

function formatGBP(value: number): string {
  return `£${value.toLocaleString("en-GB")}`;
}

function MemberDot({ member, size = "sm" }: { member: TrelloMember; size?: "sm" | "md" }) {
  const label = member.initials || member.fullName.slice(0, 2).toUpperCase();
  const cls = size === "md" ? "h-7 w-7 text-[11px]" : "h-6 w-6 text-[10px]";
  return (
    <span
      title={member.fullName}
      className={`inline-flex items-center justify-center rounded-full bg-[#D4A853]/15 font-semibold text-[#8C6A24] ring-1 ring-white ${cls}`}
    >
      {label}
    </span>
  );
}

function CardTile({
  card,
  onSelect,
  onDragStart,
  isDragging,
}: {
  card: PipelineCard;
  onSelect: (c: PipelineCard) => void;
  onDragStart: (cardId: string, fromListId: string) => void;
  isDragging: boolean;
}) {
  const due = formatDue(card.dueDate);
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", card.id);
        onDragStart(card.id, card.listId);
      }}
      onClick={() => onSelect(card)}
      className={`group cursor-pointer rounded-xl border border-gray-200 bg-white p-3 text-left shadow-sm transition-all hover:border-[#D4A853]/60 hover:shadow ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2">
        {card.name}
      </p>
      {card.client && card.client !== card.name && (
        <p className="mt-0.5 text-[11px] text-gray-500 truncate">{card.client}</p>
      )}
      {card.budget !== null && (
        <p className="mt-1.5 text-[11px] font-semibold text-emerald-700">{card.budgetLabel}</p>
      )}
      {card.labels.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {card.labels.slice(0, 3).map((l) => (
            <span
              key={l.id}
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${labelTone(l.color)}`}
            >
              {l.name || "•"}
            </span>
          ))}
          {card.labels.length > 3 && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
              +{card.labels.length - 3}
            </span>
          )}
        </div>
      )}
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {due && (
            <span className="flex items-center gap-1 text-[10px] text-gray-500">
              <Calendar className="h-3 w-3" />
              {due}
            </span>
          )}
        </div>
        {card.members.length > 0 && (
          <div className="flex -space-x-1.5">
            {card.members.slice(0, 3).map((m) => (
              <MemberDot key={m.id} member={m} />
            ))}
            {card.members.length > 3 && (
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-[10px] font-semibold text-gray-500 ring-1 ring-white">
                +{card.members.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function dueDateInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function CardPanel({
  card,
  allLabels,
  stages,
  onClose,
  onUpdated,
  onArchived,
}: {
  card: PipelineCard;
  allLabels: TrelloLabel[];
  stages: PipelineStage[];
  onClose: () => void;
  onUpdated: (card: PipelineCard) => void;
  onArchived: (cardId: string) => void;
}) {
  const [name, setName] = useState(card.name);
  const [desc, setDesc] = useState(card.description);
  const [due, setDue] = useState(dueDateInputValue(card.dueDate));
  const [listId, setListId] = useState(card.listId);
  const [labelIds, setLabelIds] = useState<string[]>(card.labels.map((l) => l.id));
  const [savingField, setSavingField] = useState<string | null>(null);
  const [comments, setComments] = useState<TrelloComment[]>([]);
  const [checklists, setChecklists] = useState<TrelloChecklist[]>([]);
  const [newComment, setNewComment] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const [loadingExtras, setLoadingExtras] = useState(true);
  const [labelMenuOpen, setLabelMenuOpen] = useState(false);

  useEffect(() => {
    setName(card.name);
    setDesc(card.description);
    setDue(dueDateInputValue(card.dueDate));
    setListId(card.listId);
    setLabelIds(card.labels.map((l) => l.id));
  }, [card.id, card.name, card.description, card.dueDate, card.listId, card.labels]);

  useEffect(() => {
    let cancelled = false;
    setLoadingExtras(true);
    Promise.all([
      fetch(`/api/trello/cards/${card.id}/comments`).then((r) => r.json()).catch(() => ({ comments: [] })),
      fetch(`/api/trello/cards/${card.id}/checklist`).then((r) => r.json()).catch(() => ({ checklists: [] })),
    ])
      .then(([c, ck]) => {
        if (cancelled) return;
        setComments(Array.isArray(c?.comments) ? c.comments : []);
        setChecklists(Array.isArray(ck?.checklists) ? ck.checklists : []);
      })
      .finally(() => {
        if (!cancelled) setLoadingExtras(false);
      });
    return () => {
      cancelled = true;
    };
  }, [card.id]);

  const persist = useCallback(
    async (field: string, body: Record<string, unknown>) => {
      setSavingField(field);
      try {
        const res = await fetch(`/api/trello/cards/${card.id}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error ?? "Update failed");
        }
        onUpdated({
          ...card,
          ...(typeof body.name === "string" ? { name: body.name } : {}),
          ...(typeof body.desc === "string" ? { description: body.desc } : {}),
          ...("due" in body ? { dueDate: (body.due as string | null) ?? null } : {}),
          ...(typeof body.idList === "string" ? { listId: body.idList } : {}),
          ...(Array.isArray(body.idLabels)
            ? {
                labels: allLabels.filter((l) => (body.idLabels as string[]).includes(l.id)),
              }
            : {}),
        });
      } catch (err) {
        console.error(err);
      } finally {
        setSavingField(null);
      }
    },
    [card, onUpdated, allLabels]
  );

  async function handleNameBlur() {
    if (name.trim() && name !== card.name) await persist("name", { name: name.trim() });
  }
  async function handleDescBlur() {
    if (desc !== card.description) await persist("desc", { desc });
  }
  async function handleDueChange(v: string) {
    setDue(v);
    const iso = v ? new Date(`${v}T12:00:00`).toISOString() : null;
    await persist("due", { due: iso });
  }
  async function handleListChange(v: string) {
    setListId(v);
    await persist("idList", { idList: v });
  }
  async function toggleLabel(labelId: string) {
    const next = labelIds.includes(labelId)
      ? labelIds.filter((id) => id !== labelId)
      : [...labelIds, labelId];
    setLabelIds(next);
    await persist("labels", { idLabels: next });
  }

  async function postComment() {
    const text = newComment.trim();
    if (!text) return;
    setPostingComment(true);
    try {
      const res = await fetch(`/api/trello/cards/${card.id}/comments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (res.ok && data.comment) {
        setComments((prev) => [data.comment, ...prev]);
        setNewComment("");
      }
    } finally {
      setPostingComment(false);
    }
  }

  async function toggleCheckItem(item: TrelloCheckItem) {
    const next: "complete" | "incomplete" = item.state === "complete" ? "incomplete" : "complete";
    setChecklists((prev) =>
      prev.map((cl) => ({
        ...cl,
        checkItems: cl.checkItems.map((it) => (it.id === item.id ? { ...it, state: next } : it)),
      }))
    );
    try {
      await fetch(`/api/trello/cards/${card.id}/checkitem/${item.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ state: next }),
      });
    } catch {
      setChecklists((prev) =>
        prev.map((cl) => ({
          ...cl,
          checkItems: cl.checkItems.map((it) => (it.id === item.id ? { ...it, state: item.state } : it)),
        }))
      );
    }
  }

  async function archive() {
    if (!confirm("Archive this card?")) return;
    setSavingField("archive");
    try {
      const res = await fetch(`/api/trello/cards/${card.id}`, { method: "DELETE" });
      if (res.ok) onArchived(card.id);
    } finally {
      setSavingField(null);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative z-10 flex w-[440px] flex-col bg-white shadow-2xl border-l border-gray-200">
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div className="min-w-0 flex-1">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={handleNameBlur}
              className="w-full bg-transparent text-sm font-semibold text-gray-900 leading-snug focus:outline-none focus:ring-2 focus:ring-[#D4A853]/30 rounded px-1 -mx-1"
            />
            {card.client && card.client !== card.name && (
              <p className="mt-0.5 text-xs text-gray-500 px-1">{card.client}</p>
            )}
          </div>
          <button onClick={onClose} className="shrink-0 text-gray-400 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-auto px-5 py-4 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-1">Stage</p>
              <select
                value={listId}
                onChange={(e) => handleListChange(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#D4A853]/30"
              >
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-1">Due</p>
              <input
                type="date"
                value={due}
                onChange={(e) => handleDueChange(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#D4A853]/30"
              />
            </div>
          </div>

          {card.budget !== null && (
            <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-emerald-600">Budget</p>
              <p className="text-sm font-semibold text-emerald-800">{card.budgetLabel}</p>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] uppercase tracking-wide text-gray-400">Labels</p>
              <button
                onClick={() => setLabelMenuOpen((v) => !v)}
                className="text-[10px] text-[#8C6A24] hover:underline"
              >
                {labelMenuOpen ? "Done" : "Edit"}
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {card.labels.map((l) => (
                <span
                  key={l.id}
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${labelTone(l.color)}`}
                >
                  {l.name || "•"}
                </span>
              ))}
              {card.labels.length === 0 && !labelMenuOpen && (
                <span className="text-[11px] text-gray-400">No labels</span>
              )}
            </div>
            {labelMenuOpen && (
              <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-2 max-h-48 overflow-auto">
                <div className="flex flex-col gap-1">
                  {allLabels.map((l) => {
                    const checked = labelIds.includes(l.id);
                    return (
                      <button
                        key={l.id}
                        onClick={() => toggleLabel(l.id)}
                        className="flex items-center justify-between gap-2 rounded px-2 py-1 hover:bg-white"
                      >
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${labelTone(l.color)}`}
                        >
                          {l.name || `(${l.color ?? "blank"})`}
                        </span>
                        {checked && <Check className="h-3.5 w-3.5 text-emerald-600" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {card.members.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-1.5">Members</p>
              <div className="flex flex-col gap-1.5">
                {card.members.map((m) => (
                  <div key={m.id} className="flex items-center gap-2">
                    <MemberDot member={m} />
                    <span className="text-xs text-gray-700">{m.fullName}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-1.5">Description</p>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              onBlur={handleDescBlur}
              rows={6}
              placeholder="Add a description… include 'Budget: £X,XXX' to track value"
              className="w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs leading-relaxed text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#D4A853]/30"
            />
          </div>

          {checklists.length > 0 && (
            <div className="space-y-3">
              {checklists.map((cl) => {
                const total = cl.checkItems.length;
                const done = cl.checkItems.filter((it) => it.state === "complete").length;
                const pct = total ? Math.round((done / total) * 100) : 0;
                return (
                  <div key={cl.id}>
                    <div className="mb-1.5 flex items-center justify-between">
                      <p className="text-[11px] font-semibold text-gray-700">{cl.name}</p>
                      <span className="text-[10px] text-gray-400">
                        {done}/{total} · {pct}%
                      </span>
                    </div>
                    <div className="h-1 w-full overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full bg-emerald-500 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <ul className="mt-2 space-y-1">
                      {cl.checkItems.map((it) => (
                        <li key={it.id} className="flex items-start gap-2">
                          <button
                            onClick={() => toggleCheckItem(it)}
                            className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                              it.state === "complete"
                                ? "border-emerald-500 bg-emerald-500 text-white"
                                : "border-gray-300 bg-white"
                            }`}
                          >
                            {it.state === "complete" && <Check className="h-3 w-3" />}
                          </button>
                          <span
                            className={`text-xs ${
                              it.state === "complete" ? "text-gray-400 line-through" : "text-gray-700"
                            }`}
                          >
                            {it.name}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}

          <div>
            <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-1.5">Comments</p>
            <div className="flex gap-2">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Write a comment…"
                rows={2}
                className="flex-1 resize-y rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#D4A853]/30"
              />
              <button
                onClick={postComment}
                disabled={postingComment || !newComment.trim()}
                className="self-end rounded-lg bg-[#D4A853] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#C49843] disabled:opacity-50"
              >
                {postingComment ? "…" : "Post"}
              </button>
            </div>
            <div className="mt-3 space-y-3">
              {loadingExtras && comments.length === 0 ? (
                <p className="text-[11px] text-gray-400">Loading…</p>
              ) : comments.length === 0 ? (
                <p className="text-[11px] text-gray-400">No comments yet.</p>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="flex gap-2">
                    <MemberDot member={{ ...c.memberCreator, username: "" }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <p className="text-[11px] font-semibold text-gray-800">
                          {c.memberCreator.fullName}
                        </p>
                        <p className="text-[10px] text-gray-400">{relativeTime(c.date)}</p>
                      </div>
                      <p className="whitespace-pre-wrap text-xs text-gray-700">{c.text}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-1">Last activity</p>
            <p className="text-xs text-gray-600">{relativeTime(card.lastActivity)}</p>
          </div>
        </div>

        <div className="border-t border-gray-100 px-5 py-3 flex items-center justify-between gap-2">
          <button
            onClick={archive}
            disabled={savingField === "archive"}
            className="flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Archive
          </button>
          <div className="flex items-center gap-2">
            {savingField && savingField !== "archive" && (
              <span className="text-[10px] text-gray-400">Saving…</span>
            )}
            <a
              href={card.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded-lg bg-[#D4A853] px-3 py-2 text-xs font-semibold text-white hover:bg-[#C49843]"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open in Trello
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function NewDealModal({
  stages,
  onClose,
  onCreated,
}: {
  stages: PipelineStage[];
  onClose: () => void;
  onCreated: (card: PipelineCard) => void;
}) {
  const [name, setName] = useState("");
  const [budget, setBudget] = useState("");
  const [listId, setListId] = useState(stages[0]?.id ?? "");
  const [desc, setDesc] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!name.trim() || !listId) return;
    setSubmitting(true);
    setError(null);
    try {
      const budgetLine = budget.trim() ? `Budget: £${budget.replace(/[^\d.,]/g, "")}\n\n` : "";
      const fullDesc = `${budgetLine}${desc}`.trim();
      const res = await fetch("/api/trello/cards", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), idList: listId, desc: fullDesc, pos: "top" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create card");
      const created: PipelineCard = {
        id: data.id,
        name: data.name,
        client: name.trim(),
        description: fullDesc,
        budget: budget.trim() ? Number(budget.replace(/[^\d.]/g, "")) : null,
        budgetLabel: budget.trim() ? `£${Number(budget.replace(/[^\d.]/g, "")).toLocaleString("en-GB")}` : "N/A",
        dueDate: null,
        lastActivity: new Date().toISOString(),
        labels: [],
        members: [],
        url: data.shortUrl ?? data.url ?? "",
        listId,
      };
      onCreated(created);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create card");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900">New Deal</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] uppercase tracking-wide text-gray-400">Name</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Client / project name"
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#D4A853]/30"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-wide text-gray-400">Stage</label>
              <select
                value={listId}
                onChange={(e) => setListId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#D4A853]/30"
              >
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wide text-gray-400">Budget (£)</label>
              <input
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="e.g. 20000"
                inputMode="numeric"
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#D4A853]/30"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wide text-gray-400">Notes</label>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={4}
              placeholder="Brief details, scope, links…"
              className="mt-1 w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#D4A853]/30"
            />
          </div>
          {error && <p className="text-xs text-rose-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={submitting || !name.trim() || !listId}
              className="flex items-center gap-1.5 rounded-lg bg-[#D4A853] px-3 py-2 text-xs font-semibold text-white hover:bg-[#C49843] disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Create
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CommercialPipelinePage() {
  const [snapshot, setSnapshot] = useState<PipelineSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<PipelineCard | null>(null);
  const [creating, setCreating] = useState(false);
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [dragOverListId, setDragOverListId] = useState<string | null>(null);

  const applyData = useCallback((data: PipelineSnapshot) => {
    setSnapshot({
      boardId: data.boardId ?? "",
      boardUrl: data.boardUrl ?? "",
      fetchedAt: data.fetchedAt ?? null,
      stages: Array.isArray(data.stages) ? data.stages : [],
      members: Array.isArray(data.members) ? data.members : [],
      labels: Array.isArray(data.labels) ? data.labels : [],
      cached: data.cached,
      synced: data.synced,
    });
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/trello", { cache: "no-store" });
      const data: PipelineSnapshot = await res.json();
      if (!res.ok) setError(data.error ?? "Failed to load Trello board");
      else setError(data.error ?? null);
      applyData(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load Trello board");
    } finally {
      setLoading(false);
    }
  }, [applyData]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSync() {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/trello/sync", { method: "POST" });
      const data: PipelineSnapshot = await res.json();
      if (!res.ok) setError(data.error ?? "Sync failed");
      else setError(data.error ?? null);
      applyData({ ...data, cached: false, synced: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  const stages = snapshot?.stages ?? [];
  const labels = snapshot?.labels ?? [];

  const totals = useMemo(() => {
    let totalCards = 0;
    let totalBudget = 0;
    const perStage: Record<string, { cards: number; budget: number }> = {};
    for (const s of stages) {
      const cards = s.cards ?? [];
      let stageBudget = 0;
      for (const c of cards) if (c.budget) stageBudget += c.budget;
      perStage[s.id] = { cards: cards.length, budget: stageBudget };
      totalCards += cards.length;
      totalBudget += stageBudget;
    }
    return { totalCards, totalBudget, perStage };
  }, [stages]);

  function updateCardLocal(updated: PipelineCard) {
    setSnapshot((prev) => {
      if (!prev) return prev;
      const fromStageIdx = prev.stages.findIndex((s) =>
        (s.cards ?? []).some((c) => c.id === updated.id)
      );
      if (fromStageIdx === -1) return prev;
      const fromStage = prev.stages[fromStageIdx];
      const stagesNext = prev.stages.map((s) => ({ ...s, cards: [...(s.cards ?? [])] }));
      stagesNext[fromStageIdx].cards = stagesNext[fromStageIdx].cards.filter(
        (c) => c.id !== updated.id
      );
      const toStageIdx = stagesNext.findIndex((s) => s.id === updated.listId);
      const targetIdx = toStageIdx === -1 ? fromStageIdx : toStageIdx;
      stagesNext[targetIdx].cards = [updated, ...stagesNext[targetIdx].cards];
      void fromStage;
      return { ...prev, stages: stagesNext };
    });
    setSelected(updated);
  }

  function archiveCardLocal(cardId: string) {
    setSnapshot((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        stages: prev.stages.map((s) => ({
          ...s,
          cards: (s.cards ?? []).filter((c) => c.id !== cardId),
        })),
      };
    });
    setSelected(null);
  }

  function addCardLocal(card: PipelineCard) {
    setSnapshot((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        stages: prev.stages.map((s) =>
          s.id === card.listId ? { ...s, cards: [card, ...(s.cards ?? [])] } : s
        ),
      };
    });
  }

  async function handleDropOnStage(targetListId: string) {
    if (!draggingCardId) return;
    const cardId = draggingCardId;
    setDraggingCardId(null);
    setDragOverListId(null);

    const sourceStage = stages.find((s) => (s.cards ?? []).some((c) => c.id === cardId));
    if (!sourceStage || sourceStage.id === targetListId) return;

    setSnapshot((prev) => {
      if (!prev) return prev;
      const stagesNext = prev.stages.map((s) => ({ ...s, cards: [...(s.cards ?? [])] }));
      const fromIdx = stagesNext.findIndex((s) => s.id === sourceStage.id);
      const toIdx = stagesNext.findIndex((s) => s.id === targetListId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const cardIdx = stagesNext[fromIdx].cards.findIndex((c) => c.id === cardId);
      if (cardIdx === -1) return prev;
      const [moved] = stagesNext[fromIdx].cards.splice(cardIdx, 1);
      moved.listId = targetListId;
      stagesNext[toIdx].cards = [moved, ...stagesNext[toIdx].cards];
      return { ...prev, stages: stagesNext };
    });

    try {
      await fetch(`/api/trello/cards/${cardId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idList: targetListId, pos: "top" }),
      });
    } catch (e) {
      console.error(e);
      load();
    }
  }

  return (
    <div className="flex h-full flex-col font-[family-name:var(--font-manrope)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white px-6 py-3">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Commercial Pipeline</h1>
          <p className="text-xs text-gray-500">
            {loading
              ? "Loading from Trello…"
              : `${totals.totalCards} deals · ${stages.length} stages · ${formatGBP(totals.totalBudget)} total`}
            {snapshot?.fetchedAt && (
              <>
                {" · "}
                <span className="text-gray-400">synced {relativeTime(snapshot.fetchedAt)}</span>
              </>
            )}
            {snapshot?.cached && !syncing && (
              <span className="ml-1 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
                cached
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCreating(true)}
            disabled={stages.length === 0}
            className="flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            New Deal
          </button>
          {snapshot?.boardUrl && (
            <a
              href={snapshot.boardUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open Board
            </a>
          )}
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 rounded-lg bg-[#D4A853] px-3 py-2 text-xs font-semibold text-white hover:bg-[#C49843] disabled:opacity-50"
          >
            {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {syncing ? "Syncing…" : "Sync"}
          </button>
        </div>
      </div>

      {error && (
        <div className="border-b border-rose-200 bg-rose-50 px-6 py-2 text-xs text-rose-700">{error}</div>
      )}

      <div className="flex flex-1 gap-4 overflow-x-auto p-4">
        {loading && stages.length === 0 ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex w-[300px] shrink-0 flex-col gap-2">
              <div className="h-9 animate-pulse rounded-xl bg-gray-100" />
              <div className="h-20 animate-pulse rounded-xl bg-gray-100" />
              <div className="h-20 animate-pulse rounded-xl bg-gray-100" />
            </div>
          ))
        ) : stages.length === 0 ? (
          <div className="m-auto max-w-md text-center">
            <p className="text-sm text-gray-500">
              No Trello data yet. Click &ldquo;Sync&rdquo; to pull the latest board.
            </p>
          </div>
        ) : (
          stages.map((stage) => {
            const cards = stage.cards ?? [];
            const stat = totals.perStage[stage.id] ?? { cards: 0, budget: 0 };
            const isOver = dragOverListId === stage.id;
            return (
              <div
                key={stage.id}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (dragOverListId !== stage.id) setDragOverListId(stage.id);
                }}
                onDragLeave={(e) => {
                  if (e.currentTarget === e.target) setDragOverListId(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDropOnStage(stage.id);
                }}
                className={`flex w-[300px] shrink-0 flex-col rounded-2xl p-2 transition-colors ${stageBg(stage.name)} ${
                  isOver ? "ring-2 ring-[#D4A853]/60" : ""
                }`}
              >
                <div
                  className={`mb-2 flex items-center justify-between rounded-xl px-3 py-2 ${stageTone(stage.name)}`}
                >
                  <span className="text-[11px] font-semibold uppercase tracking-wide truncate">
                    {stage.name}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="rounded-full bg-white/70 px-1.5 py-0.5 text-[10px] font-bold">
                      {stat.cards}
                    </span>
                  </div>
                </div>
                {stat.budget > 0 && (
                  <div className="mb-2 flex items-center justify-between rounded-lg bg-white/60 px-3 py-1.5 text-[10px] font-medium text-emerald-700">
                    <span>Total budget</span>
                    <span className="font-semibold">{formatGBP(stat.budget)}</span>
                  </div>
                )}
                <div className="flex flex-1 flex-col gap-2 min-h-[60px]">
                  {cards.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-200 px-3 py-4 text-center text-[11px] text-gray-400">
                      Drop here
                    </div>
                  ) : (
                    cards.map((c) => (
                      <CardTile
                        key={c.id}
                        card={c}
                        onSelect={setSelected}
                        onDragStart={(id) => setDraggingCardId(id)}
                        isDragging={draggingCardId === c.id}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {selected && (
        <CardPanel
          card={selected}
          allLabels={labels}
          stages={stages}
          onClose={() => setSelected(null)}
          onUpdated={updateCardLocal}
          onArchived={archiveCardLocal}
        />
      )}

      {creating && (
        <NewDealModal
          stages={stages}
          onClose={() => setCreating(false)}
          onCreated={addCardLocal}
        />
      )}
    </div>
  );
}
