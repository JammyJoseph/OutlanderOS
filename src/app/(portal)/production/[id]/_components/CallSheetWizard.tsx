"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  X, ChevronLeft, ChevronRight, Loader2, Check, Calendar, Users, MapPin, Clock, ClipboardCheck,
} from "lucide-react";
import { ProductionFull, TeamMember } from "./types";

interface Props {
  production: ProductionFull;
  onClose: () => void;
}

type ShootType = "shoot" | "recce" | "meeting";

const SHOOT_TYPES: { key: ShootType; label: string }[] = [
  { key: "shoot", label: "Shoot" },
  { key: "recce", label: "Recce" },
  { key: "meeting", label: "Meeting" },
];

interface ScheduleRow {
  time: string;
  description: string;
  notes: string;
}

const SCHEDULE_TEMPLATES: { key: string; label: string; rows: ScheduleRow[] }[] = [
  {
    key: "full",
    label: "Full day shoot",
    rows: [
      { time: "08:00", description: "Crew call", notes: "" },
      { time: "08:30", description: "HMU & styling", notes: "" },
      { time: "09:30", description: "Talent call", notes: "" },
      { time: "10:00", description: "First setup", notes: "" },
      { time: "13:00", description: "Lunch", notes: "" },
      { time: "14:00", description: "Afternoon block", notes: "" },
      { time: "18:00", description: "Wrap", notes: "" },
    ],
  },
  {
    key: "half",
    label: "Half day",
    rows: [
      { time: "08:00", description: "Crew call", notes: "" },
      { time: "08:30", description: "Setup", notes: "" },
      { time: "09:00", description: "Shoot", notes: "" },
      { time: "12:00", description: "Wrap", notes: "" },
    ],
  },
  {
    key: "studio",
    label: "Studio day",
    rows: [
      { time: "09:00", description: "Crew call", notes: "" },
      { time: "09:30", description: "Lighting setup", notes: "" },
      { time: "10:00", description: "Talent + HMU", notes: "" },
      { time: "11:00", description: "Shoot", notes: "" },
      { time: "13:00", description: "Lunch", notes: "" },
      { time: "14:00", description: "Shoot", notes: "" },
      { time: "17:00", description: "Wrap", notes: "" },
    ],
  },
];

const STEPS = ["Date & Type", "Crew", "Location", "Schedule", "Review"];

