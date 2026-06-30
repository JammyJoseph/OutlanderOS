"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Users, Network as NetworkIcon } from "lucide-react";
import { DIRECTORY_ACCENT } from "@/lib/directory";

const ACCENT = DIRECTORY_ACCENT;

interface CollabLink {
  handle: string;
  count: number;
  role: string | null;
  contactId: string | null;
  contactName: string | null;
}
interface NetworkNode {
  id: string;
  name: string;
  category: string;
  instagram: string | null;
  confidence: string | null;
  source: string | null;
  collaborations: CollabLink[];
}

export default function NetworkPanel() {
  const [nodes, setNodes] = useState<NetworkNode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/directory/network")
      .then((r) => r.json())
      .then((d) => {
        if (active) setNodes(Array.isArray(d?.nodes) ? d.nodes : []);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="animate-spin text-gray-600" size={24} />
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card px-6 py-20 text-center">
        <NetworkIcon size={28} className="mb-3 text-gray-600" />
        <p className="text-sm font-semibold text-gray-900">No collaborations mapped yet</p>
        <p className="mt-1 max-w-md text-xs text-gray-500">
          Scan a profile&apos;s credits and add the credited people to the directory — anyone
          co-credited on the same post becomes a collaboration link here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {nodes.map((n) => (
        <div key={n.id} className="rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link
              href={`/directory/${n.id}`}
              className="group flex items-center gap-2"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-gray-500">
                {n.name.slice(0, 2).toUpperCase()}
              </span>
              <div>
                <p className="text-sm font-semibold text-gray-900 group-hover:underline">
                  {n.name}
                </p>
                <p className="text-[11px] text-gray-500">{n.category}</p>
              </div>
            </Link>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-2.5 py-1 text-[11px] font-medium text-gray-500">
              <Users size={12} /> {n.collaborations.length} collaborator
              {n.collaborations.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {n.collaborations.map((c) => {
              const inner = (
                <>
                  <span className="font-medium text-gray-700">
                    {c.contactName || `@${c.handle}`}
                  </span>
                  {c.role && <span className="text-gray-500"> · {c.role}</span>}
                  <span
                    className="ml-1 rounded-full px-1.5 text-[10px] font-semibold text-black"
                    style={{ backgroundColor: ACCENT }}
                  >
                    {c.count}
                  </span>
                </>
              );
              const cls =
                "inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-xs transition-colors hover:border-[var(--ring)]";
              return c.contactId ? (
                <Link key={c.handle} href={`/directory/${c.contactId}`} className={cls}>
                  {inner}
                </Link>
              ) : (
                <a
                  key={c.handle}
                  href={`https://www.instagram.com/${c.handle}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cls}
                >
                  {inner}
                </a>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
