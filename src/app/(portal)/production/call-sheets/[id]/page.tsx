"use client";

import { useState, useEffect, useCallback } from "react";
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
  CloudSun,
  Info,
  Check,
  Loader2,
  Mail,
} from "lucide-react";
import { format } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SheetMeta {
  shootTitle?: string;
  wrapTime?: string;
  general?: string;
  safety?: string;
  parking?: string;
  status?: "Draft" | "Sent" | "Confirmed";
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

interface Contact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  role?: string;
  category?: string;
}

interface CallSheet {
  id: string;
  productionId: string;
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
    status: string;
    campaign?: { title: string; client: { name: string } } | null;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

const STATUS_BADGE: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-600",
  Sent: "bg-blue-100 text-blue-700",
  Confirmed: "bg-emerald-100 text-emerald-700",
};

// ─── Section Card ─────────────────────────────────────────────────────────────

function SectionCard({
  title,
  icon: Icon,
  open,
  onToggle,
  children,
  onSave,
  saving,
  saved,
}: {
  title: string;
  icon: React.ElementType;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  onSave?: () => void;
  saving?: boolean;
  saved?: boolean;
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
        <div className="border-t border-gray-100 px-5 pb-5 pt-4">
          {children}
          {onSave && (
            <div className="mt-4 flex items-center justify-end gap-2">
              {saved && (
                <span className="flex items-center gap-1 text-xs text-emerald-600">
                  <Check className="h-3.5 w-3.5" /> Saved
                </span>
              )}
              <button
                onClick={onSave}
                disabled={saving}
                className="flex items-center gap-1.5 rounded-lg bg-[#D4A853] px-4 py-2 text-xs font-semibold text-white hover:bg-[#C49843] disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CallSheetEditorPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [sheet, setSheet] = useState<CallSheet | null>(null);
  const [loading, setLoading] = useState(true);

  // Open/closed sections
  const [open, setOpen] = useState<Record<string, boolean>>({
    general: true,
    schedule: false,
    location: false,
    crew: false,
    talent: false,
    catering: false,
    notes: false,
    weather: false,
  });

  // Saving state per section
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});

  // Section data
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
  const [contacts, setContacts] = useState<Contact[]>([]);

  // Distribution panel
  const [showDistribution, setShowDistribution] = useState(false);
  const [distRecipients, setDistRecipients] = useState("");
  const [distSubject, setDistSubject] = useState("");

  // Load data
  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetch(`/api/call-sheets/${id}`).then((r) => r.json()),
      fetch("/api/contacts?categories=photographer,stylist,crew,talent,model").then((r) =>
        r.json()
      ),
    ]).then(([sheetData, contactsData]) => {
      const s: CallSheet = sheetData.sheet;
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
      setSchedule(
        rawSchedule.map((b) => ({
          id: b.id || uid(),
          time: b.time || "",
          description: b.description || "",
          notes: b.notes || "",
        }))
      );

      const rawCrew = (s.crew || []) as Array<Record<string, string>>;
      const crewArr: CrewMember[] = [];
      const talentArr: CrewMember[] = [];
      rawCrew.forEach((c) => {
        const member: CrewMember = {
          id: c.id || uid(),
          type: (c.type as "crew" | "talent") || "crew",
          role: c.role || "",
          name: c.name || "",
          callTime: c.callTime || "",
          email: c.email || "",
          phone: c.phone || "",
          notes: c.notes || "",
        };
        if (member.type === "talent") talentArr.push(member);
        else crewArr.push(member);
      });
      setCrew(crewArr);
      setTalent(talentArr);

      setContacts(Array.isArray(contactsData) ? contactsData : []);
      setLoading(false);
    });
  }, [id]);

  function toggle(key: string) {
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function markSaved(section: string) {
    setSaved((prev) => ({ ...prev, [section]: true }));
    setTimeout(() => setSaved((prev) => ({ ...prev, [section]: false })), 2000);
  }

  async function saveSection(section: string, body: Record<string, unknown>) {
    setSaving((prev) => ({ ...prev, [section]: true }));
    try {
      await fetch(`/api/call-sheets/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      markSaved(section);
    } finally {
      setSaving((prev) => ({ ...prev, [section]: false }));
    }
  }

  function combinedCrew() {
    return [
      ...crew.map((c) => ({ ...c, type: "crew" as const })),
      ...talent.map((t) => ({ ...t, type: "talent" as const })),
    ];
  }

  // ── Handlers ────────────────────────────────────────────────────────────────

  function handleSaveGeneral() {
    saveSection("general", {
      callTime,
      shootDate,
      notes: JSON.stringify({ ...meta, wrapTime: meta.wrapTime, shootTitle: meta.shootTitle }),
    });
  }

  function handleSaveLocation() {
    saveSection("location", { location });
  }

  function handleSaveSchedule() {
    saveSection("schedule", { schedule });
  }

  function handleSaveCrew() {
    saveSection("crew", { crew: combinedCrew() });
  }

  function handleSaveTalent() {
    saveSection("talent", { crew: combinedCrew() });
  }

  function handleSaveCatering() {
    saveSection("catering", {
      notes: JSON.stringify({ ...meta }),
    });
  }

  function handleSaveNotes() {
    saveSection("notes", {
      notes: JSON.stringify({ ...meta }),
    });
  }

  // ── Schedule helpers ─────────────────────────────────────────────────────────

  function addScheduleBlock() {
    setSchedule((prev) => [
      ...prev,
      { id: uid(), time: "", description: "", notes: "" },
    ]);
  }

  function updateScheduleBlock(idx: number, field: keyof ScheduleBlock, value: string) {
    setSchedule((prev) =>
      prev.map((b, i) => (i === idx ? { ...b, [field]: value } : b))
    );
  }

  function removeScheduleBlock(idx: number) {
    setSchedule((prev) => prev.filter((_, i) => i !== idx));
  }

  // ── Crew helpers ─────────────────────────────────────────────────────────────

  function addCrewMember(type: "crew" | "talent") {
    const blank: CrewMember = {
      id: uid(),
      type,
      role: "",
      name: "",
      callTime: "",
      email: "",
      phone: "",
      notes: "",
    };
    if (type === "crew") setCrew((prev) => [...prev, blank]);
    else setTalent((prev) => [...prev, blank]);
  }

  function updateCrew(
    list: CrewMember[],
    setter: (fn: (prev: CrewMember[]) => CrewMember[]) => void,
    idx: number,
    field: keyof CrewMember,
    value: string
  ) {
    setter((prev) => prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c)));
  }

  function removeCrew(
    setter: (fn: (prev: CrewMember[]) => CrewMember[]) => void,
    idx: number
  ) {
    setter((prev) => prev.filter((_, i) => i !== idx));
  }

  function addFromContact(contact: Contact, type: "crew" | "talent") {
    const member: CrewMember = {
      id: uid(),
      type,
      role: contact.role || contact.category || "",
      name: contact.name,
      callTime: "",
      email: contact.email || "",
      phone: contact.phone || "",
      notes: "",
    };
    if (type === "crew") setCrew((prev) => [...prev, member]);
    else setTalent((prev) => [...prev, member]);
  }

  const crewNames = new Set([...crew.map((c) => c.name.toLowerCase()), ...talent.map((t) => t.name.toLowerCase())]);
  const availableContacts = contacts.filter((c) => !crewNames.has(c.name.toLowerCase()));

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
        <Link
          href="/production/call-sheets"
          className="rounded-lg bg-[#D4A853] px-4 py-2 text-xs font-semibold text-white"
        >
          Back to Call Sheets
        </Link>
      </div>
    );
  }

  const currentStatus = meta.status || (sheet.distributedAt ? "Sent" : "Draft");
  const shootDateFmt = shootDate
    ? format(new Date(shootDate + "T12:00:00"), "EEE d MMM yyyy")
    : "—";

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/production/call-sheets"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold text-gray-900 truncate">
                {meta.shootTitle || sheet.production.title}
              </h1>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_BADGE[currentStatus]}`}
              >
                {currentStatus}
              </span>
            </div>
            <p className="text-xs text-gray-400 truncate">
              {sheet.production.title} · {shootDateFmt}
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setDistSubject(
              `Call Sheet: ${meta.shootTitle || sheet.production.title} — ${shootDateFmt}`
            );
            setShowDistribution(true);
          }}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[#D4A853] px-3 py-2 text-xs font-semibold text-[#D4A853] hover:bg-amber-50"
        >
          <Send className="h-3.5 w-3.5" />
          Share Call Sheet
        </button>
      </div>

      {/* Sections */}
      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-2xl space-y-3">

          {/* 1. General Info */}
          <SectionCard
            title="General Info"
            icon={Info}
            open={open.general}
            onToggle={() => toggle("general")}
            onSave={handleSaveGeneral}
            saving={saving.general}
            saved={saved.general}
          >
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Shoot Title
                </label>
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
                  <label className="mb-1 block text-xs font-medium text-gray-700">
                    Shoot Date
                  </label>
                  <input
                    type="date"
                    value={shootDate}
                    onChange={(e) => setShootDate(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#D4A853] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">
                    Production
                  </label>
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
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Status</label>
                <select
                  value={meta.status || "Draft"}
                  onChange={(e) =>
                    setMeta((m) => ({ ...m, status: e.target.value as SheetMeta["status"] }))
                  }
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#D4A853] focus:outline-none"
                >
                  <option value="Draft">Draft</option>
                  <option value="Sent">Sent</option>
                  <option value="Confirmed">Confirmed</option>
                </select>
              </div>
            </div>
          </SectionCard>

          {/* 2. Schedule */}
          <SectionCard
            title={`Schedule (${schedule.length} blocks)`}
            icon={Clock}
            open={open.schedule}
            onToggle={() => toggle("schedule")}
            onSave={handleSaveSchedule}
            saving={saving.schedule}
            saved={saved.schedule}
          >
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
                      onChange={(e) => updateScheduleBlock(idx, "time", e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:border-[#D4A853] focus:outline-none"
                    />
                  </div>
                  <div className="col-span-5">
                    <input
                      type="text"
                      value={block.description}
                      onChange={(e) => updateScheduleBlock(idx, "description", e.target.value)}
                      placeholder="Activity"
                      className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:border-[#D4A853] focus:outline-none"
                    />
                  </div>
                  <div className="col-span-4">
                    <input
                      type="text"
                      value={block.notes}
                      onChange={(e) => updateScheduleBlock(idx, "notes", e.target.value)}
                      placeholder="Notes"
                      className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:border-[#D4A853] focus:outline-none"
                    />
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <button
                      onClick={() => removeScheduleBlock(idx)}
                      className="rounded p-1 text-gray-300 hover:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              <button
                onClick={addScheduleBlock}
                className="mt-1 flex items-center gap-1.5 text-xs font-medium text-[#D4A853] hover:underline"
              >
                <Plus className="h-3.5 w-3.5" />
                Add time block
              </button>
              {schedule.length === 0 && (
                <p className="py-4 text-center text-xs text-gray-400">
                  No schedule blocks yet. Add your first activity.
                </p>
              )}
            </div>
          </SectionCard>

          {/* 3. Location */}
          <SectionCard
            title="Location"
            icon={MapPin}
            open={open.location}
            onToggle={() => toggle("location")}
            onSave={handleSaveLocation}
            saving={saving.location}
            saved={saved.location}
          >
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
              {/* Static map placeholder */}
              {location.address && (
                <div className="flex h-28 items-center justify-center rounded-xl bg-gray-100 text-xs text-gray-400">
                  <MapPin className="mr-2 h-4 w-4" />
                  {location.address}
                </div>
              )}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Parking Notes
                </label>
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
                  <label className="mb-1 block text-xs font-medium text-gray-700">
                    Nearest Hospital
                  </label>
                  <input
                    type="text"
                    value={location.nearestHospital}
                    onChange={(e) =>
                      setLocation((l) => ({ ...l, nearestHospital: e.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#D4A853] focus:outline-none"
                    placeholder="Hospital name or address"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">
                    What3Words
                  </label>
                  <input
                    type="text"
                    value={location.whatThreeWords}
                    onChange={(e) =>
                      setLocation((l) => ({ ...l, whatThreeWords: e.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#D4A853] focus:outline-none"
                    placeholder="///word.word.word"
                  />
                </div>
              </div>
            </div>
          </SectionCard>

          {/* 4. Crew */}
          <SectionCard
            title={`Crew (${crew.length})`}
            icon={Users}
            open={open.crew}
            onToggle={() => toggle("crew")}
            onSave={handleSaveCrew}
            saving={saving.crew}
            saved={saved.crew}
          >
            <CrewSection
              members={crew}
              type="crew"
              onAdd={() => addCrewMember("crew")}
              onUpdate={(idx, field, value) =>
                updateCrew(crew, setCrew, idx, field as keyof CrewMember, value)
              }
              onRemove={(idx) => removeCrew(setCrew, idx)}
              contacts={availableContacts}
              onAddFromContact={(c) => addFromContact(c, "crew")}
            />
          </SectionCard>

          {/* 5. Talent / Cast */}
          <SectionCard
            title={`Talent / Cast (${talent.length})`}
            icon={Users}
            open={open.talent}
            onToggle={() => toggle("talent")}
            onSave={handleSaveTalent}
            saving={saving.talent}
            saved={saved.talent}
          >
            <CrewSection
              members={talent}
              type="talent"
              onAdd={() => addCrewMember("talent")}
              onUpdate={(idx, field, value) =>
                updateCrew(talent, setTalent, idx, field as keyof CrewMember, value)
              }
              onRemove={(idx) => removeCrew(setTalent, idx)}
              contacts={availableContacts}
              onAddFromContact={(c) => addFromContact(c, "talent")}
            />
          </SectionCard>

          {/* 6. Catering */}
          <SectionCard
            title="Catering"
            icon={UtensilsCrossed}
            open={open.catering}
            onToggle={() => toggle("catering")}
            onSave={handleSaveCatering}
            saving={saving.catering}
            saved={saved.catering}
          >
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Vendor</label>
                <input
                  type="text"
                  value={meta.catering?.vendor || ""}
                  onChange={(e) =>
                    setMeta((m) => ({
                      ...m,
                      catering: { ...m.catering, vendor: e.target.value },
                    }))
                  }
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#D4A853] focus:outline-none"
                  placeholder="Catering company or vendor name"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Meal Times</label>
                <input
                  type="text"
                  value={meta.catering?.mealTimes || ""}
                  onChange={(e) =>
                    setMeta((m) => ({
                      ...m,
                      catering: { ...m.catering, mealTimes: e.target.value },
                    }))
                  }
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#D4A853] focus:outline-none"
                  placeholder="e.g. Lunch 12:30–13:30, Wrap meal 19:00"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Dietary Notes
                </label>
                <textarea
                  rows={2}
                  value={meta.catering?.dietary || ""}
                  onChange={(e) =>
                    setMeta((m) => ({
                      ...m,
                      catering: { ...m.catering, dietary: e.target.value },
                    }))
                  }
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#D4A853] focus:outline-none"
                  placeholder="Dietary requirements (vegetarian, gluten-free, allergies…)"
                />
              </div>
            </div>
          </SectionCard>

          {/* 7. Notes */}
          <SectionCard
            title="Notes"
            icon={FileText}
            open={open.notes}
            onToggle={() => toggle("notes")}
            onSave={handleSaveNotes}
            saving={saving.notes}
            saved={saved.notes}
          >
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Production Notes
                </label>
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
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Parking Instructions
                </label>
                <textarea
                  rows={2}
                  value={meta.parking || ""}
                  onChange={(e) => setMeta((m) => ({ ...m, parking: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#D4A853] focus:outline-none"
                  placeholder="Parking details and instructions…"
                />
              </div>
            </div>
          </SectionCard>

          {/* 8. Weather */}
          <SectionCard
            title="Weather"
            icon={CloudSun}
            open={open.weather}
            onToggle={() => toggle("weather")}
          >
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CloudSun className="h-10 w-10 text-gray-200" />
              <p className="text-sm font-medium text-gray-500">Weather integration coming soon</p>
              <p className="max-w-xs text-xs text-gray-400">
                Live weather data for your shoot location will appear here once a weather API is
                connected.
              </p>
            </div>
          </SectionCard>
        </div>
      </div>

      {/* Distribution Panel */}
      {showDistribution && (
        <div className="fixed inset-0 z-50 flex items-end justify-end bg-black/30 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div className="flex items-center gap-2">
                <Send className="h-4 w-4 text-[#D4A853]" />
                <h2 className="text-base font-semibold text-gray-900">Share Call Sheet</h2>
              </div>
              <button
                onClick={() => setShowDistribution(false)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4 p-6">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Recipients
                </label>
                <textarea
                  rows={3}
                  value={distRecipients}
                  onChange={(e) => setDistRecipients(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#D4A853] focus:outline-none"
                  placeholder="Enter email addresses, one per line…"
                />
                {/* Quick-add from crew */}
                {crew.filter((c) => c.email).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {crew
                      .filter((c) => c.email)
                      .map((c) => (
                        <button
                          key={c.id}
                          onClick={() =>
                            setDistRecipients((r) =>
                              r ? `${r}\n${c.email}` : c.email
                            )
                          }
                          className="rounded-full bg-gray-100 px-2.5 py-1 text-[10px] text-gray-600 hover:bg-amber-50 hover:text-[#D4A853]"
                        >
                          + {c.name}
                        </button>
                      ))}
                  </div>
                )}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Email Subject
                </label>
                <input
                  type="text"
                  value={distSubject}
                  onChange={(e) => setDistSubject(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#D4A853] focus:outline-none"
                />
              </div>
              <div className="rounded-xl bg-amber-50 p-4">
                <p className="text-xs font-medium text-amber-800">Distribution Preview</p>
                <p className="mt-1 text-xs text-amber-700">
                  <strong>{meta.shootTitle || sheet.production.title}</strong> · {shootDateFmt}
                  {callTime && ` · Call: ${callTime}`}
                  {meta.wrapTime && ` · Wrap: ${meta.wrapTime}`}
                </p>
                <p className="mt-1 text-xs text-amber-700">
                  {location.address || "No location set"}
                </p>
                <p className="mt-1 text-xs text-amber-700">
                  {schedule.length} schedule block{schedule.length !== 1 ? "s" : ""} ·{" "}
                  {crew.length} crew · {talent.length} talent
                </p>
              </div>
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-center">
                <Mail className="mx-auto mb-2 h-5 w-5 text-gray-300" />
                <p className="text-xs text-gray-400">
                  Distribution requires email service integration.
                </p>
                <p className="mt-0.5 text-xs text-gray-400">
                  Connect an email provider in Settings to send call sheets.
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowDistribution(false)}
                  className="rounded-lg px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  disabled
                  className="flex items-center gap-1.5 rounded-lg bg-gray-200 px-4 py-2 text-xs font-semibold text-gray-400 cursor-not-allowed"
                >
                  <Send className="h-3.5 w-3.5" />
                  Send (requires email service)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Crew Section Component ───────────────────────────────────────────────────

function CrewSection({
  members,
  type,
  onAdd,
  onUpdate,
  onRemove,
  contacts,
  onAddFromContact,
}: {
  members: CrewMember[];
  type: "crew" | "talent";
  onAdd: () => void;
  onUpdate: (idx: number, field: string, value: string) => void;
  onRemove: (idx: number) => void;
  contacts: Contact[];
  onAddFromContact: (contact: Contact) => void;
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
            <button
              onClick={() => onRemove(idx)}
              className="rounded p-1 text-gray-300 hover:text-red-400"
            >
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

      {contacts.length > 0 && (
        <div className="mt-3 border-t border-gray-100 pt-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            Quick-add from contacts
          </p>
          <div className="flex flex-wrap gap-1.5">
            {contacts.slice(0, 12).map((c) => (
              <button
                key={c.id}
                onClick={() => onAddFromContact(c)}
                className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[10px] text-gray-600 hover:border-[#D4A853] hover:text-[#D4A853] transition-colors"
              >
                + {c.name}
                {c.role && <span className="ml-1 text-gray-400">· {c.role}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {members.length === 0 && (
        <p className="py-4 text-center text-xs text-gray-400">
          No {label.toLowerCase()} added yet. Click above to add.
        </p>
      )}
    </div>
  );
}