export default function CallSheetWizard({ production, onClose }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);

  const usedDates = useMemo(
    () => new Set((production.callSheets ?? []).map((cs) => cs.shootDate.split("T")[0])),
    [production.callSheets]
  );
  const firstFreeShoot = (production.shootDates ?? [])
    .map((d) => d.split("T")[0])
    .find((d) => d && !usedDates.has(d));

  // Step 1
  const [shootDate, setShootDate] = useState(firstFreeShoot || "");
  const [shootType, setShootType] = useState<ShootType>("shoot");

  // Step 2 — crew (default all team members selected)
  const team = production.teamMembers ?? [];
  const [selected, setSelected] = useState<Set<string>>(new Set(team.map((m) => m.id)));

  // Step 3 — location (pre-fill from the most recent call sheet's address)
  const lastAddr =
    ((production.callSheets ?? [])
      .slice()
      .sort((a, b) => new Date(b.shootDate).getTime() - new Date(a.shootDate).getTime())[0]
      ?.location as { address?: string } | null)?.address ?? "";
  const [locationName, setLocationName] = useState("Location 1");
  const [address, setAddress] = useState(lastAddr);

  // Step 4 — schedule template
  const [templateKey, setTemplateKey] = useState("full");
  const template = SCHEDULE_TEMPLATES.find((t) => t.key === templateKey) ?? SCHEDULE_TEMPLATES[0];
  const callTime = template.rows[0]?.time || "08:00";

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const chosenCrew = team.filter((m) => selected.has(m.id));

  function crewPayload(members: TeamMember[]) {
    return members.map((m) => ({
      role: m.role || "",
      name: m.name,
      callTime,
      email: m.email || "",
      phone: m.phone || "",
    }));
  }

  const typeLabel = SHOOT_TYPES.find((t) => t.key === shootType)?.label ?? "Shoot";
  const shootTitle =
    shootType === "shoot"
      ? production.title
      : `${typeLabel} — ${production.title}`;

  async function create() {
    if (!shootDate) {
      setStep(0);
      return;
    }
    setBusy(true);
    try {
      const locations = address
        ? [
            {
              name: locationName || "Location 1",
              address,
              postcode: "",
              nearestAE: "",
              parkingNotes: "",
              contactPerson: "",
              whatThreeWords: "",
              mapLink: "",
              lat: null,
              lng: null,
            },
          ]
        : [];
      const res = await fetch("/api/call-sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productionId: production.id,
          shootTitle,
          shootDate: new Date(shootDate + "T08:00:00").toISOString(),
          callTime,
          location: address ? { address } : {},
          locations,
          schedule: template.rows,
          crew: crewPayload(chosenCrew),
          status: "DRAFT",
        }),
      });
      const data = await res.json();
      if (data.sheet) {
        router.push(`/production/${production.id}/call-sheets/${data.sheet.id}`);
      } else {
        setBusy(false);
      }
    } catch {
      setBusy(false);
    }
  }

  const canNext =
    step === 0 ? !!shootDate : true;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 py-10 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-2xl">
        {/* Header + step indicator */}
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">New Call Sheet</h2>
            <p className="text-xs text-gray-400">
              Step {step + 1} of {STEPS.length} — {STEPS[step]}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
            <X size={18} />
          </button>
        </div>

        {/* Progress */}
        <div className="flex gap-1 px-5 pt-3">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= step ? "bg-[#9C7C2E]" : "bg-gray-100 dark:bg-gray-800"
              }`}
            />
          ))}
        </div>

        <div className="px-5 py-5 min-h-[240px]">
          {step === 0 && (
            <div className="space-y-4">
              <StepHead icon={<Calendar size={15} />} title="When & what" />
              <div>
                <label className={wLabel}>Date</label>
                <input
                  type="date"
                  value={shootDate}
                  onChange={(e) => setShootDate(e.target.value)}
                  className={wInput}
                />
              </div>
              <div>
                <label className={wLabel}>Type</label>
                <div className="flex gap-2">
                  {SHOOT_TYPES.map((t) => (
                    <button
                      key={t.key}
                      onClick={() => setShootType(t.key)}
                      className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                        shootType === t.key
                          ? "border-[#9C7C2E] bg-amber-50 dark:bg-amber-900/30 text-gray-900 dark:text-gray-100"
                          : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              <StepHead
                icon={<Users size={15} />}
                title={`Crew (${chosenCrew.length}/${team.length})`}
              />
              {team.length === 0 ? (
                <p className="text-sm text-gray-400 py-6 text-center">
                  No team members yet — add crew in the Team tab first, or continue and add them later.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {team.map((m) => {
                    const on = selected.has(m.id);
                    return (
                      <button
                        key={m.id}
                        onClick={() => toggle(m.id)}
                        className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors ${
                          on
                            ? "border-[#9C7C2E] bg-amber-50/50 dark:bg-amber-900/20"
                            : "border-gray-200 dark:border-gray-700"
                        }`}
                      >
                        <span
                          className={`flex h-5 w-5 items-center justify-center rounded border ${
                            on ? "bg-[#9C7C2E] border-[#9C7C2E]" : "border-gray-300 dark:border-gray-600"
                          }`}
                        >
                          {on && <Check size={13} className="text-black" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-gray-800 dark:text-gray-200">
                            {m.name}
                          </span>
                          <span className="block truncate text-xs text-gray-400">{m.role}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <StepHead icon={<MapPin size={15} />} title="Location" />
              <div>
                <label className={wLabel}>Location name</label>
                <input
                  type="text"
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  placeholder="Location 1"
                  className={wInput}
                />
              </div>
              <div>
                <label className={wLabel}>Address</label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={3}
                  placeholder="Full address"
                  className={`${wInput} resize-none`}
                />
                {lastAddr && address === lastAddr && (
                  <p className="mt-1 text-[11px] text-gray-400">Pre-filled from your last call sheet.</p>
                )}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <StepHead icon={<Clock size={15} />} title="Schedule" />
              <div className="grid grid-cols-3 gap-2">
                {SCHEDULE_TEMPLATES.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setTemplateKey(t.key)}
                    className={`rounded-xl border px-2 py-2 text-xs font-medium transition-colors ${
                      templateKey === t.key
                        ? "border-[#9C7C2E] bg-amber-50 dark:bg-amber-900/30 text-gray-900 dark:text-gray-100"
                        : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="rounded-xl border border-gray-100 dark:border-gray-800 divide-y divide-gray-50 dark:divide-gray-800">
                {template.rows.map((r, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-1.5 text-sm">
                    <span className="tabular-nums text-gray-400 w-12">{r.time}</span>
                    <span className="text-gray-700 dark:text-gray-300">{r.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <StepHead icon={<ClipboardCheck size={15} />} title="Review" />
              <dl className="space-y-2 text-sm">
                <ReviewRow label="Title" value={shootTitle} />
                <ReviewRow label="Type" value={typeLabel} />
                <ReviewRow label="Date" value={shootDate || "—"} />
                <ReviewRow label="Call time" value={callTime} />
                <ReviewRow label="Crew" value={`${chosenCrew.length} selected`} />
                <ReviewRow label="Location" value={address || "—"} />
                <ReviewRow label="Schedule" value={`${template.label} (${template.rows.length} rows)`} />
              </dl>
            </div>
          )}
        </div>

        {/* Footer nav */}
        <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-800 px-5 py-3">
          <button
            onClick={() => (step === 0 ? onClose() : setStep((s) => s - 1))}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
          >
            <ChevronLeft size={15} /> {step === 0 ? "Cancel" : "Back"}
          </button>
          {step < STEPS.length - 1 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              disabled={!canNext}
              className="inline-flex items-center gap-1 rounded-xl bg-gray-900 dark:bg-gray-100 px-4 py-2 text-sm font-medium text-white dark:text-gray-900 hover:opacity-90 disabled:opacity-40"
            >
              Next <ChevronRight size={15} />
            </button>
          ) : (
            <button
              onClick={create}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#9C7C2E] px-4 py-2 text-sm font-medium text-black hover:opacity-90 disabled:opacity-50"
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
              Create call sheet
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const wLabel = "block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5";
const wInput =
  "w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-[#9C7C2E]/30 focus:border-[#9C7C2E]";

function StepHead({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <p className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-200">
      <span className="text-[#9C7C2E]">{icon}</span> {title}
    </p>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-gray-50 dark:border-gray-800 pb-1.5">
      <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</dt>
      <dd className="text-sm text-gray-800 dark:text-gray-200 text-right">{value}</dd>
    </div>
  );
}
