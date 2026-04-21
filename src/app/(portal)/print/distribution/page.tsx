"use client";

import { useState } from "react";
import { Truck, Plus, Package, Archive } from "lucide-react";

interface DistributionRecord {
  id: string;
  warehouse: string;
  quantity: number;
  shippedDate: string;
  tracking: string;
  status: "In Transit" | "Delivered" | "Pending";
}

const STATUS_STYLES: Record<string, string> = {
  "In Transit": "bg-amber-100 text-amber-700",
  Delivered: "bg-emerald-100 text-emerald-700",
  Pending: "bg-gray-100 text-gray-600",
};

export default function DistributionPage() {
  const [records] = useState<DistributionRecord[]>([]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Distribution</h1>
          <p className="text-xs text-gray-500">Magazine distribution and shipping records</p>
        </div>
        <button className="flex items-center gap-1.5 rounded-lg bg-[#D4A853] px-3 py-2 text-xs font-semibold text-white hover:bg-[#C49843]">
          <Plus className="h-3.5 w-3.5" />
          Add Distribution
        </button>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total Printed", value: "—", Icon: Package, color: "text-blue-600", bg: "bg-blue-50" },
            { label: "Distributed", value: "—", Icon: Truck, color: "text-emerald-600", bg: "bg-emerald-50" },
            { label: "Remaining", value: "—", Icon: Archive, color: "text-amber-600", bg: "bg-amber-50" },
          ].map(({ label, value, Icon, color, bg }) => (
            <div key={label} className="card-apple flex items-center gap-3 p-4">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${bg}`}>
                <Icon className={`h-5 w-5 ${color}`} />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-gray-500">{label}</p>
                <p className="text-xl font-bold text-gray-900">{value}</p>
              </div>
            </div>
          ))}
        </div>

        {records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
              <Truck className="h-8 w-8 text-gray-400" />
            </div>
            <h2 className="text-sm font-semibold text-gray-700">No distribution records yet</h2>
            <p className="mt-1 max-w-xs text-xs text-gray-400">
              Add distribution records to track where magazines have been shipped.
            </p>
            <button className="mt-4 flex items-center gap-1.5 rounded-lg bg-[#D4A853] px-4 py-2 text-xs font-semibold text-white hover:bg-[#C49843]">
              <Plus className="h-3.5 w-3.5" />
              Add Distribution
            </button>
          </div>
        ) : (
          <div className="card-apple overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {["Warehouse","Quantity","Shipped Date","Tracking","Status"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{r.warehouse}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{r.quantity.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{r.shippedDate}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{r.tracking}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${STATUS_STYLES[r.status]}`}>
                        {r.status}
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
