"use client";

import { useEffect, useState } from "react";
import { Users, Mail, Plus, Pencil, Loader2, ShieldCheck, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Staff {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "MEMBER";
  department: string | null;
  teams: string[] | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

const TEAMS = [
  { key: "COMMERCIAL", label: "Commercial", chip: "bg-[#ffd700]/15 text-[#9a7322]" },
  { key: "PRODUCTION", label: "Production", chip: "bg-red-100 text-red-700" },
  { key: "FINANCE", label: "Finance", chip: "bg-blue-100 text-blue-700" },
  { key: "OPERATIONS", label: "Operations", chip: "bg-purple-100 text-purple-700" },
  { key: "ADMIN", label: "Admin", chip: "bg-gray-200 text-gray-700" },
] as const;

function teamChip(key: string) {
  return TEAMS.find((t) => t.key === key);
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function lastLoginLabel(iso: string | null): string {
  if (!iso) return "Never";
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function TeamPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Staff | null>(null);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      setStaff(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleActive(s: Staff) {
    setBusyId(s.id);
    try {
      const res = await fetch(`/api/admin/users/${s.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !s.isActive }),
      });
      if (res.ok) {
        const updated = await res.json();
        setStaff((prev) => prev.map((u) => (u.id === s.id ? updated : u)));
      } else {
        const body = await res.json().catch(() => ({}));
        alert(body.error || "Couldn't update status.");
      }
    } finally {
      setBusyId(null);
    }
  }

  const activeCount = staff.filter((s) => s.isActive).length;

  return (
    <div className="space-y-6 px-1">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Staff</h1>
          <p className="text-sm text-gray-500">
            {staff.length} member{staff.length !== 1 ? "s" : ""} · {activeCount} active
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 rounded-lg bg-[#ffd700] px-3 py-1.5 text-xs font-medium text-black transition-colors hover:bg-[#e6c200]"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Staff
        </button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/60 text-left">
                <th className="px-4 py-3 font-medium text-gray-500">Name</th>
                <th className="px-4 py-3 font-medium text-gray-500">Role</th>
                <th className="px-4 py-3 font-medium text-gray-500">Teams</th>
                <th className="px-4 py-3 font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 font-medium text-gray-500">Last login</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {staff.map((s) => (
                <tr
                  key={s.id}
                  className={cn("transition-colors hover:bg-gray-50/60", !s.isActive && "opacity-60")}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-800 text-xs font-bold text-white">
                        {initials(s.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900">{s.name}</p>
                        <p className="flex items-center gap-1 text-xs text-gray-400">
                          <Mail className="h-3 w-3" />
                          <span className="truncate">{s.email}</span>
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        s.role === "ADMIN"
                          ? "bg-gray-900 text-white"
                          : "bg-gray-100 text-gray-600"
                      )}
                    >
                      {s.role === "ADMIN" && <ShieldCheck className="h-3 w-3" />}
                      {s.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(s.teams ?? []).length === 0 ? (
                        <span className="text-xs text-gray-300">—</span>
                      ) : (
                        (s.teams ?? []).map((t) => {
                          const c = teamChip(t);
                          return (
                            <span
                              key={t}
                              className={cn(
                                "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                                c?.chip ?? "bg-gray-100 text-gray-600"
                              )}
                            >
                              {c?.label ?? t}
                            </span>
                          );
                        })
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        s.isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-200 text-gray-500"
                      )}
                    >
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          s.isActive ? "bg-emerald-500" : "bg-gray-400"
                        )}
                      />
                      {s.isActive ? "Active" : "Deactivated"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{lastLoginLabel(s.lastLoginAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => setEditing(s)}
                        title="Edit"
                        className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => toggleActive(s)}
                        disabled={busyId === s.id}
                        className={cn(
                          "rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50",
                          s.isActive
                            ? "border-gray-200 text-gray-500 hover:bg-gray-50"
                            : "border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                        )}
                      >
                        {busyId === s.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : s.isActive ? (
                          "Deactivate"
                        ) : (
                          "Activate"
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {(creating || editing) && (
        <StaffModal
          staff={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={(saved, isNew) => {
            setStaff((prev) => (isNew ? [saved, ...prev] : prev.map((u) => (u.id === saved.id ? saved : u))));
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

// ─── Add / Edit modal ─────────────────────────────────────────────────────────

function StaffModal({
  staff,
  onClose,
  onSaved,
}: {
  staff: Staff | null;
  onClose: () => void;
  onSaved: (s: Staff, isNew: boolean) => void;
}) {
  const isNew = !staff;
  const [name, setName] = useState(staff?.name ?? "");
  const [email, setEmail] = useState(staff?.email ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"ADMIN" | "MEMBER">(staff?.role ?? "MEMBER");
  const [department, setDepartment] = useState(staff?.department ?? "");
  const [teams, setTeams] = useState<string[]>(staff?.teams ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleTeam(key: string) {
    setTeams((prev) => (prev.includes(key) ? prev.filter((t) => t !== key) : [...prev, key]));
  }

  async function save() {
    setError(null);
    if (!name.trim() || !email.trim() || (isNew && !password)) {
      setError("Name, email" + (isNew ? " and password are" : " are") + " required.");
      return;
    }
    setSaving(true);
    try {
      const url = isNew ? "/api/admin/users" : `/api/admin/users/${staff!.id}`;
      const method = isNew ? "POST" : "PATCH";
      const payload: Record<string, unknown> = {
        name: name.trim(),
        email: email.trim(),
        role,
        teams,
        department: department.trim() || null,
      };
      if (password) payload.password = password;
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || "Couldn't save.");
        return;
      }
      onSaved(body as Staff, isNew);
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#ffd700] focus:outline-none focus:ring-2 focus:ring-[#ffd700]/30";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-900">
            {isNew ? "Add Staff" : `Edit ${staff?.name}`}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              {isNew ? "Password" : "New password (leave blank to keep)"}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isNew ? "" : "••••••••"}
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Department</label>
            <input
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="e.g. Sales & Partnerships"
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Role</label>
            <div className="flex gap-2">
              {(["MEMBER", "ADMIN"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  className={cn(
                    "flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                    role === r
                      ? "border-gray-900 bg-gray-900 text-white"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Teams</label>
            <div className="flex flex-wrap gap-2">
              {TEAMS.map((t) => {
                const on = teams.includes(t.key);
                return (
                  <button
                    key={t.key}
                    onClick={() => toggleTeam(t.key)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                      on
                        ? "border-[#ffd700] bg-[#ffd700]/15 text-gray-800"
                        : "border-gray-200 text-gray-500 hover:bg-gray-50"
                    )}
                  >
                    {on && <Check className="h-3 w-3" />}
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {error && <p className="text-xs font-medium text-red-500">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-[#ffd700] px-4 py-2 text-sm font-medium text-black hover:bg-[#e6c200] disabled:opacity-50"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {isNew ? "Create" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
