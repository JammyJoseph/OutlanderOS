"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";

import { ProductionFull } from "./_components/types";
import ProjectHeader from "./_components/ProjectHeader";
import TabBar, { TabKey } from "./_components/TabBar";
import OverviewTab from "./_components/OverviewTab";
import BudgetTab from "./_components/BudgetTab";
import TeamTab from "./_components/TeamTab";
import TasksTab from "./_components/TasksTab";
import CreativeTab from "./_components/CreativeTab";
import ScheduleTab from "./_components/ScheduleTab";
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
      budgetTotal: f.budget === "" ? null : Number(f.budget),
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
          activity: b.activity,
          location: b.location,
          notes: b.notes,
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

  async function deleteProject() {
    if (!production) return;
    if (!confirm("Delete this project? This will remove its call sheets, budget, tasks, and team."))
      return;
    await fetch(`/api/productions/${id}`, { method: "DELETE" });
    router.push("/production");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F9F9F7] flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (!production) {
    return (
      <div className="min-h-screen bg-[#F9F9F7] flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Project not found.</p>
          <Link
            href="/production"
            className="text-[#D4A853] text-sm font-medium hover:underline"
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
    tasks: (production.productionTasks ?? []).length,
    creative: (production.creativeAssets ?? []).length,
    schedule: (production.scheduleBlocks ?? []).length,
    callsheets: (production.callSheets ?? []).length,
    deliverables: (production.prodDeliverables ?? []).length,
  };

  return (
    <div className="min-h-screen bg-[#F9F9F7]">
      <div className="max-w-6xl mx-auto px-6 py-6">
        <div className="flex items-center justify-between mb-5">
          <Link
            href="/production"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft size={15} />
            Productions
          </Link>
          <button
            onClick={deleteProject}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors px-2 py-1"
          >
            Delete project
          </button>
        </div>

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
              productionId={production.id}
              items={production.budgetItems ?? []}
              campaignBudget={production.budgetTotal}
              onCampaignBudgetChange={(n) => savePatch({ budgetTotal: n })}
              refresh={refresh}
            />
          )}
          {tab === "team" && (
            <TeamTab
              productionId={production.id}
              members={production.teamMembers ?? []}
              refresh={refresh}
            />
          )}
          {tab === "tasks" && (
            <TasksTab
              productionId={production.id}
              tasks={production.productionTasks ?? []}
              refresh={refresh}
            />
          )}
          {tab === "creative" && (
            <CreativeTab
              productionId={production.id}
              assets={production.creativeAssets ?? []}
              refresh={refresh}
            />
          )}
          {tab === "schedule" && (
            <ScheduleTab
              productionId={production.id}
              blocks={production.scheduleBlocks ?? []}
              numShootDays={(production.shootDates ?? []).length}
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
              refresh={refresh}
            />
          )}
        </div>
      </div>
    </div>
  );
}
