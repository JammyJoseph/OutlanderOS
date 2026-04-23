"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Save,
  Send,
  X,
  MapPin,
  Clock,
  Users,
  UtensilsCrossed,
  FileText,
  Info,
  Check,
  Loader2,
  Eye,
  Edit2,
  Share2,
} from "lucide-react";
import { format } from "date-fns";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface SheetMeta {
  shootTitle?: string;
  wrapTime?: string;
  general?: string;
  safety?: string;
  parking?: string;
  catering?: { vendor?: string; mealTimes?: string; dietary?: string };
}

interface ScheduleBlock {
  id: string;
  time: string;
  description: string;
  notes: string;
}

interface CrewMember {
  id: string;
  type: "crew" | "talent";
  role: string;
  name: string;
  callTime: string;
  email: string;
  phone: string;
  notes: string;
}

interface LocationData {
  address: string;
  parkingNotes: string;
  nearestHospital: string;
  whatThreeWords: string;
}

interface CallSheet {
  id: string;
  productionId: string;
  status: string;
  shootDate: string;
  callTime: string;
  location: Record<string, string>;
  schedule: Array<Record<string, string>>;
  crew: Array<Record<string, string>>;
  notes: string | null;
  distributedAt: string | null;
  production: {
    id: string;
    title: string;
    campaign?: { title: string; client: { name: string } } | null;
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function parseMeta(notes: string | null): SheetMeta {
  if (!notes) return {};
  try {
    if (notes.startsWith("{")) return JSON.parse(notes);
  } catch {}
  return { general: notes };
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// ─── Section Card ──────────────────────────────────────────────────────────────

function SectionCard({
  title,
  icon: Icon,
  open,
  onToggle,
  children,
}: {
  title: string;
  icon: React.ElementType;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="card-apple overflow-hidden">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-gray-50/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50">
            <Icon className="h-4 w-4 text-[#D4A853]" />
          </div>
          <span className="text-sm font-semibold text-gray-900">{title}</span>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        )}
      </button>
      {open && (
        <div className="border-t border-gray-100 px-5 pb-5 pt-4">{children}</div>
      )}
    </div>
  );
}

// ─── Crew Section ──────────────────────────────────────────────────────────────

function CrewSection({
  members,
  type,
  onAdd,
  onUpdate,
  onRemove,
}: {
  members: CrewMember[];
  type: "crew" | "talent";
  onAdd: () => void;
  onUpdate: (idx: number, field: keyof CrewMember, value: string) => void;
  onRemove: (idx: number) => void;
}) {
  const label = type === "crew" ? "Crew Member" : "Talent";
  return (
    <div className="space-y-3">
      {members.length > 0 && (
        <div className="hidden md:grid grid-cols-12 gap-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          <div className="col-span-3">Role</div>
          <div className="col-span-3">Name</div>
          <div className="col-span-2">Call Time</div>
          <div className="col-span-3">Email</div>
          <div className="col-span-1" />
        </div>
      )}
      {members.map((member, idx) => (
        <div key={member.id} className="grid grid-cols-12 gap-2 items-center">
          <div className="col-span-3">
            <input
              type="text"
              value={member.role}
              onChange={(e) => onUpdate(idx, "role", e.target.value)}
              placeholder="Role"
              className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:border-[#D4A853] focus:outline-none"
            />
          </div>
          <div className="col-span-3">
            <input
              type="text"
              value={member.name}
              onChange={(e) => onUpdate(idx, "name", e.target.value)}
              placeholder="Name"
              className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:border-[#D4A853] focus:outline-none"
            />
          </div>
          <div className="col-span-2">
            <input
              type="time"
              value={member.callTime}
              onChange={(e) => onUpdate(idx, "callTime", e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-1.5 py-1.5 text-xs focus:border-[#D4A853] focus:outline-none"
            />
          </div>
          <div className="col-span-3">
            <input
              type="email"
              value={member.email}
              onChange={(e) => onUpdate(idx, "email", e.target.value)}
              placeholder="Email"
              className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:border-[#D4A853] focus:outline-none"
            />
          </div>
          <div className="col-span-1 flex justify-end">
            <button onClick={() => onRemove(idx)} className="rounded p-1 text-gray-300 hover:text-red-400">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}
      <button
        onClick={onAdd}
        className="flex items-center gap-1.5 text-xs font-medium text-[#D4A853] hover:underline"
      >
        <Plus className="h-3.5 w-3.5" />
        Add {label}
      </button>
      {members.length === 0 && (
        <p className="py-4 text-center text-xs text-gray-400">No {label.toLowerCase()} added yet.</p>
      )}
    </div>
  );
}

// ─── Final View ────────────────────────────────────────────────────────────────

function FinalView({
  sheet,
  meta,
  location,
  schedule,
  crew,
  talent,
  callTime,
  shootDate,
  onEdit,
}: {
  sheet: CallSheet;
  meta: SheetMeta;
  location: LocationData;
  schedule: ScheduleBlock[];
  crew: CrewMember[];
  talent: CrewMember[];
  callTime: string;
  shootDate: string;
  onEdit: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const shootDateFmt = shootDate
    ? format(new Date(shootDate + "T12:00:00"), "EEEE d MMMM yyyy")
    : "—";
  const title = meta.shootTitle || sheet.production.title;

  function copyLink() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 py-2">
      {/* Cover */}
      <div className="card-apple overflow-hidden">
        <div className="bg-[#D4A853] px-8 py-8 text-white">
          <p className="text-xs font-semibold uppercase tracking-widest opacity-80">Call Sheet</p>
          <h1 className="mt-1 text-2xl font-bold">{title}</h1>
          {sheet.production.campaign && (
            <p className="mt-1 text-sm opacity-80">
              {sheet.production.campaign.client.name} — {sheet.production.campaign.title}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <div>
              <span className="opacity-70">Date</span>
              <p className="font-semibold">{shootDateFmt}</p>
            </div>
            <div>
              <span className="opacity-70">Call Time</span>
              <p className="font-semibold">{callTime || "—"}</p>
            </div>
            {meta.wrapTime && (
              <div>
                <span className="opacity-70">Wrap</span>
                <p className="font-semibold">{meta.wrapTime}</p>
              </div>
            )}
          </div>
        </div>

        {location.address && (
          <div className="flex items-start gap-3 border-t border-gray-100 px-8 py-4">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#D4A853]" />
            <div>
              <p className="text-sm font-medium text-gray-800">{location.address}</p>
              {location.whatThreeWords && (
                <p className="text-xs text-gray-400">///  {location.whatThreeWords}</p>
              )}
              {location.nearestHospital && (
                <p className="mt-0.5 text-xs text-gray-400">
                  Nearest hospital: {location.nearestHospital}
                </p>
              )}
              {location.parkingNotes && (
                <p className="mt-0.5 text-xs text-gray-400">Parking: {location.parkingNotes}</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Schedule */}
      {schedule.length > 0 && (
        <div className="card-apple p-6">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-400">Schedule</h2>
          <div className="space-y-2">
            {schedule.map((block) => (
              <div key={block.id} className="flex items-start gap-4">
                <span className="w-14 shrink-0 text-xs font-bold text-[#D4A853]">{block.time || "—"}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800">{block.description}</p>
                  {block.notes && <p className="text-xs text-gray-400">{block.notes}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Crew */}
      {crew.length > 0 && (
        <div className="card-apple p-6">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-400">Crew</h2>
          <div className="space-y-2">
            {crew.map((c) => (
              <div key={c.id} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-800">{c.name || "—"}</p>
                  <p className="text-xs text-gray-400">{c.role}</p>
                </div>
                <div className="text-right text-xs text-gray-400">
                  {c.callTime && <p>{c.callTime}</p>}
                  {c.email && <p>{c.email}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Talent */}
      {talent.length > 0 && (
        <div className="card-apple p-6">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-400">Talent / Cast</h2>
          <div className="space-y-2">
            {talent.map((t) => (
              <div key={t.id} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-800">{t.name || "—"}</p>
                  <p className="text-xs text-gray-400">{t.role}</p>
                </div>
                <div className="text-right text-xs text-gray-400">
                  {t.callTime && <p>{t.callTime}</p>}
                  {t.email && <p>{t.email}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Catering */}
      {meta.catering && (meta.catering.vendor || meta.catering.mealTimes || meta.catering.dietary) && (
        <div className="card-apple p-6">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-400">Catering</h2>
          <div className="space-y-1.5 text-sm">
            {meta.catering.vendor && <p><span className="font-medium text-gray-700">Vendor: </span><span className="text-gray-500">{meta.catering.vendor}</span></p>}
            {meta.catering.mealTimes && <p><span className="font-medium text-gray-700">Meal Times: </span><span className="text-gray-500">{meta.catering.mealTimes}</span></p>}
            {meta.catering.dietary && <p><span className="font-medium text-gray-700">Dietary: </span><span className="text-gray-500">{meta.catering.dietary}</span></p>}
          </div>
        </div>
      )}

      {/* Notes */}
      {(meta.general || meta.safety) && (
        <div className="card-apple p-6">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-400">Notes</h2>
          {meta.general && <p className="mb-2 whitespace-pre-wrap text-sm text-gray-700">{meta.general}</p>}
          {meta.safety && (
            <div className="mt-2 rounded-lg bg-amber-50 p-3">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-amber-700">Safety</p>
              <p className="text-xs text-amber-800">{meta.safety}</p>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={onEdit}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
        >
          <Edit2 className="h-3.5 w-3.5" />
          Edit Call Sheet
        </button>
        <button
          onClick={copyLink}
          className="flex items-center gap-1.5 rounded-lg bg-[#D4A853] px-4 py-2 text-xs font-semibold text-white hover:bg-[#C49843]"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
          {copied ? "Copied!" : "Copy Link"}
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function CallSheetPage() {
  const params = useParams();
  const router = useRouter();
  const productionId = params.id as string;
  const csId = params.csId as string;

  const [sheet, setSheet] = useState<CallSheet | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<"editor" | "preview">("editor");

  // Section open state
  const [open, setOpen] = useState<Record<string, boolean>>({
    general: true,
    schedule: false,
    location: false,
    crew: false,
    talent: false,
    catering: false,
    notes: false,
  });

  // Form state
  const [meta, setMeta] = useState<SheetMeta>({});
  const [callTime, setCallTime] = useState("08:00");
  const [shootDate, setShootDate] = useState("");
  const [location, setLocation] = useState<LocationData>({
    address: "",
    parkingNotes: "",
    nearestHospital: "",
    whatThreeWords: "",
  });
  const [schedule, setSchedule] = useState<ScheduleBlock[]>([]);
  const [crew, setCrew] = useState<CrewMember[]>([]);
  const [talent, setTalent] = useState<CrewMember[]>([]);

  useEffect(() => {
    if (!csId) return;
    fetch(`/api/call-sheets/${csId}`)
      .then((r) => r.json())
      .then(({ sheet: s }: { sheet: CallSheet }) => {
        setSheet(s);
        const m = parseMeta(s.notes);
        setMeta(m);
        setCallTime(s.callTime || "08:00");
        setShootDate(s.shootDate ? s.shootDate.split("T")[0] : "");
        const loc = (s.location || {}) as Record<string, string>;
        setLocation({
          address: loc.address || "",
          parkingNotes: loc.parkingNotes || "",
          nearestHospital: loc.nearestHospital || "",
          whatThreeWords: loc.whatThreeWords || "",
        });
        const rawSchedule = (s.schedule || []) as Array<Record<string, string>>;
        setSchedule(rawSchedule.map((b) => ({ id: b.id || uid(), time: b.time || "", description: b.description || "", notes: b.notes || "" })));
        const rawCrew = (s.crew || []) as Array<Record<string, string>>;
        const crewArr: CrewMember[] = [];
        const talentArr: CrewMember[] = [];
        rawCrew.forEach((c) => {
          const member: CrewMember = { id: c.id || uid(), type: (c.type as "crew" | "talent") || "crew", role: c.role || "", name: c.name || "", callTime: c.callTime || "", email: c.email || "", phone: c.phone || "", notes: c.notes || "" };
          if (member.type === "talent") talentArr.push(member);
          else crewArr.push(member);
        });
        setCrew(crewArr);
        setTalent(talentArr);
        setLoading(false);
      });
  }, [csId]);

  function toggle(key: string) {
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function combinedCrew() {
    return [
      ...crew.map((c) => ({ ...c, type: "crew" as const })),
      ...talent.map((t) => ({ ...t, type: "talent" as const })),
    ];
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/call-sheets/${csId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "SAVED",
          shootDate,
          callTime,
          location,
          schedule,
          crew: combinedCrew(),
          notes: JSON.stringify(meta),
        }),
      });
      const data = await res.json();
      if (data.sheet) {
        setSheet((prev) => prev ? { ...prev, status: "SAVED" } : prev);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        setActiveTab("preview");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    setPublishing(true);
    try {
      const res = await fetch(`/api/call-sheets/${csId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PUBLISHED" }),
      });
      const data = await res.json();
      if (data.sheet) {
        setSheet((prev) => prev ? { ...prev, status: "PUBLISHED" } : prev);
      }
    } finally {
      setPublishing(false);
    }
  }

  async function handleEdit() {
    await fetch(`/api/call-sheets/${csId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "SAVED" }),
    });
    setSheet((prev) => prev ? { ...prev, status: "SAVED" } : prev);
    setActiveTab("editor");
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#D4A853]" />
      </div>
    );
  }

  if (!sheet) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <p className="text-sm text-gray-500">Call sheet not found.</p>
        <Link href={`/production/${productionId}`} className="rounded-lg bg-[#D4A853] px-4 py-2 text-xs font-semibold text-white">
          Back to Project
        </Link>
      </div>
    );
  }

  const isPublished = sheet.status === "PUBLISHED";
  const displayTitle = meta.shootTitle || sheet.production.title;
  const shootDateFmt = shootDate ? format(new Date(shootDate + "T12:00:00"), "EEE d MMM yyyy") : "—";

  const STATUS_BADGE: Record<string, string> = {
    DRAFT: "bg-gray-100 text-gray-600",
    SAVED: "bg-blue-100 text-blue-700",
    PUBLISHED: "bg-emerald-100 text-emerald-700",
  };
  const STATUS_LABEL: Record<string, string> = {
    DRAFT: "Draft",
    SAVED: "Saved",
    PUBLISHED: "Published",
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href={`/production/${productionId}`}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-sm font-semibold text-gray-900">{displayTitle}</h1>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_BADGE[sheet.status] ?? "bg-gray-100 text-gray-600"}`}>
                {STATUS_LABEL[sheet.status] ?? sheet.status}
              </span>
            </div>
            <p className="truncate text-xs text-gray-400">
              {sheet.production.title} · {shootDateFmt}
            </p>
          </div>
        </div>

        {isPublished ? (
          <div className="flex items-center gap-2">
            <button
              onClick={handleEdit}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              <Edit2 className="h-3.5 w-3.5" />
              Edit
            </button>
            <button
              onClick={() => { navigator.clipboard.writeText(window.location.href); }}
              className="flex items-center gap-1.5 rounded-lg bg-[#D4A853] px-3 py-2 text-xs font-semibold text-white hover:bg-[#C49843]"
            >
              <Share2 className="h-3.5 w-3.5" />
              Share
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {saved && (
              <span className="flex items-center gap-1 text-xs text-emerald-600">
                <Check className="h-3.5 w-3.5" /> Saved
              </span>
            )}
            <div className="flex rounded-lg border border-gray-200 text-xs">
              <button
                onClick={() => setActiveTab("editor")}
                className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors ${activeTab === "editor" ? "bg-gray-100 font-semibold text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
              >
                <Edit2 className="h-3 w-3" /> Editor
              </button>
              <button
                onClick={() => setActiveTab("preview")}
                className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors ${activeTab === "preview" ? "bg-gray-100 font-semibold text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
              >
                <Eye className="h-3 w-3" /> Preview
              </button>
            </div>
            {activeTab === "editor" ? (
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 rounded-lg bg-[#D4A853] px-3 py-2 text-xs font-semibold text-white hover:bg-[#C49843] disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                {saving ? "Saving…" : "Save"}
              </button>
            ) : (
              <button
                onClick={handlePublish}
                disabled={publishing}
                className="flex items-center gap-1.5 rounded-lg bg-[#D4A853] px-3 py-2 text-xs font-semibold text-white hover:bg-[#C49843] disabled:opacity-50"
              >
                {publishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                {publishing ? "Publishing…" : "Publish & Share"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {isPublished ? (
          <FinalView
            sheet={sheet}
            meta={meta}
            location={location}
            schedule={schedule}
            crew={crew}
            talent={talent}
            callTime={callTime}
            shootDate={shootDate}
            onEdit={handleEdit}
          />
        ) : activeTab === "preview" ? (
          <FinalView
            sheet={sheet}
            meta={meta}
            location={location}
            schedule={schedule}
            crew={crew}
            talent={talent}
            callTime={callTime}
            shootDate={shootDate}
            onEdit={() => setActiveTab("editor")}
          />
        ) : (
          <div className="mx-auto max-w-2xl space-y-3">
            {/* General Info */}
            <SectionCard title="General Info" icon={Info} open={open.general} onToggle={() => toggle("general")}>
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Shoot Title</label>
                  <input
                    type="text"
                    value={meta.shootTitle || ""}
                    onChange={(e) => setMeta((m) => ({ ...m, shootTitle: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#D4A853] focus:outline-none"
                    placeholder="e.g. Summer Campaign — Day 1"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-700">Shoot Date</label>
                    <input
                      type="date"
                      value={shootDate}
                      onChange={(e) => setShootDate(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#D4A853] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-700">Production</label>
                    <input
                      readOnly
                      value={sheet.production.title}
                      className="w-full rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-700">Call Time</label>
                    <input
                      type="time"
                      value={callTime}
                      onChange={(e) => setCallTime(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#D4A853] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-700">Wrap Time</label>
                    <input
                      type="time"
                      value={meta.wrapTime || ""}
                      onChange={(e) => setMeta((m) => ({ ...m, wrapTime: e.target.value }))}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#D4A853] focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </SectionCard>

            {/* Schedule */}
            <SectionCard title={`Schedule (${schedule.length} blocks)`} icon={Clock} open={open.schedule} onToggle={() => toggle("schedule")}>
              <div className="space-y-3">
                {schedule.length > 0 && (
                  <div className="grid grid-cols-12 gap-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                    <div className="col-span-2">Time</div>
                    <div className="col-span-5">Activity</div>
                    <div className="col-span-4">Notes</div>
                    <div className="col-span-1" />
                  </div>
                )}
                {schedule.map((block, idx) => (
                  <div key={block.id} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-2">
                      <input
                        type="time"
                        value={block.time}
                        onChange={(e) => setSchedule((prev) => prev.map((b, i) => i === idx ? { ...b, time: e.target.value } : b))}
                        className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:border-[#D4A853] focus:outline-none"
                      />
                    </div>
                    <div className="col-span-5">
                      <input
                        type="text"
                        value={block.description}
                        onChange={(e) => setSchedule((prev) => prev.map((b, i) => i === idx ? { ...b, description: e.target.value } : b))}
                        placeholder="Activity"
                        className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:border-[#D4A853] focus:outline-none"
                      />
                    </div>
                    <div className="col-span-4">
                      <input
                        type="text"
                        value={block.notes}
                        onChange={(e) => setSchedule((prev) => prev.map((b, i) => i === idx ? { ...b, notes: e.target.value } : b))}
                        placeholder="Notes"
                        className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:border-[#D4A853] focus:outline-none"
                      />
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <button onClick={() => setSchedule((prev) => prev.filter((_, i) => i !== idx))} className="rounded p-1 text-gray-300 hover:text-red-400">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => setSchedule((prev) => [...prev, { id: uid(), time: "", description: "", notes: "" }])}
                  className="flex items-center gap-1.5 text-xs font-medium text-[#D4A853] hover:underline"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add time block
                </button>
                {schedule.length === 0 && (
                  <p className="py-4 text-center text-xs text-gray-400">No schedule blocks yet.</p>
                )}
              </div>
            </SectionCard>

            {/* Location */}
            <SectionCard title="Location" icon={MapPin} open={open.location} onToggle={() => toggle("location")}>
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Address</label>
                  <input
                    type="text"
                    value={location.address}
                    onChange={(e) => setLocation((l) => ({ ...l, address: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#D4A853] focus:outline-none"
                    placeholder="Studio or venue address"
                  />
                </div>
                {location.address && (
                  <div className="flex h-20 items-center justify-center rounded-xl bg-gray-100 text-xs text-gray-400">
                    <MapPin className="mr-2 h-4 w-4" />
                    {location.address}
                  </div>
                )}
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Parking Notes</label>
                  <textarea
                    rows={2}
                    value={location.parkingNotes}
                    onChange={(e) => setLocation((l) => ({ ...l, parkingNotes: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#D4A853] focus:outline-none"
                    placeholder="Parking instructions…"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-700">Nearest Hospital</label>
                    <input
                      type="text"
                      value={location.nearestHospital}
                      onChange={(e) => setLocation((l) => ({ ...l, nearestHospital: e.target.value }))}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#D4A853] focus:outline-none"
                      placeholder="Hospital name or address"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-700">What3Words</label>
                    <input
                      type="text"
                      value={location.whatThreeWords}
                      onChange={(e) => setLocation((l) => ({ ...l, whatThreeWords: e.target.value }))}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#D4A853] focus:outline-none"
                      placeholder="///word.word.word"
                    />
                  </div>
                </div>
              </div>
            </SectionCard>

            {/* Crew */}
            <SectionCard title={`Crew (${crew.length})`} icon={Users} open={open.crew} onToggle={() => toggle("crew")}>
              <CrewSection
                members={crew}
                type="crew"
                onAdd={() => setCrew((prev) => [...prev, { id: uid(), type: "crew", role: "", name: "", callTime: "", email: "", phone: "", notes: "" }])}
                onUpdate={(idx, field, value) => setCrew((prev) => prev.map((c, i) => i === idx ? { ...c, [field]: value } : c))}
                onRemove={(idx) => setCrew((prev) => prev.filter((_, i) => i !== idx))}
              />
            </SectionCard>

            {/* Talent */}
            <SectionCard title={`Talent / Cast (${talent.length})`} icon={Users} open={open.talent} onToggle={() => toggle("talent")}>
              <CrewSection
                members={talent}
                type="talent"
                onAdd={() => setTalent((prev) => [...prev, { id: uid(), type: "talent", role: "", name: "", callTime: "", email: "", phone: "", notes: "" }])}
                onUpdate={(idx, field, value) => setTalent((prev) => prev.map((t, i) => i === idx ? { ...t, [field]: value } : t))}
                onRemove={(idx) => setTalent((prev) => prev.filter((_, i) => i !== idx))}
              />
            </SectionCard>

            {/* Catering */}
            <SectionCard title="Catering" icon={UtensilsCrossed} open={open.catering} onToggle={() => toggle("catering")}>
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Vendor</label>
                  <input
                    type="text"
                    value={meta.catering?.vendor || ""}
                    onChange={(e) => setMeta((m) => ({ ...m, catering: { ...m.catering, vendor: e.target.value } }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#D4A853] focus:outline-none"
                    placeholder="Catering company or vendor name"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Meal Times</label>
                  <input
                    type="text"
                    value={meta.catering?.mealTimes || ""}
                    onChange={(e) => setMeta((m) => ({ ...m, catering: { ...m.catering, mealTimes: e.target.value } }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#D4A853] focus:outline-none"
                    placeholder="e.g. Lunch 12:30–13:30"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Dietary Notes</label>
                  <textarea
                    rows={2}
                    value={meta.catering?.dietary || ""}
                    onChange={(e) => setMeta((m) => ({ ...m, catering: { ...m.catering, dietary: e.target.value } }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#D4A853] focus:outline-none"
                    placeholder="Dietary requirements…"
                  />
                </div>
              </div>
            </SectionCard>

            {/* Notes */}
            <SectionCard title="Notes" icon={FileText} open={open.notes} onToggle={() => toggle("notes")}>
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Production Notes</label>
                  <textarea
                    rows={3}
                    value={meta.general || ""}
                    onChange={(e) => setMeta((m) => ({ ...m, general: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#D4A853] focus:outline-none"
                    placeholder="General notes for the team…"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Safety Notes</label>
                  <textarea
                    rows={2}
                    value={meta.safety || ""}
                    onChange={(e) => setMeta((m) => ({ ...m, safety: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#D4A853] focus:outline-none"
                    placeholder="H&S instructions, emergency procedures…"
                  />
                </div>
              </div>
            </SectionCard>

            {/* Save CTA at bottom */}
            <div className="flex items-center justify-end gap-3 pt-2">
              {saved && (
                <span className="flex items-center gap-1 text-xs text-emerald-600">
                  <Check className="h-3.5 w-3.5" /> Saved
                </span>
              )}
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 rounded-lg bg-[#D4A853] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#C49843] disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                {saving ? "Saving…" : "Save & Preview"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
