"use client";

import { useState, useEffect } from "react";
import { Building2, ExternalLink } from "lucide-react";
import Link from "next/link";

interface Client {
  id: string;
  name: string;
  industry?: string;
  brandColor?: string;
  _count?: { campaigns: number };
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
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

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Clients</h1>
        <p className="mt-1 text-sm text-gray-500">
          {loading ? "Loading…" : `${clients.length} clients`}
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-100" />
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((client) => (
            <Link
              key={client.id}
              href={`/commercial/clients/${client.id}`}
              className="flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-4 transition-all hover:border-[#D4A853]/40 hover:shadow-md"
            >
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white font-bold text-sm"
                style={{ backgroundColor: client.brandColor ?? "#D4A853" }}
              >
                {client.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-gray-900 truncate">{client.name}</p>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 text-gray-300" />
                </div>
                {client.industry && (
                  <p className="text-xs text-gray-500">{client.industry}</p>
                )}
                {client._count && (
                  <p className="mt-1 text-xs text-[#D4A853] font-medium">
                    {client._count.campaigns} campaign{client._count.campaigns !== 1 ? "s" : ""}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
