"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Plus, Trash2, Mail, Phone, Users, Contact, Search, X, Star, UserPlus, Building2,
  UtensilsCrossed, ClipboardCopy, Check, Loader2, ChefHat,
} from "lucide-react";
import { TeamMember, TeamStatus, gbp, ProductionFull, CateringQuote } from "./types";
import { isValidEmail } from "@/lib/validation";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

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

interface StaffUser {
  id: string;
  name: string;
  email: string | null;
  role: string;
  department: string | null;
  isActive?: boolean;
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

// Pre-assigned production roles for internal staff (Phase 3B). Matched on first
// name (lower-cased); falls back to the person's department, then "Crew".
const STAFF_ROLE_MAP: Record<string, string> = {
  joe: "Producer",
  quinn: "Finance",
  olive: "Production Manager",
  silver: "Creative Director",
};

function staffProductionRole(u: StaffUser): string {
  const first = (u.name || "").trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  return STAFF_ROLE_MAP[first] || u.department || "Crew";
}

interface Props {
  production: ProductionFull;
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

export default function TeamTab({ production, productionId, members, refresh }: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);
  // Pending "add to directory?" prompt for a manually-added member (Phase 3A).
  const [pendingDir, setPendingDir] = useState<Partial<TeamMember> | null>(null);

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
    refresh();
  }

  // Manual add flow (Phase 3A): look the person up in the Directory. If they're
  // already a contact, add them straight to the team (enriching email/phone and
  // linking the contactId). If not, offer to quick-add them to the Directory.
  async function submitManual(form: Partial<TeamMember>) {
    setShowAdd(false);
    try {
      const params = new URLSearchParams({ search: (form.name || "").trim(), radar: "false" });
      const res = await fetch(`/api/contacts?${params.toString()}`);
      const data = await res.json();
      const list: DirectoryContact[] = Array.isArray(data) ? data : data?.data ?? [];
      const match = list.find(
        (c) => c.name.trim().toLowerCase() === (form.name || "").trim().toLowerCase()
      );
      if (match) {
        await add({
          ...form,
          email: form.email || match.email,
          phone: form.phone || match.phone,
          contactId: match.id,
        });
        return;
      }
    } catch {
      // If the lookup fails, fall through to the directory prompt.
    }
    // Not in the directory — ask whether to add them.
    setPendingDir(form);
  }

  async function addFromDirectory(c: DirectoryContact) {
    await add({
      name: c.name,
      role: c.role || c.category || "Crew",
      email: c.email,
      phone: c.phone,
      status: "SUGGESTED",
      contactId: c.id,
    });
  }

