"use client";

import { X } from "lucide-react";
import { APA_CREW_RATES } from "@/lib/apa-rates";
import { BUDGET_SECTIONS, gbp } from "./types";

// Section ordering + labels reuse the budget sections; any APA section key not
// in BUDGET_SECTIONS falls back to a humanised version of the key.
const SECTION_LABEL: Record<string, string> = Object.fromEntries(
  BUDGET_SECTIONS.map((s) => [s.key, s.label])
);

function sectionLabel(key: string): string {
  return SECTION_LABEL[key] ?? key.replace(/_/g, " ");
}

// Order sections by their position in BUDGET_SECTIONS, then anything else last.
const SECTION_ORDER: Record<string, number> = Object.fromEntries(
  BUDGET_SECTIONS.map((s, i) => [s.key, i])
);

export default function ApaRateCard({ onClose }: { onClose: () => void }) {
  // Group rates by section, preserving rate-card order within each section.
  const grouped = new Map<string, typeof APA_CREW_RATES>();
  for (const r of APA_CREW_RATES) {
    if (!grouped.has(r.section)) grouped.set(r.section, []);
    grouped.get(r.section)!.push(r);
  }
  const sections = [...grouped.keys()].sort(
    (a, b) => (SECTION_ORDER[a] ?? 99) - (SECTION_ORDER[b] ?? 99)
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-gray-50 px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">APA Rate Card</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Advertising Producers Association — standard commercial crew rates (2025). The max
              daily rate is used as the default when adding crew.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors shrink-0"
          >
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-4">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] font-bold uppercase tracking-widest text-gray-400 text-left">
                <th className="pb-2 pr-3">Role</th>
                <th className="pb-2 px-3 text-right">Daily Rate</th>
                <th className="pb-2 px-3 text-right">Hourly</th>
                <th className="pb-2 px-3 text-center">OT Grade</th>
                <th className="pb-2 pl-3 text-right">OT Rate</th>
              </tr>
            </thead>
            <tbody>
              {sections.map((sec) => (
                <SectionRows key={sec} label={sectionLabel(sec)} rates={grouped.get(sec)!} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SectionRows({
  label,
  rates,
}: {
  label: string;
  rates: typeof APA_CREW_RATES;
}) {
  return (
    <>
      <tr>
        <td
          colSpan={5}
          className="pt-4 pb-1 text-[10px] font-bold uppercase tracking-widest text-gray-600"
        >
          {label}
        </td>
      </tr>
      {rates.map((r) => (
        <tr key={r.role} className="border-t border-gray-50 hover:bg-amber-50/30">
          <td className="py-1.5 pr-3 text-gray-700 font-medium">{r.role}</td>
          <td className="py-1.5 px-3 text-right tabular-nums text-gray-900 font-semibold">
            {gbp(r.maxDailyRate)}
          </td>
          <td className="py-1.5 px-3 text-right tabular-nums text-gray-500">
            {r.basicHourlyRate > 0 ? gbp(r.basicHourlyRate) : "—"}
          </td>
          <td className="py-1.5 px-3 text-center text-gray-500">
            {r.overtimeGrade === "N/A" ? "—" : r.overtimeGrade}
          </td>
          <td className="py-1.5 pl-3 text-right tabular-nums text-gray-500">
            {r.standardOvertimeRate > 0 ? gbp(r.standardOvertimeRate) : "—"}
          </td>
        </tr>
      ))}
    </>
  );
}
