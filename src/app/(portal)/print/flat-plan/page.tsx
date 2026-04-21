"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

type PageType = "editorial" | "ad" | "cover";
type PageStatus = "empty" | "confirmed" | "draft";

interface FlatPlanPage {
  id: number;
  number: number;
  type: PageType;
  status: PageStatus;
  assignedTo: string;
  title: string;
}

const TYPE_STYLES: Record<PageType, { bg: string; border: string; dot: string; label: string }> = {
  editorial: { bg: "bg-blue-50", border: "border-blue-200", dot: "bg-blue-500", label: "Editorial" },
  ad: { bg: "bg-amber-50", border: "border-amber-200", dot: "bg-amber-500", label: "Ad" },
  cover: { bg: "bg-purple-50", border: "border-purple-200", dot: "bg-purple-500", label: "Cover" },
};

const STATUS_LABEL: Record<PageStatus, { text: string; color: string }> = {
  empty: { text: "Empty", color: "text-gray-400" },
  confirmed: { text: "Confirmed", color: "text-emerald-600" },
  draft: { text: "Draft", color: "text-amber-600" },
};

const INITIAL_PAGES: FlatPlanPage[] = [
  { id: 1, number: 1, type: "cover", status: "confirmed", assignedTo: "Art Director", title: "Front Cover" },
  { id: 2, number: 2, type: "editorial", status: "confirmed", assignedTo: "Editor", title: "Contents" },
  { id: 3, number: 3, type: "ad", status: "confirmed", assignedTo: "Sales", title: "Full Page Ad" },
  { id: 4, number: 4, type: "editorial", status: "draft", assignedTo: "Emma R.", title: "Feature: Summer" },
  { id: 5, number: 5, type: "editorial", status: "draft", assignedTo: "Emma R.", title: "Feature: cont." },
  { id: 6, number: 6, type: "ad", status: "empty", assignedTo: "", title: "Half Page Ad" },
  { id: 7, number: 7, type: "editorial", status: "empty", assignedTo: "", title: "" },
  { id: 8, number: 8, type: "editorial", status: "empty", assignedTo: "", title: "" },
  { id: 9, number: 9, type: "ad", status: "empty", assignedTo: "", title: "" },
  { id: 10, number: 10, type: "editorial", status: "empty", assignedTo: "", title: "" },
  { id: 11, number: 11, type: "editorial", status: "empty", assignedTo: "", title: "" },
  { id: 12, number: 12, type: "cover", status: "empty", assignedTo: "", title: "Back Cover" },
];

export default function FlatPlanPage() {
  const [pages] = useState<FlatPlanPage[]>(INITIAL_PAGES);

  const confirmed = pages.filter((p) => p.status === "confirmed").length;
  const draft = pages.filter((p) => p.status === "draft").length;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Flat Plan</h1>
          <p className="text-xs text-gray-500">
            {pages.length} pages · {confirmed} confirmed · {draft} in draft
          </p>
        </div>
        <button className="flex items-center gap-1.5 rounded-lg bg-[#D4A853] px-3 py-2 text-xs font-semibold text-white hover:bg-[#C49843]">
          <Plus className="h-3.5 w-3.5" />
          Add Page
        </button>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {/* Legend */}
        <div className="mb-4 flex flex-wrap items-center gap-4">
          {Object.entries(TYPE_STYLES).map(([type, s]) => (
            <div key={type} className="flex items-center gap-1.5">
              <div className={`h-2.5 w-2.5 rounded-full ${s.dot}`} />
              <span className="text-xs text-gray-500">{s.label}</span>
            </div>
          ))}
          <div className="ml-2 flex items-center gap-4 border-l border-gray-200 pl-4">
            <span className="text-xs text-emerald-600">● Confirmed</span>
            <span className="text-xs text-amber-600">● Draft</span>
            <span className="text-xs text-gray-400">● Empty</span>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3 md:grid-cols-6">
          {pages.map((page) => {
            const ts = TYPE_STYLES[page.type];
            const ss = STATUS_LABEL[page.status];
            return (
              <div
                key={page.id}
                className={`rounded-xl border p-3 transition-opacity hover:opacity-80 ${ts.bg} ${ts.border}`}
              >
                <div className="flex items-start justify-between">
                  <span className="text-xs font-bold text-gray-600">p.{page.number}</span>
                  <span className={`text-[9px] font-semibold uppercase tracking-wide ${ss.color}`}>
                    {ss.text}
                  </span>
                </div>
                <p className="mt-1 truncate text-[10px] font-semibold text-gray-700">
                  {page.title || <span className="text-gray-300">Untitled</span>}
                </p>
                <p className="truncate text-[10px] text-gray-400">{page.assignedTo || "—"}</p>
                <div className="mt-2">
                  <span className={`inline-block rounded-full px-1.5 py-0.5 text-[9px] font-semibold text-white ${ts.dot}`}>
                    {ts.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
