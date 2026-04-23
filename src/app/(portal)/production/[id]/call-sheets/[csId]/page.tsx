"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  Eye,
  Send,
  Edit2,
  Loader2,
  MapPin,
  Clock,
  Users,
  Coffee,
  FileText,
  Cloud,
  Check,
  Share2,
} from "lucide-react";
import { format, parseISO } from "date-fns";

type CallSheetStatus = "DRAFT" | "SAVED" | "PUBLISHED";

interface ScheduleItem {
  time: string;
  description: string;
  notes: string;
}

interface CrewMember {
  role: string;
  name: string;
  callTime: string;
  email: string;
  phone: string;
}

interface TalentMember {
  role: string;
  name: string;
  callTime: string;
  email: string;
  phone: string;
}

interface LocationData {
  address: string;
  parkingNotes: string;
  nearestHospital: string;
  whatThreeWords: string;
}

interface CateringData {
  vendor: string;
  mealTimes: string;
  dietaryNotes: string;
}

interface NotesData {
  shootTitle: string;
  wrapTime: string;
  talent: TalentMember[];
  catering: CateringData;
  general: string;
  safety: string;
  parking: string;
}

interface CallSheet {
  id: string;
  status: CallSheetStatus;
  shootDate: string;
  callTime: string;
  location: LocationData;
  schedule: ScheduleItem[];
  crew: CrewMember[];
  notes: string | null;
  production: {
    id: string;
    title: string;
    campaign: { title: string; client: { name: string } } | null;
  };
}

