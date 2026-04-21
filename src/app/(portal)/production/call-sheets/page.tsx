"use client";

import { useState } from "react";
import { ClipboardList, Plus } from "lucide-react";

type DistributionStatus = "Pending" | "Sent" | "Delivered";

const DIST_STYLES: Record<DistributionStatus, string> = {
  Pending: "bg-gray-100 text-gray-600",
  Sent: "bg-amber-100 text-amber-700",
  Delivered: "bg-emerald-100 text-emerald-700",
};

interface CallSheet {
  id: string;
  production: string;
  shootDate: string;
  location: string;
  crewCount: number;
  distributionStatus: DistributionStatus;
}

export default function CallSheetsPage() {
  const [callSheets] = useState<CallSheet[]>([]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Call Sheets</h1>
          <p className="text-xs text-gray-500">Shoot schedules and crew distribution</p>
        </div>
        <button className="flex items-center gap-1.5 rounded-lg bg-[#D4A853] px-3 py-2 text-xs font-semibold text-white hover:bg-[#C49843]">
          <Plus className="h-3.5 w-3.5" />
          Create Call Sheet
        </button>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {callSheets.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
              <ClipboardList className="h-8 w-8 text-gray-400" />
            </div>
            <h2 className="text-sm font-semibold text-gray-700">No call sheets yet</h2>
            <p className="mt-1 max-w-xs text-xs text-gray-400">
              Create your first call sheet for an upcoming shoot.
            </p>
            <button className="mt-4 flex items-center gap-1.5 rounded-lg bg-[#D4A853] px-4 py-2 text-xs font-semibold text-white hover:bg-[#C49843]">
              <Plus className="h-3.5 w-3.5" />
              Create Call Sheet
            </button>
          </div>
        ) : (
          <div className="card-apple overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {["Production","Shoot Date","Location","Crew","Distribution"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {callSheets.map((cs) => (
                  <tr key={cs.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{cs.production}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{cs.shootDate}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{cs.location}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{cs.crewCount}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${DIST_STYLES[cs.distributionStatus]}`}>
                        {cs.distributionStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