  // Quick-add the manual member to the Directory, then to the team (Phase 3A).
  async function confirmDirectoryAdd(
    form: Partial<TeamMember>,
    extra: { instagram: string; category: string }
  ) {
    let contactId: string | null = null;
    try {
      const res = await fetch(`/api/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email || undefined,
          phone: form.phone || undefined,
          role: form.role || undefined,
          category: extra.category || "Crew",
          instagram: extra.instagram || undefined,
        }),
      });
      if (res.ok) {
        const contact = await res.json();
        contactId = contact?.id ?? null;
      }
    } catch {
      // Directory save failed — still add to the team below.
    }
    await add({ ...form, contactId });
    setPendingDir(null);
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
        <Stat label="Confirmed" value={String(counts.confirmed)} dot="bg-[#9C7C2E]" />
        <Stat label="Contracted" value={String(counts.contracted)} dot="bg-emerald-500" />
      </div>

      {/* Phase 3B — Outlander team quick-fill */}
      <OutlanderTeamSection members={members} onAdd={add} />

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 dark:border-gray-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Team &amp; Talent</h2>
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
              className="flex items-center gap-1 text-xs font-medium text-[#9C7C2E] hover:text-[#9C7C2E]"
            >
              <Plus size={13} /> Add member
            </button>
          </div>
        </div>

        {showAdd && <AddMemberForm members={members} onAdd={submitManual} onCancel={() => setShowAdd(false)} />}

        {members.length === 0 && !showAdd ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">No team members yet.</p>
            <button
              onClick={() => setShowAdd(true)}
              className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[#9C7C2E] hover:text-[#9C7C2E]"
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
                onRemove={() => setRemoveId(m.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Phase 3C / 3D — Catering: dietary checklist, brief, caterer quotes */}
      <CateringPanel production={production} productionId={productionId} members={members} refresh={refresh} />

      {showPicker && (
        <DirectoryPicker
          existing={members}
          onPick={addFromDirectory}
          onClose={() => setShowPicker(false)}
        />
      )}

      {/* Phase 3A — add-to-directory prompt */}
      {pendingDir && (
        <DirectoryAddPrompt
          form={pendingDir}
          onConfirm={confirmDirectoryAdd}
          onSkip={async () => {
            await add(pendingDir);
            setPendingDir(null);
          }}
          onCancel={() => setPendingDir(null)}
        />
      )}

      <ConfirmDialog
        open={!!removeId}
        title="Remove team member?"
        message="They'll be removed from this production's team. This cannot be undone."
        confirmLabel="Remove"
        confirmVariant="danger"
        onConfirm={async () => {
          if (removeId) await remove(removeId);
          setRemoveId(null);
        }}
        onCancel={() => setRemoveId(null)}
      />
    </div>
  );
}

// ── Phase 3B: Outlander team quick-fill ──────────────────────────────────────
function OutlanderTeamSection({
  members,
  onAdd,
}: {
  members: TeamMember[];
  onAdd: (m: Partial<TeamMember>) => Promise<void>;
}) {
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((d: StaffUser[]) => {
        const list = Array.isArray(d) ? d.filter((u) => u.isActive !== false) : [];
        setStaff(list);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const onTeam = useMemo(
    () => new Set(members.map((m) => (m.email || m.name).trim().toLowerCase())),
    [members]
  );

  function isAdded(u: StaffUser): boolean {
    return onTeam.has((u.email || u.name).trim().toLowerCase());
  }

  async function addStaff(u: StaffUser) {
    setBusyId(u.id);
    try {
      await onAdd({
        name: u.name,
        role: staffProductionRole(u),
        email: u.email,
        status: "CONFIRMED",
      });
    } finally {
      setBusyId(null);
    }
  }

  if (loading || staff.length === 0) return null;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="w-full px-5 py-4 border-b border-gray-50 dark:border-gray-800 flex items-center justify-between text-left"
      >
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
          <Building2 size={15} className="text-[#9C7C2E]" /> Outlander Team
          <span className="text-[11px] font-normal text-gray-400">one-click add internal staff</span>
        </h2>
        <span className="text-xs text-gray-400">{collapsed ? "Show" : "Hide"}</span>
      </button>
      {!collapsed && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 p-4">
          {staff.map((u) => {
            const added = isAdded(u);
            return (
              <div
                key={u.id}
                className="flex items-center gap-3 rounded-xl border border-gray-100 dark:border-gray-800 px-3 py-2.5"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                  {u.name.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{u.name}</p>
                  <p className="truncate text-[11px] text-gray-400">{staffProductionRole(u)}</p>
                </div>
                <button
                  onClick={() => addStaff(u)}
                  disabled={added || busyId === u.id}
                  className={`shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    added
                      ? "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-default"
                      : "bg-[#9C7C2E] text-black hover:opacity-90"
                  }`}
                >
                  {busyId === u.id ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : added ? (
                    "Added"
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <UserPlus size={12} /> Add
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Phase 3A: add-to-directory prompt ────────────────────────────────────────
function DirectoryAddPrompt({
  form,
  onConfirm,
  onSkip,
  onCancel,
}: {
  form: Partial<TeamMember>;
  onConfirm: (form: Partial<TeamMember>, extra: { instagram: string; category: string }) => Promise<void>;
  onSkip: () => Promise<void>;
  onCancel: () => void;
}) {
  const [instagram, setInstagram] = useState("");
  const [category, setCategory] = useState(form.role || "Crew");
  const [email, setEmail] = useState(form.email || "");
  const [phone, setPhone] = useState(form.phone || "");
  const [busy, setBusy] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Contact size={15} className="text-[#9C7C2E]" /> Add to Directory?
          </h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            <span className="font-semibold text-gray-900 dark:text-gray-100">{form.name}</span> isn&apos;t
            in the directory. Add them now so they&apos;re available for future productions?
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Email">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className={promptInputCls}
              />
            </Field>
            <Field label="Phone">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone"
                className={promptInputCls}
              />
            </Field>
            <Field label="Instagram">
              <input
                type="text"
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                placeholder="@handle"
                className={promptInputCls}
              />
            </Field>
            <Field label="Category">
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Photographer"
                className={promptInputCls}
              />
            </Field>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-gray-100 dark:border-gray-800 px-5 py-3">
          <button
            onClick={onSkip}
            disabled={busy}
            className="rounded-xl border border-gray-200 dark:border-gray-700 px-3.5 py-2 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
          >
            Just add to team
          </button>
          <button
            onClick={async () => {
              setBusy(true);
              await onConfirm({ ...form, email: email || null, phone: phone || null }, { instagram, category });
            }}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#9C7C2E] px-3.5 py-2 text-xs font-medium text-black hover:opacity-90 disabled:opacity-50"
          >
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
            Add to directory &amp; team
          </button>
        </div>
      </div>
    </div>
  );
}

const promptInputCls =
  "w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2.5 py-1.5 text-sm focus:outline-none focus:border-[#9C7C2E] focus:ring-1 focus:ring-[#9C7C2E]/30";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wide text-gray-400">{label}</span>
      {children}
    </label>
  );
}

// ── Phase 3C / 3D: Catering ──────────────────────────────────────────────────
function normalizeDiet(req: string | null | undefined): string {
  const t = (req || "").trim();
  if (!t) return "";
  const low = t.toLowerCase();
  if (["none", "no restrictions", "no restriction", "n/a", "na"].includes(low)) return "No restrictions";
  // Title-case the requirement so "vegetarian" and "Vegetarian" group together.
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function CateringPanel({
  production,
  productionId,
  members,
  refresh,
}: {
  production: ProductionFull;
  productionId: string;
  members: TeamMember[];
  refresh: () => void;
}) {
  const quotes = production.cateringQuotes ?? [];
  const [copied, setCopied] = useState(false);
  const [loadingCaterers, setLoadingCaterers] = useState(false);
  const [savingQuotes, setSavingQuotes] = useState(false);

  const submitted = members.filter((m) => (m.dietaryRequirements || "").trim());
  const missing = members.filter((m) => !(m.dietaryRequirements || "").trim());

  // Headcount by dietary type (Phase 3C brief).
  const breakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of members) {
      const d = normalizeDiet(m.dietaryRequirements);
      if (!d) continue;
      map.set(d, (map.get(d) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [members]);

  const shootDates = (production.shootDates ?? [])
    .map((d) => d.split("T")[0])
    .filter(Boolean)
    .join(", ");

  const brief = useMemo(() => {
    const lines: string[] = [];
    lines.push(`CATERING BRIEF — ${production.title}`);
    if (production.clientName) lines.push(`Client: ${production.clientName}`);
    lines.push(`Shoot date(s): ${shootDates || "TBC"}`);
    lines.push(`Headcount: ${members.length}`);
    lines.push("");
    lines.push("Dietary breakdown:");
    if (breakdown.length === 0) {
      lines.push("  • No dietary requirements submitted yet");
    } else {
      for (const [type, n] of breakdown) lines.push(`  • ${type}: ${n}`);
    }
    if (missing.length > 0) lines.push(`  • Not yet submitted: ${missing.length}`);
    lines.push("");
    lines.push("Meal times & locations: per call sheet (to confirm).");
    return lines.join("\n");
  }, [production.title, production.clientName, shootDates, members.length, breakdown, missing.length]);

  function copyBrief() {
    navigator.clipboard.writeText(brief);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function persistQuotes(next: CateringQuote[]) {
    setSavingQuotes(true);
    try {
      await fetch(`/api/productions/${productionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cateringQuotes: next }),
      });
      refresh();
    } finally {
      setSavingQuotes(false);
    }
  }

  // Pull Catering-category contacts and add any not already tracked (Phase 3D).
  async function requestQuotes() {
    setLoadingCaterers(true);
    try {
      const res = await fetch(`/api/contacts?category=Catering&radar=false`);
      const data = await res.json();
      const contacts: DirectoryContact[] = Array.isArray(data) ? data : data?.data ?? [];
      const existing = new Set(quotes.map((q) => q.contactId ?? q.name));
      const additions: CateringQuote[] = contacts
        .filter((c) => !existing.has(c.id) && !existing.has(c.name))
        .map((c) => ({
          contactId: c.id,
          name: c.name,
          email: c.email,
          phone: c.phone,
          status: "contacted",
          notes: null,
          quoteAmount: null,
          contactedAt: new Date().toISOString(),
        }));
      if (additions.length) await persistQuotes([...quotes, ...additions]);
    } finally {
      setLoadingCaterers(false);
    }
  }

  function updateQuote(idx: number, patch: Partial<CateringQuote>) {
    persistQuotes(quotes.map((q, i) => (i === idx ? { ...q, ...patch } : q)));
  }

  function removeQuote(idx: number) {
    persistQuotes(quotes.filter((_, i) => i !== idx));
  }

  const QUOTE_STATUSES: CateringQuote["status"][] = ["contacted", "quoted", "confirmed", "declined"];
  const quoteStyle: Record<CateringQuote["status"], string> = {
    contacted: "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
    quoted: "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
    confirmed: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300",
    declined: "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400",
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50 dark:border-gray-800 flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
          <UtensilsCrossed size={15} className="text-[#9C7C2E]" /> Catering
        </h2>
        <span
          className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
            missing.length === 0 && members.length > 0
              ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
              : "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
          }`}
        >
          {submitted.length}/{members.length} dietary submitted
        </span>
      </div>

      <div className="p-5 space-y-4">
        {/* Dietary checklist */}
        {members.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
              Dietary checklist
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {members.map((m) => {
                const has = !!(m.dietaryRequirements || "").trim();
                return (
                  <div
                    key={m.id}
                    className="flex items-center gap-2 rounded-lg border border-gray-100 dark:border-gray-800 px-2.5 py-1.5 text-xs"
                  >
                    {has ? (
                      <Check size={13} className="text-emerald-500 shrink-0" />
                    ) : (
                      <span className="w-3 h-3 rounded-full border border-amber-400 shrink-0" />
                    )}
                    <span className="font-medium text-gray-700 dark:text-gray-300 truncate">{m.name}</span>
                    <span className="text-gray-400 truncate ml-auto">
                      {has ? normalizeDiet(m.dietaryRequirements) : "Awaiting"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Catering brief */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Catering brief</p>
            <button
              onClick={copyBrief}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#9C7C2E] hover:opacity-80"
            >
              {copied ? <Check size={13} /> : <ClipboardCopy size={13} />}
              {copied ? "Copied" : "Copy brief"}
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
            <MiniStat label="Headcount" value={String(members.length)} />
            {breakdown.slice(0, 3).map(([type, n]) => (
              <MiniStat key={type} label={type} value={String(n)} />
            ))}
          </div>
          <pre className="rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800 p-3 text-[11px] leading-relaxed text-gray-600 dark:text-gray-300 whitespace-pre-wrap font-mono">
            {brief}
          </pre>
        </div>

        {/* Caterer quotes (Phase 3D) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Caterer quotes</p>
            <button
              onClick={requestQuotes}
              disabled={loadingCaterers || savingQuotes}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#9C7C2E] hover:opacity-80 disabled:opacity-50"
              title="Pull caterers from the Directory and start tracking their quotes"
            >
              {loadingCaterers ? <Loader2 size={13} className="animate-spin" /> : <ChefHat size={13} />}
              Request catering quotes
            </button>
          </div>
          {quotes.length === 0 ? (
            <p className="text-xs text-gray-400 py-2">
              No caterers contacted yet. &ldquo;Request catering quotes&rdquo; pulls contacts tagged{" "}
              <span className="font-medium">Catering</span> from the directory.
            </p>
          ) : (
            <div className="space-y-1.5">
              {quotes.map((q, i) => (
                <div
                  key={q.contactId ?? i}
                  className="flex items-center gap-2 rounded-lg border border-gray-100 dark:border-gray-800 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{q.name}</p>
                    <p className="text-[11px] text-gray-400 truncate">
                      {[q.email, q.phone].filter(Boolean).join(" · ") || "No contact details"}
                    </p>
                  </div>
                  <input
                    type="number"
                    value={q.quoteAmount ?? ""}
                    onChange={(e) =>
                      updateQuote(i, { quoteAmount: e.target.value === "" ? null : Number(e.target.value) })
                    }
                    placeholder="£ quote"
                    className="w-20 text-xs text-right rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 focus:outline-none focus:border-[#9C7C2E]"
                  />
                  <select
                    value={q.status}
                    onChange={(e) => updateQuote(i, { status: e.target.value as CateringQuote["status"] })}
                    className={`text-[11px] font-semibold rounded-full px-2.5 py-1 cursor-pointer focus:outline-none ${quoteStyle[q.status]}`}
                  >
                    {QUOTE_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => removeQuote(i)}
                    className="text-gray-300 hover:text-red-500 p-1"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800 px-2.5 py-1.5 text-center">
      <p className="text-[9px] font-bold uppercase tracking-wide text-gray-400 truncate">{label}</p>
      <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{value}</p>
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
          if (active) setContacts(Array.isArray(data) ? data : data?.data ?? []);
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
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 py-2 pl-8 pr-3 text-sm focus:border-[#9C7C2E] focus:outline-none focus:ring-2 focus:ring-[#9C7C2E]/30"
            />
          </div>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 focus:border-[#9C7C2E] focus:outline-none focus:ring-2 focus:ring-[#9C7C2E]/30"
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
                          <span className="inline-flex items-center gap-0.5 text-[11px] text-[#9C7C2E]">
                            <Star size={11} className="fill-[#9C7C2E] text-[#9C7C2E]" /> {c.rating}
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
                          : "bg-[#9C7C2E] text-black hover:bg-[#9C7C2E]"
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
  const [diet, setDiet] = useState(member.dietaryRequirements || "");
  const style = STATUS_STYLES[member.status] || STATUS_STYLES.SUGGESTED;

  return (
    <div className="px-5 py-3 hover:bg-amber-50/20 dark:hover:bg-amber-900/20 group">
      <div className="grid grid-cols-12 gap-3 items-center">
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
              className="inline-flex items-center gap-1 hover:text-[#9C7C2E] truncate"
            >
              <Mail size={11} className="shrink-0" />
              <span className="truncate">{member.email}</span>
            </a>
          )}
          {member.phone && (
            <a
              href={`tel:${member.phone}`}
              className="inline-flex items-center gap-1 hover:text-[#9C7C2E] truncate"
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
      {/* Dietary requirement (Phase 3C) */}
      <div className="mt-1.5 flex items-center gap-2 pl-1">
        <UtensilsCrossed size={12} className="text-gray-300 dark:text-gray-600 shrink-0" />
        <input
          type="text"
          value={diet}
          onChange={(e) => setDiet(e.target.value)}
          onBlur={() => {
            if (diet !== (member.dietaryRequirements || "")) onUpdate({ dietaryRequirements: diet });
          }}
          placeholder="Dietary requirement — e.g. No restrictions, Vegetarian, Halal, Gluten-free"
          className="flex-1 text-xs text-gray-500 dark:text-gray-400 bg-transparent border-none outline-none px-1 py-0.5 rounded-md focus:bg-white dark:focus:bg-gray-800 placeholder-gray-300 dark:placeholder-gray-600"
        />
      </div>
    </div>
  );
}

function AddMemberForm({
  members,
  onAdd,
  onCancel,
}: {
  members: TeamMember[];
  onAdd: (m: Partial<TeamMember>) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [rate, setRate] = useState("");
  const [ratePer, setRatePer] = useState("day");
  const [error, setError] = useState<string | null>(null);

  const rateNeg = rate.trim() !== "" && Number(rate) < 0;
  const emailInvalid = email.trim() !== "" && !isValidEmail(email);

  function submit() {
    setError(null);
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    if (members.some((m) => m.name.trim().toLowerCase() === name.trim().toLowerCase())) {
      setError("A team member with this name is already on the crew.");
      return;
    }
    if (emailInvalid) {
      setError("Please enter a valid email address, or leave it blank.");
      return;
    }
    if (rateNeg) {
      setError("Rate can't be negative.");
      return;
    }
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
    <div className="px-5 py-4 bg-amber-50/30 dark:bg-amber-900/20 border-b border-gray-50 dark:border-gray-800">
    <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name"
        className="md:col-span-3 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-[#9C7C2E]/30 focus:border-[#9C7C2E]"
      />
      <input
        type="text"
        value={role}
        onChange={(e) => setRole(e.target.value)}
        placeholder="Role (Director, DP, MUA…)"
        className="md:col-span-2 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-[#9C7C2E]/30 focus:border-[#9C7C2E]"
      />
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        className={`md:col-span-2 px-3 py-2 rounded-xl border text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 ${
          emailInvalid
            ? "border-red-400 focus:ring-red-200 focus:border-red-400"
            : "border-gray-200 dark:border-gray-700 focus:ring-[#9C7C2E]/30 focus:border-[#9C7C2E]"
        }`}
      />
      <input
        type="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="Phone"
        className="md:col-span-2 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-[#9C7C2E]/30 focus:border-[#9C7C2E]"
      />
      <div className="md:col-span-2 flex items-center gap-1">
        <span className="text-xs text-gray-400 dark:text-gray-500">£</span>
        <input
          type="number"
          min="0"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          placeholder="Rate"
          className={`flex-1 px-2 py-2 rounded-xl border text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 ${
            rateNeg
              ? "border-red-400 focus:ring-red-200 focus:border-red-400"
              : "border-gray-200 dark:border-gray-700 focus:ring-[#9C7C2E]/30 focus:border-[#9C7C2E]"
          }`}
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
          className="bg-[#9C7C2E] text-black text-xs font-medium px-3 py-2 rounded-xl hover:bg-[#9C7C2E] transition-colors"
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
    {error && <p className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">{error}</p>}
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
        {icon && <span className="text-[#9C7C2E]">{icon}</span>}
        <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
      </div>
      <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mt-2">{value}</p>
    </div>
  );
}
