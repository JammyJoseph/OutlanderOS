"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2, Mail, Phone, Users } from "lucide-react";
import { TeamMember, TeamStatus, gbp } from "./types";

interface Props {
  productionId: string;
  members: TeamMember[];
  refresh: () => void;
}

const STATUS_CYCLE: TeamStatus[] = ["SUGGESTED", "CONFIRMED", "CONTRACTED"];

const STATUS_STYLES: Record<TeamStatus, { bg: string; text: string; border: string; label: string }> = {
  SUGGESTED: {
    bg: "bg-white",
    text: "text-gray-500",
    border: "border-gray-200",
    label: "Suggested",
  },
  CONFIRMED: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    label: "Confirmed",
  },
  CONTRACTED: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    label: "Contracted",
  },
};

export default function TeamTab({ productionId, members, refresh }: Props) {
  const [showAdd, setShowAdd] = useState(false);

  const totalCost = useMemo(() => {
    return (members ?? []).reduce((sum, m) => sum + (m.rate || 0), 0);
  }, [members]);

  const counts = useMemo(() => {
    return {
      total: members.length,
      confirmed: members.filter((m) => m.status === "CONFIRMED").length,
      contracted: members.filter((m) => m.status === "CONTRACTED").length,
      suggested: members.filter((m) => m.status === "SUGGESTED").length,
    };
  }, [members]);

  async function add(form: Partial<TeamMember>) {
    await fetch(`/api/productions/${productionId}/team`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setShowAdd(false);
    refresh();
  }

  async function update(memberId: string, patch: Partial<TeamMember>) {
    await fetch(`/api/productions/${productionId}/team?memberId=${memberId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    refresh();
  }

  async function remove(memberId: string) {
    if (!confirm("Remove this team member?")) return;
    await fetch(`/api/productions/${productionId}/team?memberId=${memberId}`, {
      method: "DELETE",
    });
    refresh();
  }

  function cycleStatus(m: TeamMember) {
    const idx = STATUS_CYCLE.indexOf(m.status);
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    update(m.id, { status: next });
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Stat label="Crew" value={String(counts.total)} icon={<Users size={14} />} />
        <Stat label="Suggested" value={String(counts.suggested)} dot="bg-gray-300" />
        <Stat label="Confirmed" value={String(counts.confirmed)} dot="bg-[#D4A853]" />
        <Stat label="Contracted" value={String(counts.contracted)} dot="bg-emerald-500" />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800">Team & Talent</h2>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">
              Total crew cost:{" "}
              <span className="font-semibold text-gray-800">{gbp(totalCost)}</span>
            </span>
            <button
              onClick={() => setShowAdd((v) => !v)}
              className="flex items-center gap-1 text-xs font-medium text-[#D4A853] hover:text-[#c49843]"
            >
              <Plus size={13} /> Add member
            </button>
          </div>
        </div>

        {showAdd && <AddMemberForm onAdd={add} onCancel={() => setShowAdd(false)} />}

        {members.length === 0 && !showAdd ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-gray-500">No team members yet.</p>
            <button
              onClick={() => setShowAdd(true)}
              className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[#D4A853] hover:text-[#c49843]"
            >
              <Plus size={12} /> Add your first member
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {(members ?? []).map((m) => (
              <MemberRow
                key={m.id}
                member={m}
                onUpdate={(patch) => update(m.id, patch)}
                onCycleStatus={() => cycleStatus(m)}
                onRemove={() => remove(m.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MemberRow({
  member,
  onUpdate,
  onCycleStatus,
  onRemove,
}: {
  member: TeamMember;
  onUpdate: (patch: Partial<TeamMember>) => void;
  onCycleStatus: () => void;
  onRemove: () => void;
}) {
  const [name, setName] = useState(member.name);
  const [role, setRole] = useState(member.role);
  const [rate, setRate] = useState(member.rate != null ? String(member.rate) : "");
  const [ratePer, setRatePer] = useState(member.ratePer || "day");
  const style = STATUS_STYLES[member.status] || STATUS_STYLES.SUGGESTED;

  return (
    <div className="grid grid-cols-12 gap-3 px-5 py-3 items-center hover:bg-amber-50/20 group">
      <div className="col-span-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            if (name !== member.name) onUpdate({ name });
          }}
          className="text-sm font-medium text-gray-900 bg-transparent border-none outline-none w-full px-1 py-0.5 rounded-md focus:bg-white"
        />
        <input
          type="text"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          onBlur={() => {
            if (role !== member.role) onUpdate({ role });
          }}
          className="text-xs text-gray-500 bg-transparent border-none outline-none w-full px-1 py-0.5 mt-0.5 rounded-md focus:bg-white"
        />
      </div>
      <div className="col-span-3 flex items-center gap-2 text-xs text-gray-500 min-w-0">
        {member.email && (
          <a
            href={`mailto:${member.email}`}
            className="inline-flex items-center gap-1 hover:text-[#D4A853] truncate"
          >
            <Mail size={11} className="shrink-0" />
            <span className="truncate">{member.email}</span>
          </a>
        )}
        {member.phone && (
          <a
            href={`tel:${member.phone}`}
            className="inline-flex items-center gap-1 hover:text-[#D4A853] truncate"
          >
            <Phone size={11} className="shrink-0" />
            <span className="truncate">{member.phone}</span>
          </a>
        )}
      </div>
      <div className="col-span-3 flex items-center gap-1.5">
        <span className="text-xs text-gray-400">£</span>
        <input
          type="number"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          onBlur={() => {
            const next = rate === "" ? null : Number(rate);
            if (next !== member.rate) onUpdate({ rate: next });
          }}
          placeholder="0"
          className="w-20 text-sm bg-transparent border-none outline-none px-1 py-0.5 rounded-md focus:bg-white tabular-nums"
        />
        <span className="text-xs text-gray-400">/</span>
        <select
          value={ratePer}
          onChange={(e) => {
            setRatePer(e.target.value);
            onUpdate({ ratePer: e.target.value });
          }}
          className="text-xs text-gray-500 bg-transparent border-none outline-none focus:bg-white rounded-md py-0.5"
        >
          <option value="day">day</option>
          <option value="hour">hour</option>
          <option value="project">project</option>
        </select>
      </div>
      <div className="col-span-3 flex items-center justify-end gap-2">
        <button
          onClick={onCycleStatus}
          className={`text-xs font-medium px-2.5 py-1 rounded-full border ${style.bg} ${style.text} ${style.border} hover:opacity-80 transition-opacity`}
        >
          {style.label}
        </button>
        <button
          onClick={onRemove}
          className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 p-1"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

function AddMemberForm({
  onAdd,
  onCancel,
}: {
  onAdd: (m: Partial<TeamMember>) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [rate, setRate] = useState("");
  const [ratePer, setRatePer] = useState("day");

  function submit() {
    if (!name.trim()) return;
    onAdd({
      name: name.trim(),
      role: role.trim() || "Crew",
      email: email.trim() || null,
      phone: phone.trim() || null,
      rate: rate === "" ? null : Number(rate),
      ratePer,
      status: "SUGGESTED",
    });
  }

  return (
    <div className="px-5 py-4 bg-amber-50/30 border-b border-gray-50 grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name"
        className="md:col-span-3 px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#D4A853]/30 focus:border-[#D4A853]"
      />
      <input
        type="text"
        value={role}
        onChange={(e) => setRole(e.target.value)}
        placeholder="Role (Director, DP, MUA…)"
        className="md:col-span-2 px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#D4A853]/30 focus:border-[#D4A853]"
      />
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        className="md:col-span-2 px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#D4A853]/30 focus:border-[#D4A853]"
      />
      <input
        type="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="Phone"
        className="md:col-span-2 px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#D4A853]/30 focus:border-[#D4A853]"
      />
      <div className="md:col-span-2 flex items-center gap-1">
        <span className="text-xs text-gray-400">£</span>
        <input
          type="number"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          placeholder="Rate"
          className="flex-1 px-2 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#D4A853]/30 focus:border-[#D4A853]"
        />
        <select
          value={ratePer}
          onChange={(e) => setRatePer(e.target.value)}
          className="text-xs text-gray-500 border border-gray-200 rounded-lg px-1 py-2 bg-white"
        >
          <option value="day">day</option>
          <option value="hour">hour</option>
          <option value="project">project</option>
        </select>
      </div>
      <div className="md:col-span-1 flex items-center gap-1 justify-end">
        <button
          onClick={submit}
          className="bg-[#D4A853] text-white text-xs font-medium px-3 py-2 rounded-xl hover:bg-[#c49843] transition-colors"
        >
          Add
        </button>
        <button
          onClick={onCancel}
          className="text-xs text-gray-400 hover:text-gray-600 px-2 py-2"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  dot,
  icon,
}: {
  label: string;
  value: string;
  dot?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-center gap-1.5 text-gray-400">
        {dot && <span className={`w-2 h-2 rounded-full ${dot}`} />}
        {icon && <span className="text-[#D4A853]">{icon}</span>}
        <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
      </div>
      <p className="text-2xl font-semibold text-gray-900 mt-2">{value}</p>
    </div>
  );
}
