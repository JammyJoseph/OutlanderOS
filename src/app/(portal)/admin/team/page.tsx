"use client";

import { useCallback, useEffect, useState } from "react";
import { Mail, Plus, Pencil, Loader2, ShieldCheck, X, Check, Copy, KeyRound, Search, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { isValidEmail } from "@/lib/validation";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Avatar, Page, PageHead, Tag, pill } from "@/components/os";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-rules";

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

// Returned only on creation — the one-time temporary password to share securely.
interface NewCredentials {
  name: string;
  email: string;
  password: string;
}

const TEAMS = [
  { key: "COMMERCIAL", label: "Commercial" },
  { key: "PRODUCTION", label: "Production" },
  { key: "FINANCE", label: "Finance" },
  { key: "OPERATIONS", label: "Operations" },
  { key: "ADMIN", label: "Admin" },
] as const;

function teamChip(key: string) {
  return TEAMS.find((t) => t.key === key);
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
  const [newCreds, setNewCreds] = useState<NewCredentials | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState<Staff | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showDeactivated, setShowDeactivated] = useState(false);

  const load = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("search", q.trim());
      const res = await fetch(`/api/admin/users?${params.toString()}`);
      const data = await res.json();
      setStaff(Array.isArray(data) ? data : data?.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounce the search box so we don't refetch on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => load(search), 300);
    return () => clearTimeout(t);
  }, [search, load]);

  // Activating is low-risk and applied immediately; deactivating goes through a
  // confirmation dialog first (see the toggle button below).
  async function toggleActive(s: Staff) {
    setStatusError(null);
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
        setStatusError(body.error || "Couldn't update status.");
      }
    } finally {
      setBusyId(null);
    }
  }

  const active = staff.filter((s) => s.isActive);
  const deactivated = staff.filter((s) => !s.isActive);
  const shown = showDeactivated ? [...active, ...deactivated] : active;

  return (
    <Page>
      <PageHead
        eyebrow={`${active.length} active${deactivated.length ? ` · ${deactivated.length} deactivated` : ""}`}
        title="Team"
        aside={
          <button onClick={() => setCreating(true)} className={pill("primary")}>
            <Plus /> Add staff member
          </button>
        }
      />

      <div className="-mt-4 flex flex-col gap-4">
        <p className="flex items-start gap-3 rounded-2xl bg-surface px-5 py-4 text-[15px] text-ink-2">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-foreground" />
          Admins see Finance and Admin. Changing someone&rsquo;s role, setting their password or deactivating them
          signs them out everywhere straight away.
        </p>

        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search staff"
            placeholder="Search by name or email"
            className="h-11 w-full rounded-xl bg-surface pl-11 pr-4 text-[15px] text-foreground outline-none placeholder:text-muted-foreground focus:bg-background focus:shadow-[inset_0_0_0_1px_var(--foreground),0_0_0_3px_var(--focus)]"
          />
        </div>

        {statusError && (
          <p role="alert" className="rounded-2xl bg-bad-bg px-5 py-3.5 text-[15px] text-bad">
            {statusError}
          </p>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="-mx-2 overflow-x-auto">
            <table className="w-full min-w-[820px] text-[15px]">
              <thead>
                <tr className="border-b border-line text-left">
                  {["Person", "Role", "Teams", "Status", "Last login"].map((h) => (
                    <th key={h} className="px-2 pb-3 text-[13px] font-medium text-muted-foreground">
                      {h}
                    </th>
                  ))}
                  <th className="px-2 pb-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="[&>tr]:border-b [&>tr]:border-line">
                {shown.map((s) => (
                  <tr key={s.id} className={cn("transition-colors hover:bg-surface/60", !s.isActive && "text-muted-foreground")}>
                    <td className="px-2 py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar name={s.name} />
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground">{s.name}</p>
                          <p className="flex items-center gap-1 truncate text-sm text-muted-foreground">
                            <Mail className="size-3.5 shrink-0" />
                            <span className="truncate">
                              {s.email}
                              {s.department ? ` · ${s.department}` : ""}
                            </span>
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-3.5">
                      {s.role === "ADMIN" ? (
                        <Tag tone="info">
                          <ShieldCheck className="size-3.5" /> Admin
                        </Tag>
                      ) : (
                        <Tag>Member</Tag>
                      )}
                    </td>
                    <td className="px-2 py-3.5">
                      <div className="flex flex-wrap gap-1">
                        {(s.teams ?? []).length === 0 ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          (s.teams ?? []).map((t) => <Tag key={t}>{teamChip(t)?.label ?? t}</Tag>)
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-3.5">
                      <Tag tone={s.isActive ? "ok" : "neutral"}>{s.isActive ? "Active" : "Deactivated"}</Tag>
                    </td>
                    <td className="px-2 py-3.5 text-ink-2">{lastLoginLabel(s.lastLoginAt)}</td>
                    <td className="px-2 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setEditing(s)}
                          aria-label={`Edit ${s.name}`}
                          title="Edit"
                          className="flex size-10 items-center justify-center rounded-full text-foreground transition-colors hover:bg-surface"
                        >
                          <Pencil className="size-4" />
                        </button>
                        <button
                          onClick={() => (s.isActive ? setConfirmDeactivate(s) : toggleActive(s))}
                          disabled={busyId === s.id}
                          className={pill(s.isActive ? "ghost" : "outline", "sm")}
                        >
                          {busyId === s.id ? (
                            <Loader2 className="animate-spin" />
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
          </div>
        )}

        {!loading && deactivated.length > 0 && (
          <button
            onClick={() => setShowDeactivated((v) => !v)}
            aria-expanded={showDeactivated}
            className="inline-flex min-h-11 w-fit items-center gap-2 font-semibold hover:underline"
          >
            {showDeactivated
              ? "Hide deactivated accounts"
              : `Show ${deactivated.length} deactivated account${deactivated.length === 1 ? "" : "s"}`}
            <ChevronDown className={cn("size-4 transition-transform", showDeactivated && "rotate-180")} />
          </button>
        )}
      </div>

      {(creating || editing) && (
        <StaffModal
          staff={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={(saved, isNew, tempPassword) => {
            setStaff((prev) => (isNew ? [saved, ...prev] : prev.map((u) => (u.id === saved.id ? saved : u))));
            setCreating(false);
            setEditing(null);
            if (isNew && tempPassword) {
              setNewCreds({ name: saved.name, email: saved.email, password: tempPassword });
            }
          }}
        />
      )}

      {newCreds && <CredentialsModal creds={newCreds} onClose={() => setNewCreds(null)} />}

      <ConfirmDialog
        open={!!confirmDeactivate}
        title="Deactivate staff member?"
        message={
          confirmDeactivate
            ? `${confirmDeactivate.name} will lose access to OutlanderOS immediately. You can reactivate them at any time.`
            : ""
        }
        confirmLabel="Deactivate"
        confirmVariant="danger"
        busy={!!confirmDeactivate && busyId === confirmDeactivate.id}
        onConfirm={async () => {
          if (confirmDeactivate) await toggleActive(confirmDeactivate);
          setConfirmDeactivate(null);
        }}
        onCancel={() => setConfirmDeactivate(null)}
      />
    </Page>
  );
}

// ─── New-account credentials modal (shown once) ───────────────────────────────

function CredentialsModal({
  creds,
  onClose,
}: {
  creds: NewCredentials;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copyCredentials() {
    const text = `Email: ${creds.email} / Password: ${creds.password}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — admin can still read the values on screen */
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" className="w-full max-w-md overflow-hidden rounded-[24px] bg-background shadow-2xl">
        <div className="flex items-center justify-between px-6 pt-6">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-full bg-secondary">
              <KeyRound className="size-5" />
            </span>
            <h2 className="text-xl font-semibold">Account created</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="flex size-10 items-center justify-center rounded-full bg-surface hover:bg-surface-2">
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <p className="text-[15px] text-ink-2">
            Temporary password for <span className="font-semibold text-foreground">{creds.name}</span>.
            Share it with the team member securely — they&apos;ll be prompted to change it on first
            login.
          </p>

          <div className="space-y-2 rounded-2xl bg-surface px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">Email</span>
              <span className="truncate font-mono text-sm">{creds.email}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">Password</span>
              <span className="select-all font-mono text-base font-semibold tracking-wider">
                {creds.password}
              </span>
            </div>
          </div>

          <p className="text-sm font-medium text-warn">
            This password won&apos;t be shown again. Copy it now if you need it.
          </p>
        </div>

        <div className="flex justify-end gap-2 px-6 pb-6">
          <button onClick={copyCredentials} className={pill("outline", "sm")}>
            {copied ? <Check /> : <Copy />}
            {copied ? "Copied" : "Copy credentials"}
          </button>
          <button onClick={onClose} className={pill("primary", "sm")}>
            Done
          </button>
        </div>
      </div>
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
  onSaved: (s: Staff, isNew: boolean, tempPassword?: string) => void;
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
    if (!name.trim() || !email.trim()) {
      setError("Name and email are required.");
      return;
    }
    if (!isValidEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    // Password is optional on edit, required (auto-generated) on create. When an
    // admin does set one, enforce a minimum length.
    if (!isNew && password && password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
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
      // New accounts get an auto-generated temporary password from the server.
      // On edit, an admin may optionally set a new password.
      if (!isNew && password) payload.password = password;
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
      const { tempPassword, ...saved } = body as Staff & { tempPassword?: string };
      onSaved(saved as Staff, isNew, tempPassword);
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    "block h-11 w-full rounded-lg border border-field bg-card px-3.5 text-[15px] text-foreground outline-none placeholder:text-muted-foreground focus:border-foreground focus:shadow-[0_0_0_3px_var(--focus)]";
  const labelCls = "mb-1.5 block text-sm text-ink-2";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" className="w-full max-w-md overflow-hidden rounded-[24px] bg-background shadow-2xl">
        <div className="flex items-center justify-between px-6 pt-6">
          <h2 className="text-xl font-semibold">{isNew ? "Add a staff member" : `Edit ${staff?.name}`}</h2>
          <button onClick={onClose} aria-label="Close" className="flex size-10 items-center justify-center rounded-full bg-surface hover:bg-surface-2">
            <X className="size-4" />
          </button>
        </div>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto px-6 py-5">
          <div>
            <label className={labelCls}>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
            />
          </div>
          {isNew ? (
            <div className="flex items-start gap-2.5 rounded-xl bg-secondary px-4 py-3">
              <KeyRound className="mt-0.5 size-4 shrink-0" />
              <p className="text-sm text-ink-2">
                A temporary password will be generated and shown once after creation. They&apos;ll be
                prompted to change it on first login.
              </p>
            </div>
          ) : (
            <div>
              <label className={labelCls}>
                New password (leave blank to keep)
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={inputCls}
              />
            </div>
          )}
          <div>
            <label className={labelCls}>Department</label>
            <input
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="e.g. Sales & Partnerships"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Role</label>
            <div role="radiogroup" aria-label="Role" className="flex gap-1 rounded-full bg-surface p-1">
              {(["MEMBER", "ADMIN"] as const).map((r) => (
                <button
                  key={r}
                  role="radio"
                  aria-checked={role === r}
                  onClick={() => setRole(r)}
                  className={cn(
                    "min-h-10 flex-1 rounded-full text-sm font-semibold transition-colors",
                    role === r ? "bg-background text-foreground shadow-[0_1px_2px_rgba(11,18,32,0.08)]" : "text-ink-2 hover:text-foreground"
                  )}
                >
                  {r === "ADMIN" ? "Admin" : "Member"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={labelCls}>Teams</label>
            <div className="flex flex-wrap gap-2">
              {TEAMS.map((t) => {
                const on = teams.includes(t.key);
                return (
                  <button
                    key={t.key}
                    onClick={() => toggleTeam(t.key)}
                    aria-pressed={on}
                    className={cn(
                      "inline-flex min-h-9 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors",
                      on ? "bg-foreground text-background" : "bg-surface text-ink-2 hover:bg-surface-2 hover:text-foreground"
                    )}
                  >
                    {on && <Check className="h-3 w-3" />}
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <p role="alert" className="rounded-xl bg-bad-bg px-4 py-3 text-[15px] font-medium text-bad">
              {error}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 px-6 pb-6">
          <button onClick={onClose} className={pill("ghost", "sm")}>
            Cancel
          </button>
          <button onClick={save} disabled={saving} className={pill("primary", "sm")}>
            {saving && <Loader2 className="animate-spin" />}
            {isNew ? "Create" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
