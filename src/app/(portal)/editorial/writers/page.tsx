"use client";

import { useState } from "react";
import { PenTool, Plus } from "lucide-react";

interface Writer {
  id: string;
  name: string;
  role: string;
  piecesCount: number;
  latestPiece: string;
}

const ROLE_COLORS: Record<string, string> = {
  Editor: "bg-blue-100 text-blue-700",
  Contributor: "bg-purple-100 text-purple-700",
  Freelancer: "bg-amber-100 text-amber-700",
  Photographer: "bg-emerald-100 text-emerald-700",
};

export default function WritersPage() {
  const [writers] = useState<Writer[]>([]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Writer Directory</h1>
          <p className="text-xs text-gray-500">Editors, contributors, and freelancers</p>
        </div>
        <button className="flex items-center gap-1.5 rounded-lg bg-[#D4A853] px-3 py-2 text-xs font-semibold text-white hover:bg-[#C49843]">
          <Plus className="h-3.5 w-3.5" />
          Add Writer
        </button>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {writers.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
              <PenTool className="h-8 w-8 text-gray-400" />
            </div>
            <h2 className="text-sm font-semibold text-gray-700">No writers yet</h2>
            <p className="mt-1 max-w-xs text-xs text-gray-400">
              Add your editors, contributors, and freelance writers to this directory.
            </p>
            <button className="mt-4 flex items-center gap-1.5 rounded-lg bg-[#D4A853] px-4 py-2 text-xs font-semibold text-white hover:bg-[#C49843]">
              <Plus className="h-3.5 w-3.5" />
              Add Writer
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {writers.map((w) => (
              <div key={w.id} className="card-apple p-4">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-gray-600">
                  {w.name.charAt(0)}
                </div>
                <h3 className="text-sm font-semibold text-gray-900">{w.name}</h3>
                <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${ROLE_COLORS[w.role] || "bg-gray-100 text-gray-600"}`}>
                  {w.role}
                </span>
                <p className="mt-2 text-xs text-gray-500">{w.piecesCount} pieces</p>
                {w.latestPiece && (
                  <p className="mt-0.5 truncate text-[10px] text-gray-400">{w.latestPiece}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
