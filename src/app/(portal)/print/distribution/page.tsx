"use client";

import { useEffect, useState } from "react";
import { Loader2, Truck } from "lucide-react";
import RolloutView from "@/components/print/RolloutView";

interface Issue {
  id: string;
  issueNumber: number;
  issueName: string;
}

// Rollout and distribution planning, per issue. Replaces the placeholder
// shipment list that was here — the real question at this stage isn't "what has
// shipped" but "does every unit of the run have somewhere to be".
export default function DistributionPage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [issueId, setIssueId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/magazine-plan")
      .then((r) => r.json())
      .then((d) => {
        const list: Issue[] = (d.issues ?? []).map(
          (p: { id: string; issueNumber: number; issueName: string }) => ({
            id: p.id,
            issueNumber: p.issueNumber,
            issueName: p.issueName,
          })
        );
        list.sort((a, b) => b.issueNumber - a.issueNumber);
        setIssues(list);
        setIssueId((cur) => cur ?? list[0]?.id ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-4 border-b border-border bg-card px-6 py-3">
        <div className="flex items-center gap-2.5">
          <Truck size={16} className="text-[#9C7C2E]" />
          <div>
            <h1 className="text-base font-semibold text-foreground">Rollout &amp; distribution</h1>
            <p className="text-xs text-muted-foreground">
              Print run, warehouses, stockists and the launch calendar
            </p>
          </div>
        </div>
        {issues.length > 0 && (
          <select
            value={issueId ?? ""}
            onChange={(e) => setIssueId(e.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground outline-none focus:ring-2 focus:ring-[#9C7C2E]/30"
          >
            {issues.map((i) => (
              <option key={i.id} value={i.id}>
                Issue {String(i.issueNumber).padStart(2, "0")} — {i.issueName}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={22} className="animate-spin text-muted-foreground" />
          </div>
        ) : issueId ? (
          <RolloutView issueId={issueId} />
        ) : (
          <p className="text-sm text-muted-foreground">No issues yet — create one on the flat plan.</p>
        )}
      </div>
    </div>
  );
}
