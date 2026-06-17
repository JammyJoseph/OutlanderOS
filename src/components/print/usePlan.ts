"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MagazinePage, MagazinePlanData } from "@/lib/magazine-plan";

const ACTIVE_ISSUE = 2; // Issue 02 — SS26 is the live planning issue

interface SavedShape {
  id: string;
  issueNumber: number;
  issueName: string;
  totalPages: number;
  pages: MagazinePage[];
  updatedAt: string;
  updatedBy: string | null;
}

// Loads the active magazine plan, auto-seeding it on first use, and gives back a
// debounced saver. Both the tracker and flat-plan views share this so an edit in
// one persists and the other re-reads the same database row.
export function useMagazinePlan() {
  const [plan, setPlan] = useState<MagazinePlanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/magazine-plan?issue=${ACTIVE_ISSUE}`, { cache: "no-store" });
      const data = await res.json();
      if (data.plan) {
        setPlan(normalise(data.plan));
        return;
      }
      // First run: seed the representative SS26 structure.
      const seedRes = await fetch(`/api/magazine-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueNumber: ACTIVE_ISSUE, issueName: "SS26", seed: true }),
      });
      const seeded = await seedRes.json();
      if (seeded.plan) setPlan(normalise(seeded.plan));
      else setError(seeded.error ?? "Could not create plan");
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

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
            headers: { "Content-Type": "application/json" },
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
