"use client";

import { useState, useEffect } from "react";
import { Building2, Plus, TrendingUp } from "lucide-react";
import Link from "next/link";

interface ClientSummary {
  id: string;
  name: string;
  industry?: string;
  brandColor?: string;
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

  useEffect(() => {
    fetch("/api/clients")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setClients(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const totalRevenue = clients.reduce((s, c) => s + c.totalSpend, 0);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Clients</h1>
          <p className="text-xs text-gray-500">
            {loading
              ? "Loading…"
              : `${clients.length} client${clients.length !== 1 ? "s" : ""} · £${(totalRevenue / 1000).toFixed(0)}k total`}
          </p>
        </div>
        <button
          disabled
          className="flex items-center gap-2 rounded-lg bg-[#ffd700] px-4 py-2 text-sm font-medium text-black hover:bg-[#e6c200] transition-colors disabled:opacity-60"
        >
          <Plus className="h-4 w-4" />
          Add Client
        </button>
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
              <Link
                key={client.id}
                href={`/commercial/clients/${client.id}`}
                className="group rounded-xl border border-gray-200 bg-white p-5 transition-all hover:border-[#ffd700]/50 hover:shadow-md"
              >
                {/* Logo + name row */}
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white font-bold text-sm"
                    style={{ backgroundColor: client.brandColor ?? "#ffd700" }}
                  >
                    {initials(client.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900 truncate group-hover:text-[#ffd700] transition-colors">
                      {client.name}
                    </p>
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
