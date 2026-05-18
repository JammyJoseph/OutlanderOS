import { Plus, Trash2 } from "lucide-react";
import type { CrewMember, TalentMember } from "./types";

export const inputCls =
  "w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4A853]/30 focus:border-[#D4A853]";

export const smallInputCls =
  "px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#D4A853]/30 focus:border-[#D4A853]";

export const labelCls = "block text-xs font-medium text-gray-500 mb-1.5";

export function Section({
  title,
  icon,
  action,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-5 py-3.5 border-b border-gray-50">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        </div>
        {action}
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

export function DocSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="break-inside-avoid">
      <div className="flex items-center gap-1.5 mb-3">
        <span className="text-gray-400">{icon}</span>
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">{title}</h3>
      </div>
      {children}
    </div>
  );
}

export function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 text-xs font-medium text-[#D4A853] hover:text-[#c49843] transition-colors mt-1"
    >
      <Plus size={13} /> {label}
    </button>
  );
}

export function DeleteButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors"
    >
      <Trash2 size={13} />
    </button>
  );
}

export function PeopleTable({
  people,
  setPeople,
  readOnly = false,
  addLabel = "Add Person",
}: {
  people: (CrewMember | TalentMember)[];
  setPeople: (v: (CrewMember | TalentMember)[]) => void;
  readOnly?: boolean;
  addLabel?: string;
}) {
  if (readOnly) {
    if (people.length === 0) return null;
    return (
      <div className="border border-gray-100 rounded-xl overflow-hidden">
        <div className="grid grid-cols-[1fr_1fr_70px_1.2fr_1fr] gap-0 text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50 px-4 py-2">
          <span>Role</span>
          <span>Name</span>
          <span>Call</span>
          <span>Email</span>
          <span>Phone</span>
        </div>
        {people.map((p, i) => (
          <div
            key={i}
            className={`grid grid-cols-[1fr_1fr_70px_1.2fr_1fr] gap-0 px-4 py-2.5 text-sm ${
              i % 2 === 0 ? "bg-white" : "bg-gray-50/50"
            }`}
          >
            <span className="text-gray-600 font-medium">{p.role}</span>
            <span className="text-gray-800">{p.name}</span>
            <span className="text-[#D4A853] font-mono text-xs">{p.callTime}</span>
            <span className="text-gray-500 text-xs truncate">{p.email}</span>
            <span className="text-gray-500 text-xs">{p.phone}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {people.map((p, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_90px_1fr_1fr_32px] gap-2 items-center">
          <input
            type="text"
            value={p.role}
            onChange={(e) => setPeople(people.map((m, j) => (j === i ? { ...m, role: e.target.value } : m)))}
            placeholder="Role"
            className={smallInputCls}
          />
          <input
            type="text"
            value={p.name}
            onChange={(e) => setPeople(people.map((m, j) => (j === i ? { ...m, name: e.target.value } : m)))}
            placeholder="Name"
            className={smallInputCls}
          />
          <input
            type="time"
            value={p.callTime}
            onChange={(e) => setPeople(people.map((m, j) => (j === i ? { ...m, callTime: e.target.value } : m)))}
            className={smallInputCls}
          />
          <input
            type="email"
            value={p.email}
            onChange={(e) => setPeople(people.map((m, j) => (j === i ? { ...m, email: e.target.value } : m)))}
            placeholder="Email"
            className={smallInputCls}
          />
          <input
            type="tel"
            value={p.phone}
            onChange={(e) => setPeople(people.map((m, j) => (j === i ? { ...m, phone: e.target.value } : m)))}
            placeholder="Phone"
            className={smallInputCls}
          />
          <DeleteButton onClick={() => setPeople(people.filter((_, j) => j !== i))} />
        </div>
      ))}
      <AddButton
        label={addLabel}
        onClick={() => setPeople([...people, { role: "", name: "", callTime: "", email: "", phone: "" }])}
      />
    </div>
  );
}
