"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft } from "lucide-react";
import { Avatar, FlowFrame, FlowTitle, KV, Overlay, pill } from "@/components/os";
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

// Redesign board 5.3: one question per screen, the step bar across the top.
const STEPS = ["Shoot day", "Location", "People", "Schedule", "Review"];

const FIELD =
  "block h-[52px] w-full rounded-lg border border-field bg-card px-4 text-base text-foreground outline-none placeholder:text-muted-foreground focus:border-foreground focus:shadow-[0_0_0_3px_var(--focus)]";
const LABEL = "mb-2 block text-[15px] text-ink-2";

function longDate(iso: string) {
  return iso
    ? new Date(iso + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })
    : "";
}

export default function CallSheetWizard({ production, onClose }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const usedDates = useMemo(
    () => new Set((production.callSheets ?? []).map((cs) => cs.shootDate.split("T")[0])),
    [production.callSheets]
  );
  const firstFreeShoot = (production.shootDates ?? [])
    .map((d) => d.split("T")[0])
    .find((d) => d && !usedDates.has(d));

  // Shoot day
  const [shootDate, setShootDate] = useState(firstFreeShoot || "");
  const [shootType, setShootType] = useState<ShootType>("shoot");

  // People — everyone on the Team tab starts selected
  const team = production.teamMembers ?? [];
  const [selected, setSelected] = useState<Set<string>>(new Set(team.map((m) => m.id)));
  // Optional per-person call times; blank means "on the unit call".
  const [callTimes, setCallTimes] = useState<Record<string, string>>({});

  // Location (pre-filled from the most recent call sheet's address)
  const lastAddr =
    ((production.callSheets ?? [])
      .slice()
      .sort((a, b) => new Date(b.shootDate).getTime() - new Date(a.shootDate).getTime())[0]
      ?.location as { address?: string } | null)?.address ?? "";
  const [locationName, setLocationName] = useState("Location 1");
  const [address, setAddress] = useState(lastAddr);

  // Schedule template
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
      // Blank = the unit call; only a time set on the People step overrides it.
      callTime: callTimes[m.id] || "",
      email: m.email || "",
      phone: m.phone || "",
    }));
  }

  const typeLabel = SHOOT_TYPES.find((t) => t.key === shootType)?.label ?? "Shoot";
  const shootTitle = shootType === "shoot" ? production.title : `${typeLabel} — ${production.title}`;
  const context = [production.title, longDate(shootDate), `Unit call ${callTime}`].filter(Boolean).join(" · ");

  async function create() {
    if (!shootDate) {
      setStep(0);
      return;
    }
    setBusy(true);
    setError(null);
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
          unitCallTime: callTime,
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
        setError(data.error || "Couldn't create the call sheet. Try again.");
        setBusy(false);
      }
    } catch {
      setError("Couldn't create the call sheet. Check your connection and try again.");
      setBusy(false);
    }
  }

  const back = step > 0 && (
    <button
      type="button"
      onClick={() => setStep((s) => s - 1)}
      disabled={busy}
      className="mb-4 inline-flex min-h-11 items-center gap-2 font-semibold hover:text-brand disabled:opacity-50"
    >
      <ChevronLeft className="size-5" strokeWidth={1.75} /> Back
    </button>
  );
  const next = (label: string, disabled = false) => (
    <button type="button" onClick={() => setStep((s) => s + 1)} disabled={disabled} className={`${pill("primary")} w-full`}>
      {label}
    </button>
  );

  return (
    <Overlay label="New call sheet" onClose={busy ? undefined : onClose}>
      <FlowFrame steps={STEPS} current={step} onClose={busy ? undefined : onClose}>
        {back}

        {step === 0 && (
          <div className="flex flex-col gap-6">
            <FlowTitle sub={production.title}>Which day is it for?</FlowTitle>
            <div>
              <label htmlFor="cs-date" className={LABEL}>
                Date
              </label>
              <input id="cs-date" type="date" value={shootDate} onChange={(e) => setShootDate(e.target.value)} className={FIELD} />
              {firstFreeShoot && shootDate === firstFreeShoot && (
                <p className="mt-2 text-sm text-muted-foreground">The next shoot day without a call sheet.</p>
              )}
            </div>
            <div>
              <span id="cs-type" className={LABEL}>
                What kind of day
              </span>
              <div role="radiogroup" aria-labelledby="cs-type" className="flex gap-1 rounded-full bg-surface p-1">
                {SHOOT_TYPES.map((t) => {
                  const on = shootType === t.key;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setShootType(t.key)}
                      className={`min-h-11 flex-1 rounded-full text-[15px] font-semibold transition-colors ${
                        on ? "bg-background text-foreground shadow-[0_1px_2px_rgba(11,18,32,0.08)]" : "text-ink-2 hover:text-foreground"
                      }`}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>
            {next("Continue to location", !shootDate)}
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-6">
            <FlowTitle sub={context}>Where are you shooting?</FlowTitle>
            <div>
              <label htmlFor="cs-loc-name" className={LABEL}>
                Location name
              </label>
              <input
                id="cs-loc-name"
                type="text"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                placeholder="Location 1"
                className={FIELD}
              />
            </div>
            <div>
              <label htmlFor="cs-address" className={LABEL}>
                Address
              </label>
              <textarea
                id="cs-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={3}
                placeholder="Full address"
                className={`${FIELD} h-auto resize-none py-3`}
              />
              {lastAddr && address === lastAddr && (
                <p className="mt-2 text-sm text-muted-foreground">Filled in from your last call sheet.</p>
              )}
            </div>
            {next("Continue to people")}
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-6">
            <FlowTitle sub={context}>Who&rsquo;s on set, and when?</FlowTitle>
            {team.length === 0 ? (
              <p className="rounded-2xl bg-surface px-5 py-6 text-center text-[15px] text-muted-foreground">
                No one on the Team tab yet. Carry on and add people to the call sheet later, or add crew in the Team
                tab first.
              </p>
            ) : (
              <div>
                <p className="mb-2 text-[15px] text-ink-2">
                  <strong className="font-semibold text-foreground">
                    {chosenCrew.length} of {team.length}
                  </strong>{" "}
                  pulled from the Team tab. Leave a time blank for the unit call.
                </p>
                <ul className="[&>*+*]:border-t [&>*+*]:border-line">
                  {team.map((m) => {
                    const on = selected.has(m.id);
                    return (
                      <li key={m.id} className="flex items-center gap-3.5 py-3">
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={on}
                          aria-label={`${on ? "Remove" : "Include"} ${m.name}`}
                          onClick={() => toggle(m.id)}
                          className="relative shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
                        >
                          <Avatar name={m.name} tone={on ? "accent" : "surface"} className={on ? "" : "opacity-50"} />
                          {on && (
                            <span className="absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-foreground text-background">
                              <Check size={10} strokeWidth={3} />
                            </span>
                          )}
                        </button>
                        <div className={`min-w-0 flex-1 ${on ? "" : "opacity-50"}`}>
                          <div className="truncate font-semibold">{m.name}</div>
                          <div className="truncate text-sm text-muted-foreground">{m.role || "No role set"}</div>
                        </div>
                        <input
                          type="time"
                          value={callTimes[m.id] ?? ""}
                          onChange={(e) => setCallTimes((t) => ({ ...t, [m.id]: e.target.value }))}
                          disabled={!on}
                          aria-label={`Call time for ${m.name}`}
                          className="h-11 w-[104px] shrink-0 rounded-[10px] border border-field bg-card px-2 text-center text-[15px] tabular-nums outline-none focus:border-foreground focus:shadow-[0_0_0_3px_var(--focus)] disabled:opacity-40"
                        />
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {next("Continue to schedule")}
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-6">
            <FlowTitle sub="Start from a template. Every row can be edited on the call sheet.">How does the day run?</FlowTitle>
            <div role="radiogroup" aria-label="Schedule template" className="flex gap-1 rounded-full bg-surface p-1">
              {SCHEDULE_TEMPLATES.map((t) => {
                const on = templateKey === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setTemplateKey(t.key)}
                    className={`min-h-11 flex-1 rounded-full px-2 text-sm font-semibold transition-colors ${
                      on ? "bg-background text-foreground shadow-[0_1px_2px_rgba(11,18,32,0.08)]" : "text-ink-2 hover:text-foreground"
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
            <ol className="rounded-2xl bg-surface px-5 py-1 [&>*+*]:border-t [&>*+*]:border-line">
              {template.rows.map((r, i) => (
                <li key={i} className="flex items-center gap-4 py-3 text-[15px]">
                  <span className="w-12 shrink-0 font-semibold tabular-nums">{r.time}</span>
                  <span className="text-ink-2">{r.description}</span>
                </li>
              ))}
            </ol>
            {next("Review")}
          </div>
        )}

        {step === 4 && (
          <div className="flex flex-col gap-6">
            <FlowTitle sub="Check it over. It's saved as a draft, ready to finish and send.">Review the call sheet</FlowTitle>
            <div className="rounded-2xl bg-surface px-5 py-2 [&>*+*]:border-t [&>*+*]:border-line">
              <KV k="Title" v={shootTitle} />
              <KV k="Type" v={typeLabel} />
              <KV k="Date" v={longDate(shootDate) || "—"} />
              <KV k="Unit call" v={callTime} />
              <KV k="People" v={`${chosenCrew.length} on the sheet`} />
              <KV k="Location" v={address || "—"} />
              <KV k="Schedule" v={`${template.label}, ${template.rows.length} rows`} />
            </div>
            {error && (
              <p role="alert" className="rounded-xl bg-bad-bg px-4 py-3 text-[15px] font-medium text-bad">
                {error}
              </p>
            )}
            <button type="button" onClick={create} disabled={busy} className={`${pill("primary")} w-full`}>
              {busy ? "Creating…" : "Create call sheet"}
            </button>
          </div>
        )}
      </FlowFrame>
    </Overlay>
  );
}
