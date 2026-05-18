"use client";

import { useEffect, useMemo, useState } from "react";
import { Link2, ExternalLink, X } from "lucide-react";

interface TrelloCard {
  id: string;
  name: string;
  client: string;
  url: string;
  budgetLabel: string;
}

interface Props {
  productionId: string;
  trelloCardId: string | null;
  onChange: () => void;
}

export default function LinkedDeal({ productionId, trelloCardId, onChange }: Props) {
  const [cards, setCards] = useState<TrelloCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/trello")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const flat: TrelloCard[] = [];
        for (const stage of d?.stages ?? []) {
          for (const c of stage.cards ?? []) {
            flat.push({
              id: c.id,
              name: c.name,
              client: c.client ?? "",
              url: c.url ?? "",
              budgetLabel: c.budgetLabel ?? "",
            });
          }
        }
        setCards(flat);
      })
      .catch(() => setCards([]))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const linkedCard = useMemo(
    () => cards.find((c) => c.id === trelloCardId) ?? null,
    [cards, trelloCardId]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cards.slice(0, 30);
    return cards
      .filter((c) => c.name.toLowerCase().includes(q) || c.client.toLowerCase().includes(q))
      .slice(0, 30);
  }, [cards, query]);

  async function link(cardId: string | null) {
    setSaving(true);
    try {
      const res = await fetch(`/api/productions/${productionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trelloCardId: cardId }),
      });
      if (res.ok) {
        setPicking(false);
        setQuery("");
        onChange();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
          <Link2 size={15} className="text-[#D4A853]" />
          Linked Deal
        </h2>
        {trelloCardId && !picking && (
          <button
            onClick={() => link(null)}
            disabled={saving}
            className="text-xs text-gray-300 hover:text-red-500 disabled:opacity-50"
          >
            Unlink
          </button>
        )}
      </div>

      {trelloCardId && !picking ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-900">
            {linkedCard ? linkedCard.name : "Trello card linked"}
          </p>
          {linkedCard?.client && (
            <p className="text-xs text-gray-500">{linkedCard.client}</p>
          )}
          <div className="flex items-center gap-3 pt-1">
            {linkedCard?.url && (
              <a
                href={linkedCard.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-[#D4A853] hover:text-[#c49843]"
              >
                <ExternalLink size={12} /> Open in Trello
              </a>
            )}
            <button
              onClick={() => setPicking(true)}
              className="text-xs font-medium text-gray-500 hover:text-gray-800"
            >
              Change
            </button>
          </div>
        </div>
      ) : picking ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search deals…"
              className="flex-1 px-3 py-2 rounded-xl border border-gray-100 text-sm bg-gray-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D4A853]/30"
            />
            <button
              onClick={() => {
                setPicking(false);
                setQuery("");
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={16} />
            </button>
          </div>
          <div className="max-h-56 overflow-auto rounded-xl border border-gray-100 divide-y divide-gray-50">
            {filtered.length === 0 ? (
              <p className="text-xs text-gray-400 px-3 py-3">No matching deals.</p>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.id}
                  onClick={() => link(c.id)}
                  disabled={saving}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 disabled:opacity-50"
                >
                  <p className="text-xs font-medium text-gray-900 truncate">{c.name}</p>
                  <p className="text-[11px] text-gray-400">
                    {c.client || "—"}
                    {c.budgetLabel && c.budgetLabel !== "N/A" ? ` · ${c.budgetLabel}` : ""}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>
      ) : (
        <div>
          <p className="text-xs text-gray-400 mb-2">
            No deal linked. Connect this project to a Commercial pipeline card.
          </p>
          <button
            onClick={() => setPicking(true)}
            disabled={loading}
            className="text-xs font-medium text-[#D4A853] hover:text-[#c49843] disabled:opacity-50"
          >
            {loading ? "Loading deals…" : "+ Link a deal"}
          </button>
        </div>
      )}
    </div>
  );
}
