"use client";

import Link from "next/link";
import { Plus, Loader2, ClipboardList, ChevronRight } from "lucide-react";
import { format, parseISO } from "date-fns";
import { CallSheet, CallSheetStatus, ProductionFull, callSheetTitle } from "./types";

interface Props {
  production: ProductionFull;
  creatingSheet: boolean;
  onCreateCallSheet: () => void;
}

const CS_STATUS_STYLES: Record<CallSheetStatus, { bg: string; text: string; label: string }> = {
  DRAFT: { bg: "bg-gray-100 dark:bg-gray-800", text: "text-gray-500 dark:text-gray-400", label: "Draft" },
  SAVED: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-300", label: "Saved" },
  PUBLISHED: { bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-300", label: "Published" },
};

function getShootTitle(cs: CallSheet, productionTitle: string): string {
  return callSheetTitle(cs, `${productionTitle} — ${format(parseISO(cs.shootDate), "d MMM")}`);
}

export default function CallSheetsTab({ production, creatingSheet, onCreateCallSheet }: Props) {
  const sheets = production.callSheets ?? [];

  return (
    <div className="space-y-5">
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 dark:border-gray-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
              <ClipboardList size={15} className="text-[#ffd700]" />
              Call Sheets
              <span className="text-xs text-gray-400 dark:text-gray-500 font-normal">({sheets.length})</span>
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Auto-populates from team, schedule, and project location.
            </p>
          </div>
          <button
            onClick={onCreateCallSheet}
            disabled={creatingSheet}
            className="flex items-center gap-1.5 bg-[#ffd700] text-black text-xs font-medium px-3 py-2 rounded-xl hover:bg-[#e6c200] transition-colors disabled:opacity-60"
          >
            {creatingSheet ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
            Create call sheet
          </button>
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
              onClick={onCreateCallSheet}
              disabled={creatingSheet}
              className="flex items-center gap-1.5 text-xs font-medium text-[#ffd700] hover:text-[#e6c200]"
            >
              <Plus size={13} />
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
                        <div className="text-[10px] font-semibold text-[#ffd700] uppercase leading-none">
                          {format(parseISO(cs.shootDate), "MMM")}
                        </div>
                        <div className="text-xl font-bold text-gray-800 dark:text-gray-200 leading-tight">
                          {format(parseISO(cs.shootDate), "d")}
                        </div>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 group-hover:text-[#ffd700] transition-colors truncate">
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
                        className="text-gray-300 dark:text-gray-600 group-hover:text-[#ffd700] transition-colors"
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
