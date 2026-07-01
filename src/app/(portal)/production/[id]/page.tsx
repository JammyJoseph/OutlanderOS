"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Archive, ArchiveRestore, ArrowLeft, ArrowUpRight, Briefcase, Loader2 } from "lucide-react";

import { ProductionFull } from "./_components/types";
import ProjectHeader from "./_components/ProjectHeader";
import TabBar, { TabKey } from "./_components/TabBar";
import OverviewTab from "./_components/OverviewTab";
import BudgetTab from "./_components/BudgetTab";
import TeamTab from "./_components/TeamTab";
import TasksTab from "./_components/TasksTab";
import CreativeTab from "./_components/CreativeTab";
import CampaignTimelineTab from "./_components/CampaignTimelineTab";
import CallSheetsTab from "./_components/CallSheetsTab";
import DeliverablesTab from "./_components/DeliverablesTab";

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [production, setProduction] = useState<ProductionFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [creatingSheet, setCreatingSheet] = useState(false);
  const [tab, setTab] = useState<TabKey>("overview");
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [archiveBusy, setArchiveBusy] = useState(false);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => setIsAdmin(d.user?.role === "ADMIN"))
      .catch(() => {});
  }, []);

  // Editable form fields for overview header
  const [description, setDescription] = useState("");
  const [figmaUrl, setFigmaUrl] = useState("");
  const [budget, setBudget] = useState("");
  const [shootDates, setShootDates] = useState<string[]>([]);

  const fieldsRef = useRef({ description, figmaUrl, budget, shootDates });
  useEffect(() => {
    fieldsRef.current = { description, figmaUrl, budget, shootDates };
  }, [description, figmaUrl, budget, shootDates]);

  const load = useCallback(async () => {
    const r = await fetch(`/api/productions/${id}`);
    const d = await r.json();
    if (d.production) {
      const p: ProductionFull = d.production;
      setProduction(p);
      setDescription(p.description || p.brief || "");
      setFigmaUrl(p.figmaUrl || "");
      setBudget(p.budgetTotal != null ? String(p.budgetTotal) : "");
      setShootDates((p.shootDates ?? []).map((d) => d.split("T")[0]));
    }
    setLoading(false);
  }, [id]);

  // Light refresh — pulls relations without resetting the editable form fields
  const refresh = useCallback(async () => {
    const r = await fetch(`/api/productions/${id}`);
    const d = await r.json();
    if (d.production) setProduction(d.production);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function scheduleSave() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => savePatch(), 700);
  }

  async function savePatch(patch?: Record<string, unknown>) {
    if (!production) return;
    const f = fieldsRef.current;
    const body: Record<string, unknown> = patch ?? {
      description: f.description,
      figmaUrl: f.figmaUrl,
      // COMMERCIAL budgets are locked by the Commercial team — sending
      // budgetTotal would make the whole save 403.
      ...(production.type === "COMMERCIAL"
        ? {}
        : { budgetTotal: f.budget === "" ? null : Number(f.budget) }),
      shootDates: (f.shootDates ?? []).filter(Boolean),
    };
    setSaving(true);
    try {
      const res = await fetch(`/api/productions/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.production) {
        setProduction((prev) => (prev ? { ...prev, ...data.production } : data.production));
        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 1200);
      }
    } finally {
      setSaving(false);
    }
  }

  async function createCallSheet() {
    if (!production) return;
    setCreatingSheet(true);
    try {
      const usedDays = new Set(
        (production.callSheets ?? []).map((cs) => cs.shootDate.split("T")[0])
      );
      const candidate = (shootDates ?? []).find((d) => d && !usedDays.has(d));
      const shootDate = candidate || new Date().toISOString().split("T")[0];

      // First Day-1 schedule block as call time anchor
      const dayBlocks = (production.scheduleBlocks ?? [])
        .filter((b) => b.shootDay === 1)
        .sort((a, b) => a.time.localeCompare(b.time));
      const callTime = dayBlocks[0]?.time || "08:00";
      const location = dayBlocks.find((b) => b.location)?.location || null;

      // Auto-build crew payload from team members (CONTRACTED first)
      const team = (production.teamMembers ?? [])
        .slice()
        .sort((a, b) => {
          const order = { CONTRACTED: 0, CONFIRMED: 1, SUGGESTED: 2 } as const;
          return (
            (order[a.status] ?? 3) - (order[b.status] ?? 3)
          );
        })
        .map((m) => ({
          name: m.name,
          role: m.role,
          email: m.email,
          phone: m.phone,
          status: m.status,
        }));

      const schedule = (production.scheduleBlocks ?? [])
        .filter((b) => b.shootDay === 1)
        .sort((a, b) => a.time.localeCompare(b.time))
        .map((b) => ({
          time: b.time,
          description: b.activity,
          notes: b.notes || "",
        }));

      const res = await fetch("/api/call-sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productionId: production.id,
          shootDate: new Date(shootDate + "T08:00:00").toISOString(),
          callTime,
          location: location ? { address: location } : {},
          schedule,
          crew: team,
          status: "DRAFT",
        }),
      });
      const data = await res.json();
      if (data.sheet) {
        router.push(`/production/${production.id}/call-sheets/${data.sheet.id}`);
      }
    } finally {
      setCreatingSheet(false);
    }
  }

  // Standalone (editorial) productions can be archived here by an admin.
  // Productions linked to a deal are archived from Commercial only.
  async function setArchived(archived: boolean) {
    if (!production) return;
    if (
      archived &&
      !confirm("Archive this project? It disappears from the Production dashboard but nothing is deleted — an admin can unarchive it later.")
    )
      return;
    setArchiveBusy(true);
    try {
      const res = await fetch(`/api/productions/${id}/archive`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived }),
      });
      if (res.ok) {
        if (archived) router.push("/production");
        else await refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Failed to update archive state");
      }
    } finally {
      setArchiveBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-card flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (!production) {
    return (
      <div className="min-h-screen bg-card flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Project not found.</p>
          <Link
            href="/production"
            className="text-[#ffd700] text-sm font-medium hover:underline"
          >
            Back to Productions
          </Link>
        </div>
      </div>
    );
  }

  const counts: Partial<Record<TabKey, number>> = {
    budget: (production.budgetItems ?? []).length,
    team: (production.teamMembers ?? []).length,
    creative: (production.creativeAssets ?? []).length,
    timeline: (production.milestones ?? []).length,
    callsheets: (production.callSheets ?? []).length,
    deliverables: (production.prodDeliverables ?? []).length,
  };

  return (
    <div className="min-h-screen bg-card">
      <div className="max-w-6xl mx-auto px-6 py-6">
        <div className="flex items-center justify-between mb-5">
          <Link
            href="/production"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft size={15} />
            Productions
          </Link>
          {production.campaignId ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-gray-400 px-2 py-1">
              <Briefcase size={12} />
              This project is managed from Commercial
              <Link
                href={`/commercial/deals/${production.campaignId}`}
                className="inline-flex items-center gap-0.5 font-medium text-[#ffd700] hover:text-[#e6c200]"
              >
                View deal <ArrowUpRight size={11} />
              </Link>
            </span>
          ) : isAdmin ? (
            <button
              onClick={() => setArchived(true)}
              disabled={archiveBusy}
              className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors px-2 py-1 disabled:opacity-50"
            >
              <Archive size={12} />
              Archive project
            </button>
          ) : null}
        </div>

        {production.archived && (
          <div className="mb-5 rounded-2xl border border-gray-300 bg-gray-100 px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
            <p className="text-sm font-semibold text-gray-600 flex items-center gap-2">
              <Archive size={15} />
              This project is archived
              {production.campaignId && (
                <span className="font-normal text-gray-400 text-xs">
                  — unarchive it by unarchiving the parent deal in Commercial
                </span>
              )}
            </p>
            {production.campaignId ? (
              <Link
                href={`/commercial/deals/${production.campaignId}`}
                className="flex items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Briefcase size={13} /> Open deal <ArrowUpRight size={12} />
              </Link>
            ) : isAdmin ? (
              <button
                onClick={() => setArchived(false)}
                disabled={archiveBusy}
                className="flex items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {archiveBusy ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <ArchiveRestore size={13} />
                )}
                Unarchive
              </button>
            ) : null}
          </div>
        )}

        <div className="mb-5">
          <ProjectHeader
            production={production}
            saving={saving}
            saved={savedFlash}
            onPatch={(patch) => savePatch(patch)}
          />
        </div>

        <TabBar active={tab} onSelect={setTab} counts={counts} />

        <div className="pt-5">
          {tab === "overview" && (
            <OverviewTab
              production={production}
              description={description}
              setDescription={setDescription}
              budget={budget}
              setBudget={setBudget}
              figmaUrl={figmaUrl}
              setFigmaUrl={setFigmaUrl}
              shootDates={shootDates}
              setShootDates={setShootDates}
              scheduleSave={scheduleSave}
            />
          )}
          {tab === "budget" && (
            <BudgetTab
              production={production}
              items={production.budgetItems ?? []}
              campaignBudget={production.budgetTotal}
              onCampaignBudgetChange={(n) => savePatch({ budgetTotal: n })}
              refresh={refresh}
              locked={production.type === "COMMERCIAL"}
            />
          )}
          {tab === "team" && (
            <TeamTab
              productionId={production.id}
              members={production.teamMembers ?? []}
              refresh={refresh}
            />
          )}
          {tab === "tasks" && <TasksTab productionId={production.id} />}
          {tab === "creative" && (
            <CreativeTab
              productionId={production.id}
              assets={production.creativeAssets ?? []}
              refresh={refresh}
            />
          )}
          {tab === "timeline" && (
            <CampaignTimelineTab
              productionId={production.id}
              milestones={production.milestones ?? []}
              refresh={refresh}
            />
          )}
          {tab === "callsheets" && (
            <CallSheetsTab
              production={production}
              creatingSheet={creatingSheet}
              onCreateCallSheet={createCallSheet}
            />
          )}
          {tab === "deliverables" && (
            <DeliverablesTab
              productionId={production.id}
              deliverables={production.prodDeliverables ?? []}
              campaignId={production.campaign?.id ?? production.campaignId}
              campaignDeliverables={production.campaign?.deliverables ?? []}
              refresh={refresh}
            />
          )}
        </div>
      </div>
    </div>
  );
}