function parseNotes(raw: string | null): NotesData {
  const defaults: NotesData = {
    shootTitle: "",
    wrapTime: "",
    talent: [],
    catering: { vendor: "", mealTimes: "", dietaryNotes: "" },
    general: "",
    safety: "",
    parking: "",
  };
  if (!raw) return defaults;
  try {
    const parsed = JSON.parse(raw);
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}

function serializeNotes(n: NotesData): string {
  return JSON.stringify(n);
}

const SECTION_ICONS = {
  schedule: Clock,
  location: MapPin,
  crew: Users,
  talent: Users,
  catering: Coffee,
  notes: FileText,
  weather: Cloud,
};

export default function CallSheetPage() {
  const { id, csId } = useParams<{ id: string; csId: string }>();
  const router = useRouter();

  const [sheet, setSheet] = useState<CallSheet | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<"editor" | "preview">("editor");
  const [copied, setCopied] = useState(false);

  // Form fields
  const [shootTitle, setShootTitle] = useState("");
  const [shootDate, setShootDate] = useState("");
  const [callTime, setCallTime] = useState("08:00");
  const [wrapTime, setWrapTime] = useState("");
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [location, setLocation] = useState<LocationData>({
    address: "",
    parkingNotes: "",
    nearestHospital: "",
    whatThreeWords: "",
  });
  const [crew, setCrew] = useState<CrewMember[]>([]);
  const [talent, setTalent] = useState<TalentMember[]>([]);
  const [catering, setCatering] = useState<CateringData>({ vendor: "", mealTimes: "", dietaryNotes: "" });
  const [notesGeneral, setNotesGeneral] = useState("");
  const [notesSafety, setNotesSafety] = useState("");
  const [notesParking, setNotesParking] = useState("");

  const loadSheet = useCallback(() => {
    fetch(`/api/call-sheets/${csId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.sheet) {
          const s: CallSheet = d.sheet;
          setSheet(s);
          const notes = parseNotes(s.notes);
          setShootTitle(notes.shootTitle || s.production.title);
          setShootDate(s.shootDate.split("T")[0]);
          setCallTime(s.callTime || "08:00");
          setWrapTime(notes.wrapTime || "");
          setSchedule(
            Array.isArray(s.schedule)
              ? (s.schedule as ScheduleItem[])
              : []
          );
          setLocation(
            s.location && typeof s.location === "object"
              ? (s.location as LocationData)
              : { address: "", parkingNotes: "", nearestHospital: "", whatThreeWords: "" }
          );
          setCrew(Array.isArray(s.crew) ? (s.crew as CrewMember[]) : []);
          setTalent(notes.talent || []);
          setCatering(notes.catering || { vendor: "", mealTimes: "", dietaryNotes: "" });
          setNotesGeneral(notes.general || "");
          setNotesSafety(notes.safety || "");
          setNotesParking(notes.parking || "");
        }
      })
      .finally(() => setLoading(false));
  }, [csId]);

  useEffect(() => {
    loadSheet();
  }, [loadSheet]);

  async function saveSheet(newStatus?: CallSheetStatus) {
    if (!sheet) return;
    setSaving(true);
    const notesData: NotesData = {
      shootTitle,
      wrapTime,
      talent,
      catering,
      general: notesGeneral,
      safety: notesSafety,
      parking: notesParking,
    };
    try {
      const res = await fetch(`/api/call-sheets/${csId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shootDate: new Date(shootDate).toISOString(),
          callTime,
          location,
          schedule,
          crew,
          notes: serializeNotes(notesData),
          status: newStatus ?? (sheet.status === "DRAFT" ? "SAVED" : sheet.status),
        }),
      });
      const data = await res.json();
      if (data.sheet) {
        setSheet((prev) => prev ? { ...prev, ...data.sheet } : prev);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        if (newStatus === "SAVED" && activeTab === "editor") {
          setActiveTab("preview");
        }
      }
    } finally {
      setSaving(false);
    }
  }

  async function publishSheet() {
    await saveSheet("PUBLISHED");
    setSheet((prev) => prev ? { ...prev, status: "PUBLISHED" } : prev);
  }

  async function revertToEditor() {
    if (!sheet) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/call-sheets/${csId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "SAVED" }),
      });
      const data = await res.json();
      if (data.sheet) {
        setSheet((prev) => prev ? { ...prev, status: "SAVED" } : prev);
        setActiveTab("editor");
      }
    } finally {
      setSaving(false);
    }
  }

  function copyShareLink() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F9F9F7] flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (!sheet) {
    return (
      <div className="min-h-screen bg-[#F9F9F7] flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Call sheet not found.</p>
          <Link href={`/production/${id}`} className="text-[#D4A853] text-sm font-medium hover:underline">
            Back to Project
          </Link>
        </div>
      </div>
    );
  }

  if (sheet.status === "PUBLISHED") {
    return <FinalView sheet={sheet} shootTitle={shootTitle} schedule={schedule} location={location} crew={crew} talent={talent} catering={catering} notesGeneral={notesGeneral} notesSafety={notesSafety} notesParking={notesParking} callTime={callTime} wrapTime={wrapTime} onRevert={revertToEditor} saving={saving} copied={copied} onCopy={copyShareLink} productionId={id} />;
  }

  return (
    <div className="min-h-screen bg-[#F9F9F7]">
      <div className="max-w-4xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Link
            href={`/production/${id}`}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft size={15} />
            {sheet.production.title}
          </Link>
          <div className="flex items-center gap-2">
            {saved && (
              <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                <Check size={13} /> Saved
              </span>
            )}
            <button
              onClick={() => saveSheet("SAVED")}
              disabled={saving}
              className="flex items-center gap-1.5 bg-[#D4A853] text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-[#c49843] transition-colors disabled:opacity-60 shadow-sm"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save
            </button>
          </div>
        </div>

        {/* Title */}
        <div className="mb-6">
          <input
            type="text"
            value={shootTitle}
            onChange={(e) => setShootTitle(e.target.value)}
            placeholder="Shoot Title"
            className="text-2xl font-semibold text-gray-900 bg-transparent border-none outline-none w-full placeholder-gray-300 tracking-tight"
          />
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-600">
              {sheet.status === "DRAFT" ? "Draft" : "Saved"}
            </span>
            {sheet.production.campaign?.client?.name && (
              <span className="text-xs text-gray-400">{sheet.production.campaign.client.name}</span>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
          <button
            onClick={() => setActiveTab("editor")}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "editor"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <span className="flex items-center gap-1.5"><Edit2 size={13} /> Editor</span>
          </button>
          <button
            onClick={() => setActiveTab("preview")}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "preview"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <span className="flex items-center gap-1.5"><Eye size={13} /> Preview</span>
          </button>
        </div>

        {activeTab === "editor" ? (
          <EditorView
            shootDate={shootDate}
            setShootDate={setShootDate}
            callTime={callTime}
            setCallTime={setCallTime}
            wrapTime={wrapTime}
            setWrapTime={setWrapTime}
            schedule={schedule}
            setSchedule={setSchedule}
            location={location}
            setLocation={setLocation}
            crew={crew}
            setCrew={setCrew}
            talent={talent}
            setTalent={setTalent}
            catering={catering}
            setCatering={setCatering}
            notesGeneral={notesGeneral}
            setNotesGeneral={setNotesGeneral}
            notesSafety={notesSafety}
            setNotesSafety={setNotesSafety}
            notesParking={notesParking}
            setNotesParking={setNotesParking}
          />
        ) : (
          <PreviewView
            shootTitle={shootTitle}
            shootDate={shootDate}
            callTime={callTime}
            wrapTime={wrapTime}
            schedule={schedule}
            location={location}
            crew={crew}
            talent={talent}
            catering={catering}
            notesGeneral={notesGeneral}
            notesSafety={notesSafety}
            notesParking={notesParking}
            onPublish={publishSheet}
            onBackToEditor={() => setActiveTab("editor")}
            saving={saving}
          />
        )}
      </div>
    </div>
  );
}

// ─── Editor View ──────────────────────────────────────────────────────────────

function EditorView({
  shootDate, setShootDate,
  callTime, setCallTime,
  wrapTime, setWrapTime,
  schedule, setSchedule,
  location, setLocation,
  crew, setCrew,
  talent, setTalent,
  catering, setCatering,
  notesGeneral, setNotesGeneral,
  notesSafety, setNotesSafety,
  notesParking, setNotesParking,
}: {
  shootDate: string; setShootDate: (v: string) => void;
  callTime: string; setCallTime: (v: string) => void;
  wrapTime: string; setWrapTime: (v: string) => void;
  schedule: ScheduleItem[]; setSchedule: (v: ScheduleItem[]) => void;
  location: LocationData; setLocation: (v: LocationData) => void;
  crew: CrewMember[]; setCrew: (v: CrewMember[]) => void;
  talent: TalentMember[]; setTalent: (v: TalentMember[]) => void;
  catering: CateringData; setCatering: (v: CateringData) => void;
  notesGeneral: string; setNotesGeneral: (v: string) => void;
  notesSafety: string; setNotesSafety: (v: string) => void;
  notesParking: string; setNotesParking: (v: string) => void;
}) {
  return (
    <div className="space-y-4">
      {/* General Info */}
      <Section title="General Info" icon={<Clock size={15} className="text-gray-400" />}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Shoot Date</label>
            <input
              type="date"
              value={shootDate}
              onChange={(e) => setShootDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4A853]/30 focus:border-[#D4A853]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Call Time</label>
            <input
              type="time"
              value={callTime}
              onChange={(e) => setCallTime(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4A853]/30 focus:border-[#D4A853]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Wrap Time</label>
            <input
              type="time"
              value={wrapTime}
              onChange={(e) => setWrapTime(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4A853]/30 focus:border-[#D4A853]"
            />
          </div>
        </div>
      </Section>

      {/* Schedule */}
      <Section title="Schedule" icon={<Clock size={15} className="text-gray-400" />}>
        <div className="space-y-2">
          {schedule.map((item, i) => (
            <div key={i} className="grid grid-cols-[100px_1fr_1fr_32px] gap-2 items-center">
              <input
                type="time"
                value={item.time}
                onChange={(e) =>
                  setSchedule(schedule.map((s, j) => (j === i ? { ...s, time: e.target.value } : s)))
                }
                className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#D4A853]/30 focus:border-[#D4A853]"
              />
              <input
                type="text"
                value={item.description}
                onChange={(e) =>
                  setSchedule(schedule.map((s, j) => (j === i ? { ...s, description: e.target.value } : s)))
                }
                placeholder="Activity"
                className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#D4A853]/30 focus:border-[#D4A853]"
              />
              <input
                type="text"
                value={item.notes}
                onChange={(e) =>
                  setSchedule(schedule.map((s, j) => (j === i ? { ...s, notes: e.target.value } : s)))
                }
                placeholder="Notes"
                className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#D4A853]/30 focus:border-[#D4A853]"
              />
              <button
                onClick={() => setSchedule(schedule.filter((_, j) => j !== i))}
                className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          <button
            onClick={() => setSchedule([...schedule, { time: "", description: "", notes: "" }])}
            className="flex items-center gap-1.5 text-xs font-medium text-[#D4A853] hover:text-[#c49843] transition-colors mt-1"
          >
            <Plus size={13} /> Add Row
          </button>
        </div>
      </Section>

      {/* Location */}
      <Section title="Location" icon={<MapPin size={15} className="text-gray-400" />}>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Address</label>
            <textarea
              value={location.address}
              onChange={(e) => setLocation({ ...location, address: e.target.value })}
              placeholder="Full address"
              rows={2}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#D4A853]/30 focus:border-[#D4A853]"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Parking Notes</label>
              <input
                type="text"
                value={location.parkingNotes}
                onChange={(e) => setLocation({ ...location, parkingNotes: e.target.value })}
                placeholder="Parking info"
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4A853]/30 focus:border-[#D4A853]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Nearest Hospital</label>
              <input
                type="text"
                value={location.nearestHospital}
                onChange={(e) => setLocation({ ...location, nearestHospital: e.target.value })}
                placeholder="Hospital name"
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4A853]/30 focus:border-[#D4A853]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">what3words</label>
              <input
                type="text"
                value={location.whatThreeWords}
                onChange={(e) => setLocation({ ...location, whatThreeWords: e.target.value })}
                placeholder="///word.word.word"
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4A853]/30 focus:border-[#D4A853]"
              />
            </div>
          </div>
        </div>
      </Section>

      {/* Crew */}
      <Section title="Crew" icon={<Users size={15} className="text-gray-400" />}>
        <PeopleTable people={crew} setPeople={setCrew} />
      </Section>

      {/* Talent */}
      <Section title="Talent / Cast" icon={<Users size={15} className="text-gray-400" />}>
        <PeopleTable people={talent} setPeople={setTalent} />
      </Section>

      {/* Catering */}
      <Section title="Catering" icon={<Coffee size={15} className="text-gray-400" />}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Vendor</label>
            <input
              type="text"
              value={catering.vendor}
              onChange={(e) => setCatering({ ...catering, vendor: e.target.value })}
              placeholder="Catering company"
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4A853]/30 focus:border-[#D4A853]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Meal Times</label>
            <input
              type="text"
              value={catering.mealTimes}
              onChange={(e) => setCatering({ ...catering, mealTimes: e.target.value })}
              placeholder="e.g. Lunch 13:00"
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4A853]/30 focus:border-[#D4A853]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Dietary Notes</label>
            <input
              type="text"
              value={catering.dietaryNotes}
              onChange={(e) => setCatering({ ...catering, dietaryNotes: e.target.value })}
              placeholder="Dietary requirements"
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4A853]/30 focus:border-[#D4A853]"
            />
          </div>
        </div>
      </Section>

      {/* Notes */}
      <Section title="Notes" icon={<FileText size={15} className="text-gray-400" />}>
        <div className="space-y-3">
          {[
            { label: "Production Notes", value: notesGeneral, set: setNotesGeneral, placeholder: "General production notes..." },
            { label: "Safety Notes", value: notesSafety, set: setNotesSafety, placeholder: "Safety briefing, hazards..." },
            { label: "Parking Instructions", value: notesParking, set: setNotesParking, placeholder: "Parking details..." },
          ].map(({ label, value, set, placeholder }) => (
            <div key={label}>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">{label}</label>
              <textarea
                value={value}
                onChange={(e) => set(e.target.value)}
                placeholder={placeholder}
                rows={2}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#D4A853]/30 focus:border-[#D4A853]"
              />
            </div>
          ))}
        </div>
      </Section>

      {/* Weather */}
      <Section title="Weather" icon={<Cloud size={15} className="text-gray-400" />}>
        <div className="py-4 text-center">
          <p className="text-sm text-gray-400">Weather integration coming soon</p>
        </div>
      </Section>
    </div>
  );
}

// ─── Preview View ─────────────────────────────────────────────────────────────

function PreviewView({
  shootTitle, shootDate, callTime, wrapTime,
  schedule, location, crew, talent, catering,
  notesGeneral, notesSafety, notesParking,
  onPublish, onBackToEditor, saving,
}: {
  shootTitle: string; shootDate: string; callTime: string; wrapTime: string;
  schedule: ScheduleItem[]; location: LocationData; crew: CrewMember[];
  talent: TalentMember[]; catering: CateringData;
  notesGeneral: string; notesSafety: string; notesParking: string;
  onPublish: () => void; onBackToEditor: () => void; saving: boolean;
}) {
  return (
    <div>
      <CallSheetDocument
        shootTitle={shootTitle}
        shootDate={shootDate}
        callTime={callTime}
        wrapTime={wrapTime}
        schedule={schedule}
        location={location}
        crew={crew}
        talent={talent}
        catering={catering}
        notesGeneral={notesGeneral}
        notesSafety={notesSafety}
        notesParking={notesParking}
      />
      <div className="flex gap-3 mt-6 pt-6 border-t border-gray-100">
        <button
          onClick={onBackToEditor}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <Edit2 size={14} />
          Back to Editor
        </button>
        <button
          onClick={onPublish}
          disabled={saving}
          className="flex items-center gap-2 bg-[#D4A853] text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-[#c49843] transition-colors disabled:opacity-60 shadow-sm"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          Publish &amp; Share
        </button>
      </div>
    </div>
  );
}

// ─── Final View (PUBLISHED) ───────────────────────────────────────────────────

function FinalView({
  sheet, shootTitle, schedule, location, crew, talent, catering,
  notesGeneral, notesSafety, notesParking, callTime, wrapTime,
  onRevert, saving, copied, onCopy, productionId,
}: {
  sheet: CallSheet; shootTitle: string; schedule: ScheduleItem[];
  location: LocationData; crew: CrewMember[]; talent: TalentMember[];
  catering: CateringData; notesGeneral: string; notesSafety: string;
  notesParking: string; callTime: string; wrapTime: string;
  onRevert: () => void; saving: boolean; copied: boolean;
  onCopy: () => void; productionId: string;
}) {
  return (
    <div className="min-h-screen bg-[#F9F9F7]">
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <Link
            href={`/production/${productionId}`}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft size={15} />
            {sheet.production.title}
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={onRevert}
              disabled={saving}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-60"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Edit2 size={13} />}
              Edit
            </button>
            <button
              onClick={onCopy}
              className="flex items-center gap-1.5 bg-[#D4A853] text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-[#c49843] transition-colors shadow-sm"
            >
              {copied ? <Check size={13} /> : <Share2 size={13} />}
              {copied ? "Copied!" : "Share"}
            </button>
          </div>
        </div>

        <div className="mb-4 flex items-center gap-2">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">
            Published
          </span>
        </div>

        <CallSheetDocument
          shootTitle={shootTitle}
          shootDate={sheet.shootDate.split("T")[0]}
          callTime={callTime}
          wrapTime={wrapTime}
          schedule={schedule}
          location={location}
          crew={crew}
          talent={talent}
          catering={catering}
          notesGeneral={notesGeneral}
          notesSafety={notesSafety}
          notesParking={notesParking}
        />
      </div>
    </div>
  );
}

// ─── Shared: Call Sheet Document ──────────────────────────────────────────────

function CallSheetDocument({
  shootTitle, shootDate, callTime, wrapTime,
  schedule, location, crew, talent, catering,
  notesGeneral, notesSafety, notesParking,
}: {
  shootTitle: string; shootDate: string; callTime: string; wrapTime: string;
  schedule: ScheduleItem[]; location: LocationData; crew: CrewMember[];
  talent: TalentMember[]; catering: CateringData;
  notesGeneral: string; notesSafety: string; notesParking: string;
}) {
  const formattedDate = shootDate
    ? format(new Date(shootDate + "T12:00:00"), "EEEE d MMMM yyyy")
    : "—";

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Call sheet header */}
      <div className="bg-gray-900 text-white px-8 py-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold">{shootTitle || "Call Sheet"}</h1>
            <p className="text-gray-400 text-sm mt-0.5">{formattedDate}</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-[#D4A853]">{callTime || "—"}</div>
            <div className="text-xs text-gray-400 uppercase tracking-wider">Call Time</div>
            {wrapTime && (
              <div className="text-xs text-gray-400 mt-0.5">Wrap: {wrapTime}</div>
            )}
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Location */}
        {(location.address || location.parkingNotes || location.nearestHospital || location.whatThreeWords) && (
          <DocSection title="Location" icon={<MapPin size={14} />}>
            {location.address && <p className="text-sm text-gray-700">{location.address}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
              {location.parkingNotes && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Parking</p>
                  <p className="text-sm text-gray-700">{location.parkingNotes}</p>
                </div>
              )}
              {location.nearestHospital && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Hospital</p>
                  <p className="text-sm text-gray-700">{location.nearestHospital}</p>
                </div>
              )}
              {location.whatThreeWords && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">what3words</p>
                  <p className="text-sm text-gray-700">{location.whatThreeWords}</p>
                </div>
              )}
            </div>
          </DocSection>
        )}

        {/* Schedule */}
        {schedule.length > 0 && (
          <DocSection title="Schedule" icon={<Clock size={14} />}>
            <div className="space-y-0 border border-gray-100 rounded-xl overflow-hidden">
              {schedule.map((item, i) => (
                <div key={i} className={`flex items-start gap-4 px-4 py-3 ${i % 2 === 0 ? "bg-gray-50/50" : "bg-white"}`}>
                  <span className="text-xs font-mono font-semibold text-[#D4A853] w-12 flex-shrink-0 pt-0.5">
                    {item.time}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800">{item.description}</p>
                    {item.notes && <p className="text-xs text-gray-500 mt-0.5">{item.notes}</p>}
                  </div>
                </div>
              ))}
            </div>
          </DocSection>
        )}

        {/* Crew */}
        {crew.length > 0 && (
          <DocSection title="Crew" icon={<Users size={14} />}>
            <PeopleTable people={crew} setPeople={() => {}} readOnly />
          </DocSection>
        )}

        {/* Talent */}
        {talent.length > 0 && (
          <DocSection title="Talent / Cast" icon={<Users size={14} />}>
            <PeopleTable people={talent} setPeople={() => {}} readOnly />
          </DocSection>
        )}

        {/* Catering */}
        {(catering.vendor || catering.mealTimes || catering.dietaryNotes) && (
          <DocSection title="Catering" icon={<Coffee size={14} />}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {catering.vendor && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Vendor</p>
                  <p className="text-sm text-gray-700">{catering.vendor}</p>
                </div>
              )}
              {catering.mealTimes && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Meal Times</p>
                  <p className="text-sm text-gray-700">{catering.mealTimes}</p>
                </div>
              )}
              {catering.dietaryNotes && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Dietary</p>
                  <p className="text-sm text-gray-700">{catering.dietaryNotes}</p>
                </div>
              )}
            </div>
          </DocSection>
        )}

        {/* Notes */}
        {(notesGeneral || notesSafety || notesParking) && (
          <DocSection title="Notes" icon={<FileText size={14} />}>
            <div className="space-y-3">
              {notesGeneral && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Production Notes</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{notesGeneral}</p>
                </div>
              )}
              {notesSafety && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Safety</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{notesSafety}</p>
                </div>
              )}
              {notesParking && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Parking</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{notesParking}</p>
                </div>
              )}
            </div>
          </DocSection>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-50">
        {icon}
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

function DocSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-3">
        <span className="text-gray-400">{icon}</span>
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function PeopleTable({
  people,
  setPeople,
  readOnly = false,
}: {
  people: (CrewMember | TalentMember)[];
  setPeople: (v: (CrewMember | TalentMember)[]) => void;
  readOnly?: boolean;
}) {
  if (readOnly) {
    if (people.length === 0) return null;
    return (
      <div className="border border-gray-100 rounded-xl overflow-hidden">
        <div className="grid grid-cols-[1fr_1fr_80px_1fr_1fr] gap-0 text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50 px-4 py-2">
          <span>Role</span>
          <span>Name</span>
          <span>Call</span>
          <span>Email</span>
          <span>Phone</span>
        </div>
        {people.map((p, i) => (
          <div
            key={i}
            className={`grid grid-cols-[1fr_1fr_80px_1fr_1fr] gap-0 px-4 py-2.5 text-sm ${
              i % 2 === 0 ? "bg-white" : "bg-gray-50/50"
            }`}
          >
            <span className="text-gray-600 font-medium">{p.role}</span>
            <span className="text-gray-800">{p.name}</span>
            <span className="text-[#D4A853] font-mono text-xs">{p.callTime}</span>
            <span className="text-gray-500 text-xs">{p.email}</span>
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
            onChange={(e) =>
              setPeople(people.map((m, j) => (j === i ? { ...m, role: e.target.value } : m)))
            }
            placeholder="Role"
            className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#D4A853]/30 focus:border-[#D4A853]"
          />
          <input
            type="text"
            value={p.name}
            onChange={(e) =>
              setPeople(people.map((m, j) => (j === i ? { ...m, name: e.target.value } : m)))
            }
            placeholder="Name"
            className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#D4A853]/30 focus:border-[#D4A853]"
          />
          <input
            type="time"
            value={p.callTime}
            onChange={(e) =>
              setPeople(people.map((m, j) => (j === i ? { ...m, callTime: e.target.value } : m)))
            }
            className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#D4A853]/30 focus:border-[#D4A853]"
          />
          <input
            type="email"
            value={p.email}
            onChange={(e) =>
              setPeople(people.map((m, j) => (j === i ? { ...m, email: e.target.value } : m)))
            }
            placeholder="Email"
            className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#D4A853]/30 focus:border-[#D4A853]"
          />
          <input
            type="tel"
            value={p.phone}
            onChange={(e) =>
              setPeople(people.map((m, j) => (j === i ? { ...m, phone: e.target.value } : m)))
            }
            placeholder="Phone"
            className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#D4A853]/30 focus:border-[#D4A853]"
          />
          <button
            onClick={() => setPeople(people.filter((_, j) => j !== i))}
            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors"
          >
            <Trash2 size={13} />
          </button>
        </div>
      ))}
      <button
        onClick={() =>
          setPeople([...people, { role: "", name: "", callTime: "", email: "", phone: "" }])
        }
        className="flex items-center gap-1.5 text-xs font-medium text-[#D4A853] hover:text-[#c49843] transition-colors mt-1"
      >
        <Plus size={13} /> Add Person
      </button>
    </div>
  );
}
