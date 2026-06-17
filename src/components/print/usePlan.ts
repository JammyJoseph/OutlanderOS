"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  SEED_ISSUES,
  type MagazinePage,
  type MagazinePlanData,
  type PlanStats,
  type IssueState,
} from "@/lib/magazine-plan";

const JSON_HEADERS = { "Content-Type": "application/json" };

interface SavedShape {
  id: string;
  issueNumber: number;
  issueName: string;
  totalPages: number;
  pages: MagazinePage[];
  updatedAt: string;
  updatedBy: string | null;
}

// Lightweight per-issue summary used by the print dashboard.
export interface IssueSummary {
  id: string;
  issueNumber: number;
  issueName: string;
  totalPages: number;
  updatedAt: string;
  updatedBy: string | null;
  stats: PlanStats;
  state: IssueState;
}

// Ensures the representative issues exist. Seeds if any are missing — the POST is
// idempotent (it never overwrites an existing issue), so this also back-fills the
// new AW25 issue on an environment that was already seeded with SS26 alone.
async function ensureSeeded(): Promise<IssueSummary[]> {
  let res = await fetch(`/api/magazine-plan`, { cache: "no-store" });
  let data = await res.json();
  let issues: IssueSummary[] = data.issues ?? [];
  const present = new Set(issues.map((i) => i.issueNumber));
  const missingSeed = SEED_ISSUES.some((s) => !present.has(s.issueNumber));
  if (missingSeed) {
    await fetch(`/api/magazine-plan`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ seedAll: true }),
    });
    res = await fetch(`/api/magazine-plan`, { cache: "no-store" });
    data = await res.json();
    issues = data.issues ?? [];
  }
  return issues;
}

// Loads one magazine plan (by issue number, or the most recent when omitted),
// auto-seeding on first use, and gives back a debounced saver. The tracker and
// flat-plan views share this so an edit in one persists to the same DB row.
export function useMagazinePlan(issueNumber?: number | null) {
  const [plan, setPlan] = useState<MagazinePlanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const issues = await ensureSeeded();
      if (!issues.length) {
        setError("No issues available");
        return;
      }
      // Resolve the target issue: explicit number, else the most recent.
      const target =
        issueNumber != null && issues.some((i) => i.issueNumber === issueNumber)
          ? issueNumber
          : issues[0].issueNumber;

      const res = await fetch(`/api/magazine-plan?issue=${target}`, { cache: "no-store" });
      const data = await res.json();
      if (data.plan) setPlan(normalise(data.plan));
      else setError(data.error ?? "Could not load plan");
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [issueNumber]);

  useEffect(() => {
    load();
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [load]);

  // Persist a new page array. Optimistically updates local state, then debounces
  // the PUT so rapid edits (typing, status clicks) collapse into one request.
  const savePages = useCallback(
    (pages: MagazinePage[], totalPages?: number) => {
      setPlan((prev) =>
        prev ? { ...prev, pages, totalPages: totalPages ?? prev.totalPages } : prev
      );
      if (saveTimer.current) clearTimeout(saveTimer.current);
      const planId = plan?.id;
      if (!planId) return;
      saveTimer.current = setTimeout(async () => {
        setSaving(true);
        try {
          const res = await fetch(`/api/magazine-plan/${planId}`, {
            method: "PUT",
            headers: JSON_HEADERS,
            body: JSON.stringify({ pages, totalPages }),
          });
          const data = await res.json();
          if (data.plan) setPlan(normalise(data.plan));
          else setError(data.error ?? "Save failed");
        } catch (e) {
          setError(String(e));
        } finally {
          setSaving(false);
        }
      }, 600);
    },
    [plan?.id]
  );

  return { plan, loading, saving, error, savePages, reload: load };
}

// Dashboard hook: lists every issue (seeding on first load) and can spin up the
// next issue by cloning the most recent issue's structure with content reset.
export function useIssues() {
  const [issues, setIssues] = useState<IssueSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setIssues(await ensureSeeded());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Issues come back sorted by issueNumber desc, so [0] is the most recent.
  const createNextIssue = useCallback(async (): Promise<SavedShape | null> => {
    const recent = issues[0];
    if (!recent) return null;
    setCreating(true);
    try {
      const nextNumber = recent.issueNumber + 1;
      const res = await fetch(`/api/magazine-plan`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          issueNumber: nextNumber,
          issueName: `Issue ${String(nextNumber).padStart(2, "0")}`,
          cloneFromIssue: recent.issueNumber,
        }),
      });
      const data = await res.json();
      await load();
      return data.plan ?? null;
    } catch (e) {
      setError(String(e));
      return null;
    } finally {
      setCreating(false);
    }
  }, [issues, load]);

  return { issues, loading, creating, error, reload: load, createNextIssue };
}

function normalise(raw: SavedShape): MagazinePlanData {
  return {
    id: raw.id,
    issueNumber: raw.issueNumber,
    issueName: raw.issueName,
    totalPages: raw.totalPages,
    pages: Array.isArray(raw.pages) ? raw.pages : [],
    updatedAt: raw.updatedAt,
    updatedBy: raw.updatedBy,
  };
}
