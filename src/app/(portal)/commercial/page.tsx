"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Calendar,
  ExternalLink,
  Loader2,
  RefreshCw,
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
  dueDate: string | null;
  lastActivity: string;
  labels: TrelloLabel[];
  members: TrelloMember[];
  url: string;
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
  cached?: boolean;
  synced?: boolean;
  error?: string;
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

function MemberDot({ member }: { member: TrelloMember }) {
  const label = member.initials || member.fullName.slice(0, 2).toUpperCase();
  return (
    <span
      title={member.fullName}
      className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#D4A853]/15 text-[10px] font-semibold text-[#8C6A24] ring-1 ring-white"
    >
      {label}
    </span>
  );
}

function CardTile({
  card,
  onSelect,
}: {
  card: PipelineCard;
  onSelect: (c: PipelineCard) => void;
}) {
  const due = formatDue(card.dueDate);
  return (
    <button
      onClick={() => onSelect(card)}
      className="w-full rounded-xl border border-gray-200 bg-white p-3 text-left shadow-sm transition-colors hover:border-[#D4A853]/60 hover:shadow"
    >
      <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2">
        {card.name}
      </p>
      {card.client && card.client !== card.name && (
        <p className="mt-0.5 text-[11px] text-gray-500 truncate">
          {card.client}
        </p>
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
    </button>
  );
}

function CardPanel({
  card,
  onClose,
}: {
  card: PipelineCard;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative z-10 flex w-[380px] flex-col bg-white shadow-2xl border-l border-gray-200">
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-gray-900 leading-snug">
              {card.name}
            </h2>
            {card.client && card.client !== card.name && (
              <p className="mt-0.5 text-xs text-gray-500">{card.client}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-auto px-5 py-4 space-y-5">
          {card.labels.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-1.5">
                Labels
              </p>
              <div className="flex flex-wrap gap-1.5">
                {card.labels.map((l) => (
                  <span
                    key={l.id}
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${labelTone(l.color)}`}
                  >
                    {l.name || "•"}
                  </span>
                ))}
              </div>
            </div>
          )}
          {card.dueDate && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-1">
                Due
              </p>
              <p className="text-sm text-gray-800">{formatDue(card.dueDate)}</p>
            </div>
          )}
          {card.members.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-1.5">
                Members
              </p>
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
          {card.description && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-1.5">
                Description
              </p>
              <p className="whitespace-pre-wrap text-xs leading-relaxed text-gray-700">
                {card.description}
              </p>
            </div>
          )}
          <div>
            <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-1">
              Last activity
            </p>
            <p className="text-xs text-gray-600">{relativeTime(card.lastActivity)}</p>
          </div>
        </div>
        <div className="border-t border-gray-100 px-5 py-3">
          <a
            href={card.url}
            target="_blank"
            rel="noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#D4A853] px-3 py-2 text-xs font-semibold text-white hover:bg-[#C49843] transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open in Trello
          </a>
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

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/trello", { cache: "no-store" });
      const data: PipelineSnapshot = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to load Trello board");
      } else {
        setError(data.error ?? null);
      }
      setSnapshot({
        boardId: data.boardId ?? "",
        boardUrl: data.boardUrl ?? "",
        fetchedAt: data.fetchedAt ?? null,
        stages: Array.isArray(data.stages) ? data.stages : [],
        members: Array.isArray(data.members) ? data.members : [],
        cached: data.cached,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load Trello board");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSync() {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/trello/sync", { method: "POST" });
      const data: PipelineSnapshot = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Sync failed");
      } else {
        setError(data.error ?? null);
      }
      setSnapshot({
        boardId: data.boardId ?? "",
        boardUrl: data.boardUrl ?? "",
        fetchedAt: data.fetchedAt ?? null,
        stages: Array.isArray(data.stages) ? data.stages : [],
        members: Array.isArray(data.members) ? data.members : [],
        cached: false,
        synced: true,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  const stages = snapshot?.stages ?? [];
  const totalCards = useMemo(
    () => stages.reduce((acc, s) => acc + (s.cards?.length ?? 0), 0),
    [stages]
  );

  return (
    <div className="flex h-full flex-col font-[family-name:var(--font-manrope)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white px-6 py-3">
        <div>
          <h1 className="text-base font-semibold text-gray-900">
            Commercial Pipeline
          </h1>
          <p className="text-xs text-gray-500">
            {loading
              ? "Loading from Trello…"
              : `${totalCards} cards · ${stages.length} stages`}
            {snapshot?.fetchedAt && (
              <>
                {" · "}
                <span className="text-gray-400">
                  synced {relativeTime(snapshot.fetchedAt)}
                </span>
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
          {snapshot?.boardUrl && (
            <a
              href={snapshot.boardUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open Board
            </a>
          )}
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 rounded-lg bg-[#D4A853] px-3 py-2 text-xs font-semibold text-white hover:bg-[#C49843] disabled:opacity-50 transition-colors"
          >
            {syncing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            {syncing ? "Syncing…" : "Sync from Trello"}
          </button>
        </div>
      </div>

      {error && (
        <div className="border-b border-rose-200 bg-rose-50 px-6 py-2 text-xs text-rose-700">
          {error}
        </div>
      )}

      <div className="flex flex-1 gap-4 overflow-x-auto p-4">
        {loading && stages.length === 0 ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex w-[280px] shrink-0 flex-col gap-2"
            >
              <div className="h-9 animate-pulse rounded-xl bg-gray-100" />
              <div className="h-20 animate-pulse rounded-xl bg-gray-100" />
              <div className="h-20 animate-pulse rounded-xl bg-gray-100" />
            </div>
          ))
        ) : stages.length === 0 ? (
          <div className="m-auto max-w-md text-center">
            <p className="text-sm text-gray-500">
              No Trello data yet. Click “Sync from Trello” to pull the latest
              board.
            </p>
          </div>
        ) : (
          stages.map((stage) => {
            const cards = stage.cards ?? [];
            return (
              <div
                key={stage.id}
                className="flex w-[280px] shrink-0 flex-col"
              >
                <div
                  className={`mb-3 flex items-center justify-between rounded-xl px-3 py-2 ${stageTone(stage.name)}`}
                >
                  <span className="text-[11px] font-semibold uppercase tracking-wide">
                    {stage.name}
                  </span>
                  <span className="rounded-full bg-white/70 px-1.5 py-0.5 text-[10px] font-bold">
                    {cards.length}
                  </span>
                </div>
                <div className="flex flex-1 flex-col gap-2">
                  {cards.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-200 px-3 py-4 text-center text-[11px] text-gray-300">
                      Empty
                    </div>
                  ) : (
                    cards.map((c) => (
                      <CardTile key={c.id} card={c} onSelect={setSelected} />
                    ))
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {selected && (
        <CardPanel card={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
