"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Loader2, ClipboardList, ChevronRight, Wand2, Copy } from "lucide-react";
import { format, parseISO } from "date-fns";
import { CallSheet, CallSheetStatus, ProductionFull, callSheetTitle } from "./types";
import CallSheetWizard from "./CallSheetWizard";

interface Props {
  production: ProductionFull;
  creatingSheet: boolean;
  onCreateCallSheet: () => void;
}

// Fields copied when cloning a previous call sheet (Phase 4G).
const CLONE_FIELDS = [
  "callTime", "unitCallTime", "wrapTime", "location", "locationLat", "locationLng", "locations",
  "shotStyle", "schedule", "shotlist", "crew", "talent", "cateringDetails",
  "documents", "header", "clientTeam", "agencyTeam", "productionCompany",
  "callTimes", "productionMobiles", "movementOrder", "equipment",
  "productionNotes", "safetyNotes", "parkingNotes",
] as const;

const CS_STATUS_STYLES: Record<CallSheetStatus, { bg: string; text: string; label: string }> = {
  DRAFT: { bg: "bg-gray-100 dark:bg-gray-800", text: "text-gray-500 dark:text-gray-400", label: "Draft" },
  SAVED: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-300", label: "Saved" },
  PUBLISHED: { bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-300", label: "Published" },
};

function getShootTitle(cs: CallSheet, productionTitle: string): string {
  return callSheetTitle(cs, `${productionTitle} — ${format(parseISO(cs.shootDate), "d MMM")}`);
}

export default function CallSheetsTab({ production, creatingSheet, onCreateCallSheet }: Props) {
  const router = useRouter();
  const sheets = production.callSheets ?? [];
  const [wizardOpen, setWizardOpen] = useState(false);
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
    <div className="space-y-5">
      {wizardOpen && <CallSheetWizard production={production} onClose={() => setWizardOpen(false)} />}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 dark:border-gray-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
              <ClipboardList size={15} className="text-[#9C7C2E]" />
              Call Sheets
              <span className="text-xs text-gray-400 dark:text-gray-500 font-normal">({sheets.length})</span>
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Auto-populates from team, schedule, and project location.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {sheets.length > 0 && (
              <button
                onClick={clonePrevious}
                disabled={cloning}
                className="flex items-center gap-1.5 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 text-xs font-medium px-3 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-60"
                title="Clone the most recent call sheet"
              >
                {cloning ? <Loader2 size={13} className="animate-spin" /> : <Copy size={13} />}
                Clone previous
              </button>
            )}
            <button
              onClick={onCreateCallSheet}
              disabled={creatingSheet}
              className="flex items-center gap-1.5 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 text-xs font-medium px-3 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-60"
              title="Create a blank call sheet"
            >
              {creatingSheet ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              Blank
            </button>
            <button
              onClick={() => setWizardOpen(true)}
              className="flex items-center gap-1.5 bg-[#111111] dark:bg-white text-white dark:text-black text-xs font-medium px-3 py-2 rounded-xl hover:opacity-90 transition-colors"
              title="Build a call sheet in 5 quick steps"
            >
              <Wand2 size={13} /> New call sheet
            </button>
          </div>
        </div>

        {sheets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center px-6">
            <div className="w-12 h-12 bg-gray-50 dark:bg-gray-800 rounded-xl flex items-center justify-center mb-3">
              <ClipboardList size={20} className="text-gray-300 dark:text-gray-600" />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1 font-medium">No call sheets yet</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-5">
              Create a call sheet to start planning your shoot.
            </p>
            <button
              onClick={() => setWizardOpen(true)}
              className="flex items-center gap-1.5 text-xs font-medium text-[#9C7C2E] hover:text-[#9C7C2E]"
            >
              <Wand2 size={13} />
              Create call sheet
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-gray-800">
            {sheets
              .slice()
              .sort(
                (a, b) =>
                  new Date(a.shootDate).getTime() - new Date(b.shootDate).getTime()
              )
              .map((cs) => {
                const csStyle = CS_STATUS_STYLES[cs.status] || CS_STATUS_STYLES.DRAFT;
                const sheetTitle = getShootTitle(cs, production.title);
                const addr = (cs.location as { address?: string } | null)?.address;
                return (
                  <Link
                    key={cs.id}
                    href={`/production/${production.id}/call-sheets/${cs.id}`}
                    className="flex items-center justify-between px-5 py-4 hover:bg-gray-50/60 dark:hover:bg-gray-800/60 transition-colors group"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="text-center w-11 shrink-0">
                        <div className="text-[10px] font-semibold text-[#9C7C2E] uppercase leading-none">
                          {format(parseISO(cs.shootDate), "MMM")}
                        </div>
                        <div className="text-xl font-bold text-gray-800 dark:text-gray-200 leading-tight">
                          {format(parseISO(cs.shootDate), "d")}
                        </div>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 group-hover:text-[#9C7C2E] transition-colors truncate">
                          {sheetTitle}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">
                          {cs.callTime || "—"} {addr ? `· ${addr}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${csStyle.bg} ${csStyle.text}`}
                      >
                        {csStyle.label}
                      </span>
                      <ChevronRight
                        size={15}
                        className="text-gray-300 dark:text-gray-600 group-hover:text-[#9C7C2E] transition-colors"
                      />
                    </div>
                  </Link>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}
