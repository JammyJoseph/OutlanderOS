"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Mail, Phone, Users, Contact, Search, X, Star } from "lucide-react";
import { TeamMember, TeamStatus, gbp } from "./types";

interface DirectoryContact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  role: string | null;
  category: string;
  instagram: string | null;
  rating: number | null;
}

const PICKER_CATEGORIES = [
  "Photographer",
  "Videographer",
  "Stylist",
  "MUA",
  "Creative Director",
  "Model",
  "Talent",
  "Producer",
  "Set Designer",
  "Editor",
  "Colorist",
  "Casting Director",
];

interface Props {
  productionId: string;
  members: TeamMember[];
  refresh: () => void;
}

const STATUS_CYCLE: TeamStatus[] = ["SUGGESTED", "CONFIRMED", "CONTRACTED"];

const STATUS_STYLES: Record<TeamStatus, { bg: string; text: string; border: string; label: string }> = {
  SUGGESTED: {
    bg: "bg-white dark:bg-gray-900",
    text: "text-gray-500 dark:text-gray-400",
    border: "border-gray-200 dark:border-gray-700",
    label: "Suggested",
  },
  CONFIRMED: {
    bg: "bg-amber-50 dark:bg-amber-900/30",
    text: "text-amber-700 dark:text-amber-300",
    border: "border-amber-200 dark:border-amber-800",
    label: "Confirmed",
  },
  CONTRACTED: {
    bg: "bg-emerald-50 dark:bg-emerald-900/30",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-200 dark:border-emerald-800",
    label: "Contracted",
  },
};

