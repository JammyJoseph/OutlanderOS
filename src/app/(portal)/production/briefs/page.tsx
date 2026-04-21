"use client";

import { useState } from "react";
import { FileText, Plus } from "lucide-react";

type BriefStatus = "Draft" | "Approved" | "In Production" | "Delivered";

const STATUS_STYLES: Record<BriefStatus, string> = {
  Draft: "bg-gray-100 text-gray-600",
  Approved: "bg-emerald-100 text-emerald-700",
  "In Production": "bg-amber-100 text-amber-700",
  Delivered: "bg-blue-100 text-blue-700",
};

interface Brief {
  id: string;
  title: string;
  client: string;
  campaign: string;
  status: BriefStatus;
  date: string;
}

export default function BriefsPage() {
  const [briefs] = useState<Brief[]>([]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Creative Briefs</h1>
          <p className="text-xs text-gray-500">Production briefs and approval status</p>
        </div>
        <button className="flex items-center gap-1.5 rounded-lg bg-[#D4A853] px-3 py-2 text-xs font-semibold text-white hover:bg-[#C49843]">
          <Plus className="h-3.5 w-3.5" />
          Create Brief
        </button>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {briefs.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
              <FileText className="h-8 w-8 text-gray-400" />
            </div>
            <h2 className="text-sm font-semibold text-gray-700">No briefs yet</h2>
            <p className="mt-1 max-w-xs text-xs text-gray-400">
              Create your first creative brief to kick off a production.
            </p>
            <button className="mt-4 flex items-center gap-1.5 rounded-lg bg-[#D4A853] px-4 py-2 text-xs font-semibold text-white hover:bg-[#C49843]">
              <Plus className="h-3.5 w-3.5" />
              Create Brief
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {briefs.map((brief) => (
              <div key={brief.id} className="card-apple flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100">
                    <FileText className="h-4 w-4 text-gray-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{brief.title}</p>
                    <p className="text-xs text-gray-500">{brief.client} — {brief.campaign}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400">{brief.date}</span>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${STATUS_STYLES[brief.status]}`}>
                    {brief.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
