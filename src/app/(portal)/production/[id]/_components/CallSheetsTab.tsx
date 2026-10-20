"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, ClipboardList, ChevronRight, Wand2, Copy } from "lucide-react";
import { format, parseISO } from "date-fns";
import { CallSheet, CallSheetStatus, ProductionFull, callSheetTitle } from "./types";
import { Row, Rows, Tag, pill } from "@/components/os";
import { panelClass, type TagTone } from "@/lib/design";

interface Props {
  production: ProductionFull;
  creatingSheet: boolean;
  onCreateCallSheet: () => void;
  /** The five-step wizard lives on the project page so the header can open it too. */
  onOpenWizard: () => void;
}

// Fields copied when cloning a previous call sheet (Phase 4G).
const CLONE_FIELDS = [
  "callTime", "unitCallTime", "wrapTime", "location", "locationLat", "locationLng", "locations",
  "shotStyle", "schedule", "shotlist", "crew", "talent", "cateringDetails",
  "documents", "header", "clientTeam", "agencyTeam", "productionCompany",
  "callTimes", "productionMobiles", "movementOrder", "equipment",
  "productionNotes", "safetyNotes", "parkingNotes",
] as const;

const CS_STATUS_STYLES: Record<CallSheetStatus, { tone: TagTone; label: string }> = {
  DRAFT: { tone: "neutral", label: "Draft" },
  SAVED: { tone: "info", label: "Saved" },
  PUBLISHED: { tone: "ok", label: "Published" },
};

function getShootTitle(cs: CallSheet, productionTitle: string): string {
  return callSheetTitle(cs, `${productionTitle} — ${format(parseISO(cs.shootDate), "d MMM")}`);
}

export default function CallSheetsTab({ production, creatingSheet, onCreateCallSheet, onOpenWizard }: Props) {
  const router = useRouter();
  const sheets = production.callSheets ?? [];
  const [cloning, setCloning] = useState(false);

  // Clone the most recent call sheet into a fresh DRAFT (Phase 4G).
  async function clonePrevious() {
    const latest = sheets
      .slice()
      .sort((a, b) => new Date(b.shootDate).getTime() - new Date(a.shootDate).getTime())[0];
    if (!latest) return;
    setCloning(true);
    try {
      const r = await fetch(`/api/call-sheets/${latest.id}`);
      const d = await r.json();
      const s = d.sheet;
      if (!s) return;
      const payload: Record<string, unknown> = {
        productionId: production.id,
        shootTitle: `${s.shootTitle || production.title} (copy)`,
        shootDate: s.shootDate,
        status: "DRAFT",
      };
      for (const key of CLONE_FIELDS) {
        if (s[key] !== undefined && s[key] !== null) payload[key] = s[key];
      }
      const res = await fetch("/api/call-sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const nd = await res.json();
      if (nd.sheet) router.push(`/production/${production.id}/call-sheets/${nd.sheet.id}`);
    } finally {
      setCloning(false);
    }
  }

  return (
    <section aria-label="Call sheets" className={`${panelClass} px-6 py-6 sm:px-7`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">
            Call sheets <span className="font-normal text-muted-foreground">{sheets.length}</span>
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Fills itself from the team, schedule and project location.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {sheets.length > 0 && (
            <button
              onClick={clonePrevious}
              disabled={cloning}
              className={pill("ghost", "sm")}
              title="Clone the most recent call sheet"
            >
              {cloning ? <Loader2 size={14} className="animate-spin" /> : <Copy size={14} />}
              Clone previous
            </button>
          )}
          <button
            onClick={onCreateCallSheet}
            disabled={creatingSheet}
            className={pill("ghost", "sm")}
            title="Create a blank call sheet"
          >
            {creatingSheet ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Blank
          </button>
          <button
            onClick={onOpenWizard}
            className={pill("secondary", "sm")}
            title="Build a call sheet in 5 quick steps"
          >
            <Wand2 size={14} /> New call sheet
          </button>
        </div>
      </div>

      {sheets.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
          <ClipboardList size={24} className="mb-3 text-muted-foreground" />
          <p className="mb-1 text-[15px] font-semibold">No call sheets yet</p>
          <p className="mb-5 text-sm text-muted-foreground">Create a call sheet to start planning your shoot.</p>
          <button onClick={onOpenWizard} className={pill("outline", "sm")}>
            <Wand2 size={14} />
            Create call sheet
          </button>
        </div>
      ) : (
        <Rows>
          {sheets
            .slice()
            .sort((a, b) => new Date(a.shootDate).getTime() - new Date(b.shootDate).getTime())
            .map((cs) => {
              const csStyle = CS_STATUS_STYLES[cs.status] || CS_STATUS_STYLES.DRAFT;
              const sheetTitle = getShootTitle(cs, production.title);
              const addr = (cs.location as { address?: string } | null)?.address;
              return (
                <Row
                  key={cs.id}
                  href={`/production/${production.id}/call-sheets/${cs.id}`}
                  lead={
                    <div className="flex size-12 shrink-0 flex-col items-center justify-center rounded-xl bg-background leading-none">
                      <span className="text-[11px] font-semibold uppercase text-muted-foreground">
                        {format(parseISO(cs.shootDate), "MMM")}
                      </span>
                      <span className="mt-0.5 text-lg font-semibold tabular-nums">{format(parseISO(cs.shootDate), "d")}</span>
                    </div>
                  }
                  title={sheetTitle}
                  meta={
                    <span className="truncate">
                      {cs.callTime ? `Call ${cs.callTime}` : "No call time"}
                      {addr ? ` · ${addr}` : ""}
                    </span>
                  }
                  trail={
                    <span className="flex shrink-0 items-center gap-2">
                      <Tag tone={csStyle.tone}>{csStyle.label}</Tag>
                      <ChevronRight size={16} className="text-muted-foreground" />
                    </span>
                  }
                />
              );
            })}
        </Rows>
      )}
    </section>
  );
}