export default function TeamTab({ productionId, members, refresh }: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

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

  async function addFromDirectory(c: DirectoryContact) {
    await fetch(`/api/productions/${productionId}/team`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: c.name,
        role: c.role || c.category || "Crew",
        email: c.email,
        phone: c.phone,
        status: "SUGGESTED",
      }),
    });
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
        <Stat label="Suggested" value={String(counts.suggested)} dot="bg-gray-300 dark:bg-gray-600" />
        <Stat label="Confirmed" value={String(counts.confirmed)} dot="bg-[#ffd700]" />
        <Stat label="Contracted" value={String(counts.contracted)} dot="bg-emerald-500" />
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 dark:border-gray-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Team & Talent</h2>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Total crew cost:{" "}
              <span className="font-semibold text-gray-800 dark:text-gray-200">{gbp(totalCost)}</span>
            </span>
            <button
              onClick={() => setShowPicker(true)}
              className="flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              title="Pick crew & talent from Outlander's directory"
            >
              <Contact size={13} /> Browse Directory
            </button>
            <button
              onClick={() => setShowAdd((v) => !v)}
              className="flex items-center gap-1 text-xs font-medium text-[#ffd700] hover:text-[#e6c200]"
            >
              <Plus size={13} /> Add member
            </button>
          </div>
        </div>

        {showAdd && <AddMemberForm onAdd={add} onCancel={() => setShowAdd(false)} />}

        {members.length === 0 && !showAdd ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">No team members yet.</p>
            <button
              onClick={() => setShowAdd(true)}
              className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[#ffd700] hover:text-[#e6c200]"
            >
              <Plus size={12} /> Add your first member
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-gray-800">
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

      {showPicker && (
        <DirectoryPicker
          existing={members}
          onPick={addFromDirectory}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}

function DirectoryPicker({
  existing,
  onPick,
  onClose,
}: {
  existing: TeamMember[];
  onPick: (c: DirectoryContact) => void;
  onClose: () => void;
}) {
  const [contacts, setContacts] = useState<DirectoryContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [added, setAdded] = useState<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    setLoading(true);
    const params = new URLSearchParams({ radar: "false" });
    if (search.trim()) params.set("search", search.trim());
    if (category) params.set("category", category);
    const t = setTimeout(() => {
      fetch(`/api/contacts?${params.toString()}`)
        .then((r) => r.json())
        .then((data) => {
          if (active) setContacts(Array.isArray(data) ? data : []);
        })
        .finally(() => active && setLoading(false));
    }, 200);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [search, category]);

  const existingNames = useMemo(
    () => new Set(existing.map((m) => m.name.trim().toLowerCase())),
    [existing]
  );

  function pick(c: DirectoryContact) {
    onPick(c);
    setAdded((prev) => new Set(prev).add(c.id));
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 py-10 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Browse Directory</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Add crew &amp; talent from Outlander&apos;s contacts.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-gray-50 dark:border-gray-800 px-5 py-3">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search contacts…"
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 py-2 pl-8 pr-3 text-sm focus:border-[#ffd700] focus:outline-none focus:ring-2 focus:ring-[#ffd700]/30"
            />
          </div>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 focus:border-[#ffd700] focus:outline-none focus:ring-2 focus:ring-[#ffd700]/30"
          >
            <option value="">All categories</option>
            {PICKER_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="max-h-[55vh] overflow-y-auto">
          {loading ? (
            <p className="px-5 py-12 text-center text-sm text-gray-400 dark:text-gray-500">Loading…</p>
          ) : contacts.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-gray-400 dark:text-gray-500">No contacts found.</p>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-gray-800">
              {contacts.map((c) => {
                const isAdded = added.has(c.id);
                const alreadyOnTeam = existingNames.has(c.name.trim().toLowerCase());
                return (
                  <div key={c.id} className="flex items-center gap-3 px-5 py-3 hover:bg-amber-50/30 dark:hover:bg-amber-900/30">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                      {c.name.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{c.name}</p>
                        {c.rating ? (
                          <span className="inline-flex items-center gap-0.5 text-[11px] text-[#e6c200]">
                            <Star size={11} className="fill-[#ffd700] text-[#ffd700]" /> {c.rating}
                          </span>
                        ) : null}
                      </div>
                      <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                        {[c.role || c.category, c.company].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <button
                      onClick={() => pick(c)}
                      disabled={isAdded}
                      className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                        isAdded
                          ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
                          : "bg-[#ffd700] text-black hover:bg-[#e6c200]"
                      }`}
                      title={alreadyOnTeam ? "Already has a member with this name" : "Add to team"}
                    >
                      {isAdded ? "Added ✓" : alreadyOnTeam ? "Add again" : "Add"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-gray-100 dark:border-gray-800 px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
          >
            Done
          </button>
        </div>
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
    <div className="grid grid-cols-12 gap-3 px-5 py-3 items-center hover:bg-amber-50/20 dark:hover:bg-amber-900/20 group">
      <div className="col-span-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            if (name !== member.name) onUpdate({ name });
          }}
          className="text-sm font-medium text-gray-900 dark:text-gray-100 bg-transparent border-none outline-none w-full px-1 py-0.5 rounded-md focus:bg-white dark:focus:bg-gray-800"
        />
        <input
          type="text"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          onBlur={() => {
            if (role !== member.role) onUpdate({ role });
          }}
          className="text-xs text-gray-500 dark:text-gray-400 bg-transparent border-none outline-none w-full px-1 py-0.5 mt-0.5 rounded-md focus:bg-white dark:focus:bg-gray-800"
        />
      </div>
      <div className="col-span-3 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 min-w-0">
        {member.email && (
          <a
            href={`mailto:${member.email}`}
            className="inline-flex items-center gap-1 hover:text-[#ffd700] truncate"
          >
            <Mail size={11} className="shrink-0" />
            <span className="truncate">{member.email}</span>
          </a>
        )}
        {member.phone && (
          <a
            href={`tel:${member.phone}`}
            className="inline-flex items-center gap-1 hover:text-[#ffd700] truncate"
          >
            <Phone size={11} className="shrink-0" />
            <span className="truncate">{member.phone}</span>
          </a>
        )}
      </div>
      <div className="col-span-3 flex items-center gap-1.5">
        <span className="text-xs text-gray-400 dark:text-gray-500">£</span>
        <input
          type="number"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          onBlur={() => {
            const next = rate === "" ? null : Number(rate);
            if (next !== member.rate) onUpdate({ rate: next });
          }}
          placeholder="0"
          className="w-20 text-sm bg-transparent border-none outline-none px-1 py-0.5 rounded-md focus:bg-white dark:focus:bg-gray-800 tabular-nums"
        />
        <span className="text-xs text-gray-400 dark:text-gray-500">/</span>
        <select
          value={ratePer}
          onChange={(e) => {
            setRatePer(e.target.value);
            onUpdate({ ratePer: e.target.value });
          }}
          className="text-xs text-gray-500 dark:text-gray-400 bg-transparent border-none outline-none focus:bg-white dark:focus:bg-gray-800 rounded-md py-0.5"
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
          className="opacity-0 group-hover:opacity-100 text-gray-300 dark:text-gray-600 hover:text-red-500 p-1"
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
        className="md:col-span-3 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ffd700]/30 focus:border-[#ffd700]"
      />
      <input
        type="text"
        value={role}
        onChange={(e) => setRole(e.target.value)}
        placeholder="Role (Director, DP, MUA…)"
        className="md:col-span-2 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ffd700]/30 focus:border-[#ffd700]"
      />
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        className="md:col-span-2 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ffd700]/30 focus:border-[#ffd700]"
      />
      <input
        type="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="Phone"
        className="md:col-span-2 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ffd700]/30 focus:border-[#ffd700]"
      />
      <div className="md:col-span-2 flex items-center gap-1">
        <span className="text-xs text-gray-400 dark:text-gray-500">£</span>
        <input
          type="number"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          placeholder="Rate"
          className="flex-1 px-2 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ffd700]/30 focus:border-[#ffd700]"
        />
        <select
          value={ratePer}
          onChange={(e) => setRatePer(e.target.value)}
          className="text-xs text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg px-1 py-2 bg-white dark:bg-gray-900"
        >
          <option value="day">day</option>
          <option value="hour">hour</option>
          <option value="project">project</option>
        </select>
      </div>
      <div className="md:col-span-1 flex items-center gap-1 justify-end">
        <button
          onClick={submit}
          className="bg-[#ffd700] text-black text-xs font-medium px-3 py-2 rounded-xl hover:bg-[#e6c200] transition-colors"
        >
          Add
        </button>
        <button
          onClick={onCancel}
          className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 px-2 py-2"
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
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-4">
      <div className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500">
        {dot && <span className={`w-2 h-2 rounded-full ${dot}`} />}
        {icon && <span className="text-[#ffd700]">{icon}</span>}
        <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
      </div>
      <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mt-2">{value}</p>
    </div>
  );
}
