"use client";

import { useState, useEffect } from "react";
import { Building2, Plus, TrendingUp, Archive as ArchiveIcon, RotateCcw } from "lucide-react";
import Link from "next/link";

interface ClientSummary {
  id: string;
  name: string;
  industry?: string;
  brandColor?: string;
  archived: boolean;
  archivedAt?: string | null;
  campaignCount: number;
  totalSpend: number;
  currency: string;
}

function fmt(n: number, currency: string): string {
  const symbol = currency === "USD" ? "$" : currency === "EUR" ? "€" : "£";
  if (n >= 1_000_000) return symbol + (n / 1_000_000).toFixed(1) + "m";
  if (n >= 1_000) return symbol + (n / 1_000).toFixed(1) + "k";
  return symbol + n.toLocaleString("en-GB", { maximumFractionDigits: 0 });
}

function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();
}

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(showArchived ? "/api/clients?includeArchived=true" : "/api/clients")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setClients(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [showArchived]);

  async function archiveClient(client: ClientSummary) {
    const dealNote =
      client.campaignCount > 0
        ? ` This client has ${client.campaignCount} active deal${client.campaignCount !== 1 ? "s" : ""}, which stay in the pipeline.`
        : "";
    if (
      !confirm(
        `Archive ${client.name}? They will be hidden from the main list but can be restored.${dealNote}`
      )
    )
      return;
    const previous = clients;
    setClients((prev) =>
      showArchived
        ? prev.map((c) =>
            c.id === client.id
              ? { ...c, archived: true, archivedAt: new Date().toISOString() }
              : c
          )
        : prev.filter((c) => c.id !== client.id)
    );
    try {
      const res = await fetch(`/api/clients/${client.id}/archive`, { method: "PATCH" });
      if (!res.ok) setClients(previous);
    } catch {
      setClients(previous);
    }
  }

  async function unarchiveClient(client: ClientSummary) {
    const previous = clients;
    setClients((prev) =>
      prev.map((c) => (c.id === client.id ? { ...c, archived: false, archivedAt: null } : c))
    );
    try {
      const res = await fetch(`/api/clients/${client.id}/unarchive`, { method: "PATCH" });
      if (!res.ok) setClients(previous);
    } catch {
      setClients(previous);
    }
  }

  const visibleCount = clients.filter((c) => !c.archived).length;
  const totalRevenue = clients.filter((c) => !c.archived).reduce((s, c) => s + c.totalSpend, 0);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Clients</h1>
          <p className="text-xs text-gray-500">
            {loading
              ? "Loading…"
              : `${visibleCount} client${visibleCount !== 1 ? "s" : ""} · £${(totalRevenue / 1000).toFixed(0)}k total`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowArchived((v) => !v)}
            className={`flex items-center gap-1.5 rounded-lg border bg-white text-sm px-3 py-2 transition-colors ${
              showArchived
                ? "border-gray-400 text-gray-700 font-medium"
                : "border-gray-200 text-gray-500 hover:bg-gray-50"
            }`}
            title={showArchived ? "Hide archived clients" : "Show archived clients"}
          >
            <ArchiveIcon className="h-3.5 w-3.5 text-gray-400" />
            {showArchived ? "Showing archived" : "Show archived"}
          </button>
          <button
            disabled
            className="flex items-center gap-2 rounded-lg bg-[#ffd700] px-4 py-2 text-sm font-medium text-black hover:bg-[#e6c200] transition-colors disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            Add Client
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-36 animate-pulse rounded-xl bg-gray-100" />
            ))}
          </div>
        ) : clients.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 p-12 text-center">
            <Building2 className="mx-auto h-10 w-10 text-gray-300" />
            <p className="mt-3 text-sm text-gray-400">No clients yet</p>
            <p className="mt-1 text-xs text-gray-300">
              Clients are created automatically when you add a campaign
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {clients.map((client) => (
              <div
                key={client.id}
                className={`group relative rounded-xl border bg-white p-5 transition-all ${
                  client.archived
                    ? "border-gray-200 opacity-70 hover:opacity-100"
                    : "border-gray-200 hover:border-[#ffd700]/50 hover:shadow-md"
                }`}
              >
                <Link
                  href={`/commercial/clients/${client.id}`}
                  className="block"
                >
                  {/* Logo + name row */}
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white font-bold text-sm ${
                        client.archived ? "grayscale" : ""
                      }`}
                      style={{ backgroundColor: client.brandColor ?? "#ffd700" }}
                    >
                      {initials(client.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p
                          className={`font-semibold truncate transition-colors ${
                            client.archived
                              ? "text-gray-500"
                              : "text-gray-900 group-hover:text-[var(--portal-commercial)]"
                          }`}
                        >
                          {client.name}
                        </p>
                        {client.archived && (
                          <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                            Archived
                          </span>
                        )}
                      </div>
                      {client.industry && (
                        <p className="text-xs text-gray-400 truncate">{client.industry}</p>
                      )}
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-gray-50 px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                        Total Spend
                      </p>
                      <p className="mt-0.5 text-sm font-bold text-gray-900">
                        {fmt(client.totalSpend, client.currency)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-gray-50 px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                        Campaigns
                      </p>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <p className="text-sm font-bold text-gray-900">{client.campaignCount}</p>
                        {client.campaignCount > 0 && (
                          <TrendingUp className="h-3 w-3 text-emerald-500" />
                        )}
                      </div>
                    </div>
                  </div>
                </Link>

                {/* Archive / Unarchive action — subtle, revealed on hover */}
                {client.archived ? (
                  <button
                    onClick={() => unarchiveClient(client)}
                    className="absolute right-3 top-3 flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-[11px] font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
                    title="Restore this client"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Unarchive
                  </button>
                ) : (
                  <button
                    onClick={() => archiveClient(client)}
                    className="absolute right-3 top-3 flex items-center gap-1 rounded-lg border border-transparent bg-white/80 px-2 py-1 text-[11px] font-medium text-gray-400 opacity-0 hover:border-gray-200 hover:text-gray-600 group-hover:opacity-100 transition-all"
                    title="Archive this client"
                  >
                    <ArchiveIcon className="h-3 w-3" />
                    Archive
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
