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
import CreativeTab from "./_components/CreativeTab";
import TimelineTab from "./_components/TimelineTab";
import CallSheetsTab from "./_components/CallSheetsTab";
import WorkflowsTab from "./_components/WorkflowsTab";
import DeliverablesTab from "./_components/DeliverablesTab";
import CallSheetWizard from "./_components/CallSheetWizard";
import { Page, pill } from "@/components/os";
import { useUser } from "@/components/user-context";
import { useConfirm } from "@/components/ui/confirm-provider";

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const confirm = useConfirm();

  const [production, setProduction] = useState<ProductionFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [creatingSheet, setCreatingSheet] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [tab, setTab] = useState<TabKey>("overview");
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const { user } = useUser();
  const isAdmin = user?.role === "ADMIN";
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  // Editable form fields for overview header
  const [description, setDescription] = useState("");
  const [figmaUrl, setFigmaUrl] = useState("");
  const [budget, setBudget] = useState("");
  const [shootDates, setShootDates] = useState<string[]>([]);

  const fieldsRef = useRef({ description, figmaUrl, budget, shootDates });
  useEffect(() => {
    fieldsRef.current = { description, figmaUrl, budget, shootDates };
  }, [description, figmaUrl, budget, shootDates]);

  // Baseline of saved shoot dates — used to detect a shoot-date change and
  // offer to recalculate the standard-task deadlines.
  const shootBaselineRef = useRef<string>("");
  function shootKey(dates: string[]): string {
    return (dates ?? []).filter(Boolean).slice().sort().join(",");
  }

  async function recalcDeadlines() {
    await fetch(`/api/productions/${id}/milestones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "recalculate" }),
    });
    await refresh();
  }

  const load = useCallback(async () => {
    const r = await fetch(`/api/productions/${id}`);
    const d = await r.json();
    if (d.production) {
      const p: ProductionFull = d.production;
      setProduction(p);
      setDescription(p.description || p.brief || "");
      setFigmaUrl(p.figmaUrl || "");
      setBudget(p.budgetTotal != null ? String(p.budgetTotal) : "");
      const dates = (p.shootDates ?? []).map((d) => d.split("T")[0]);
      setShootDates(dates);
      shootBaselineRef.current = shootKey(dates);
    }
    setLoading(false);
  }, [id]);

  // Light refresh — pulls relations without resetting the editable form fields.
  // Refreshes are fired per edit and can overlap, so responses are sequenced: a
  // slow earlier fetch resolving last would otherwise overwrite the production
  // with a pre-edit snapshot, making a saved change look like it never landed.
  const refreshSeq = useRef(0);
  const refresh = useCallback(async () => {
    const seq = ++refreshSeq.current;
    const r = await fetch(`/api/productions/${id}`);
    const d = await r.json();
    if (seq !== refreshSeq.current) return; // a newer refresh already landed
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

        // Shoot date changed on a project that already has a standard timeline?
        // Offer to realign every template task deadline to the new date.
        const includesShoot =
          patch === undefined || Object.prototype.hasOwnProperty.call(body, "shootDates");
        if (includesShoot) {
          const nextKey = shootKey((body.shootDates as string[]) ?? []);
          const changed = nextKey !== shootBaselineRef.current;
          shootBaselineRef.current = nextKey;
          const hasTemplate = (production.milestones ?? []).some((m) => m.templateKey);
          if (changed && nextKey && hasTemplate) {
            if (
              await confirm({
                title: "Recalculate deadlines?",
                message:
                  "The shoot date changed. Realign all standard task deadlines to the new shoot date?",
                confirmLabel: "Recalculate",
              })
            ) {
              await recalcDeadlines();
            }
          }
        }
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

  // Editorial projects can be archived by any member. Deal-linked projects show
  // the same button, but clicking explains that Commercial owns them — only an
  // admin can go ahead. Archiving here never touches the parent deal.
  async function setArchived(archived: boolean) {
    if (!production) return;

    if (archived) {
      const commercial = Boolean(production.campaignId);

      if (commercial && !isAdmin) {
        // Not an error — an explanation, with a way to get to the right place.
        const goToDeal = await confirm({
          title: "This project is bound by a commercial agreement",
          message:
            "It came from a signed deal, so Commercial needs to remove it. An admin can archive it from here if you need it out of the way sooner.",
          confirmLabel: "Open deal",
          cancelLabel: "Close",
        });
        if (goToDeal) router.push(`/commercial/deals/${production.campaignId}`);
        return;
      }

      const ok = await confirm({
        title: "Archive this project?",
        message: commercial
          ? "This project is bound by a commercial agreement. Archiving hides it from the Production dashboard — the deal stays live in Commercial and nothing is deleted."
          : "It disappears from the Production dashboard but nothing is deleted — it can be unarchived later.",
        confirmLabel: "Archive",
        confirmVariant: "danger",
      });
      if (!ok) return;
    }
    setArchiveError(null);
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
        setArchiveError(data.error || "Failed to update archive state");
      }
    } finally {
      setArchiveBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (!production) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-4">Project not found.</p>
          <Link
            href="/production"
            className="text-brand text-sm font-medium hover:underline"
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
    <div className="min-h-full">
      {wizardOpen && <CallSheetWizard production={production} onClose={() => setWizardOpen(false)} />}
      <Page>
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/production"
            aria-label="Back to productions"
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
          >
            <ArrowLeft size={18} />
          </Link>
          {production.campaignId && (
            <span className="inline-flex flex-wrap items-center justify-end gap-x-1.5 text-sm text-muted-foreground">
              <Briefcase size={14} />
              Managed from Commercial
              <Link
                href={`/commercial/deals/${production.campaignId}`}
                className="inline-flex items-center gap-0.5 font-medium text-foreground underline decoration-line underline-offset-4 hover:decoration-foreground"
              >
                View deal <ArrowUpRight size={13} />
              </Link>
            </span>
          )}
        </div>

        {archiveError && (
          <div role="alert" className="-mt-4 rounded-2xl bg-bad-bg px-5 py-3.5 text-[15px] text-bad">
            {archiveError}
          </div>
        )}

        {production.archived && (
          <div className="-mt-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-surface px-6 py-4">
            <p className="flex flex-wrap items-center gap-2 text-[15px] font-semibold">
              <Archive size={16} className="text-muted-foreground" />
              This project is archived
              {production.campaignId && !isAdmin && (
                <span className="text-sm font-normal text-muted-foreground">
                  — it&rsquo;s bound by a commercial agreement, so Commercial or an admin can restore it
                </span>
              )}
            </p>
            <div className="flex items-center gap-2">
              {production.campaignId && (
                <Link href={`/commercial/deals/${production.campaignId}`} className={pill("outline", "sm")}>
                  <Briefcase size={14} /> Open deal
                </Link>
              )}
              {(!production.campaignId || isAdmin) && (
                <button onClick={() => setArchived(false)} disabled={archiveBusy} className={pill("outline", "sm")}>
                  {archiveBusy ? <Loader2 size={14} className="animate-spin" /> : <ArchiveRestore size={14} />}
                  Unarchive
                </button>
              )}
            </div>
          </div>
        )}

        <div className="-mt-4">
          <ProjectHeader
            production={production}
            saving={saving}
            saved={savedFlash}
            onPatch={(patch) => savePatch(patch)}
            onNewCallSheet={() => setWizardOpen(true)}
          />
        </div>

        <div>
        <TabBar active={tab} onSelect={setTab} counts={counts} />

        <div className="pt-6">
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
              production={production}
              productionId={production.id}
              members={production.teamMembers ?? []}
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
          {tab === "timeline" && (
            <TimelineTab
              productionId={production.id}
              milestones={production.milestones ?? []}
              shootDates={(production.shootDates ?? []).map((d) => d.split("T")[0])}
              refresh={refresh}
            />
          )}
          {tab === "workflows" && <WorkflowsTab productionId={production.id} />}
          {tab === "callsheets" && (
            <CallSheetsTab
              production={production}
              creatingSheet={creatingSheet}
              onCreateCallSheet={createCallSheet}
              onOpenWizard={() => setWizardOpen(true)}
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

        {/* Always offered. Deal-linked projects explain themselves on click
            rather than hiding the control — a missing button reads as a bug. */}
        {!production.archived && (
          <div className="flex justify-end">
            <button onClick={() => setArchived(true)} disabled={archiveBusy} className={pill("ghost", "sm")}>
              <Archive size={14} />
              Archive project
            </button>
          </div>
        )}
      </Page>
    </div>
  );
}
