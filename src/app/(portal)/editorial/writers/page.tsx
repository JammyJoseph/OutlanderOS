"use client";

import { useState } from "react";
import { PenTool, Plus, X } from "lucide-react";

interface Writer {
  id: string;
  name: string;
  role: string;
  piecesCount: number;
  latestPiece: string;
  franchises: string[];
}

const ROLE_COLORS: Record<string, string> = {
  Editor: "bg-blue-100 text-blue-700",
  Contributor: "bg-purple-100 text-purple-700",
  Freelancer: "bg-amber-100 text-amber-700",
  Photographer: "bg-emerald-100 text-emerald-700",
};

const FRANCHISE_COLORS: Record<string, string> = {
  "Fashion Week Coverage": "bg-amber-50 text-amber-700 border-amber-200",
  "Artist Spotlight Series": "bg-purple-50 text-purple-700 border-purple-200",
  "Cultural Commentary": "bg-blue-50 text-blue-700 border-blue-200",
  "Street Style": "bg-green-50 text-green-700 border-green-200",
};

const DEMO_WRITERS: Writer[] = [
  {
    id: "1",
    name: "Emma Rhodes",
    role: "Editor",
    piecesCount: 24,
    latestPiece: "The New Luxury",
    franchises: ["Fashion Week Coverage", "Cultural Commentary"],
  },
  {
    id: "2",
    name: "Tom Hughes",
    role: "Photographer",
    piecesCount: 18,
    latestPiece: "Paris Winter Streets",
    franchises: ["Fashion Week Coverage", "Street Style"],
  },
  {
    id: "3",
    name: "Sara Kim",
    role: "Contributor",
    piecesCount: 11,
    latestPiece: "LFW AW26",
    franchises: ["Fashion Week Coverage"],
  },
  {
    id: "4",
    name: "James Liu",
    role: "Contributor",
    piecesCount: 9,
    latestPiece: "April Spotlight: Marco Rossi",
    franchises: ["Artist Spotlight Series"],
  },
  {
    id: "5",
    name: "Priya Sharma",
    role: "Freelancer",
    piecesCount: 6,
    latestPiece: "May Spotlight: Naomi Asante",
    franchises: ["Artist Spotlight Series"],
  },
  {
    id: "6",
    name: "Alix Fontaine",
    role: "Contributor",
    piecesCount: 14,
    latestPiece: "Digital vs Physical Fashion",
    franchises: ["Cultural Commentary"],
  },
  {
    id: "7",
    name: "Mia Johansson",
    role: "Photographer",
    piecesCount: 8,
    latestPiece: "London Spring Streets",
    franchises: ["Street Style"],
  },
];

const EMPTY_FORM = { name: "", role: "Contributor" };

export default function WritersPage() {
  const [writers, setWriters] = useState<Writer[]>(DEMO_WRITERS);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  function handleAdd() {
    if (!form.name.trim()) return;
    setWriters(prev => [
      ...prev,
      { id: String(Date.now()), name: form.name, role: form.role, piecesCount: 0, latestPiece: "", franchises: [] },
    ]);
    setShowModal(false);
    setForm(EMPTY_FORM);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Writer Directory</h1>
          <p className="text-xs text-gray-500">Editors, contributors, and freelancers</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 rounded-lg bg-[#D4A853] px-3 py-2 text-xs font-semibold text-white hover:bg-[#C49843] transition-colors"
        >
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
            <button
              onClick={() => setShowModal(true)}
              className="mt-4 flex items-center gap-1.5 rounded-lg bg-[#D4A853] px-4 py-2 text-xs font-semibold text-white hover:bg-[#C49843]"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Writer
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {writers.map((w) => (
              <WriterCard key={w.id} writer={w} />
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Add Writer</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Full name"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
                <select
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300"
                >
                  {Object.keys(ROLE_COLORS).map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-gray-100">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={!form.name.trim()}
                className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-40 transition-colors"
              >
                Add Writer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function WriterCard({ writer }: { writer: Writer }) {
  const initials = writer.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  const roleColor = ROLE_COLORS[writer.role] ?? "bg-gray-100 text-gray-600";

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-gray-600">
        {initials}
      </div>
      <h3 className="text-sm font-semibold text-gray-900">{writer.name}</h3>
      <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${roleColor}`}>
        {writer.role}
      </span>
      <p className="mt-2 text-xs text-gray-500">{writer.piecesCount} piece{writer.piecesCount !== 1 ? "s" : ""}</p>
      {writer.latestPiece && (
        <p className="mt-0.5 truncate text-[10px] text-gray-400">{writer.latestPiece}</p>
      )}
      {writer.franchises.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {writer.franchises.map(f => {
            const fc = FRANCHISE_COLORS[f] ?? "bg-gray-50 text-gray-600 border-gray-200";
            return (
              <span key={f} className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${fc}`}>
                {f.split(" ")[0]}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
