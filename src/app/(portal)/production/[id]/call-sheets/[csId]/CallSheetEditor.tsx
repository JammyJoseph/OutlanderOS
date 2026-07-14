"use client";

import { useEffect, useRef, useState } from "react";
import {
  Clock, MapPin, Cloud, Camera, Users, Coffee, Paperclip, FileText,
  GripVertical, UserPlus, Contact as ContactIcon, Building2, Briefcase,
  Phone, Shield, Lock, Route, Aperture, RefreshCw, Check, Plus, Package,
  ChevronDown, ChevronRight, X, Wand2,
} from "lucide-react";
import type {
  AgencyTeamMember, Attachment, CallSheet, CallSheetHeader, CallSheetLocation,
  CallTimeRow, CateringDetails, ClientTeamMember, CrewMember, EquipmentInfo,
  MovementOrder, ProductionCompanyInfo, ProductionMobile, ScheduleItem, Shot,
  ShotStyle, TalentMember, WeatherData,
} from "./types";
import {
  AGENCY_TEAM_ROLES, CLIENT_TEAM_ROLES, CONDUCT_POLICY, CONFIDENTIALITY_NOTICE,
  CREW_ROLE_PRESETS, defaultCallTimes, EQUIPMENT_CATEGORIES, hasCallOverride,
  KIT_TEMPLATES, parseSchedule, sortCallTimes, sortSchedule,
} from "./types";
import { Section, AddButton, DeleteButton, inputCls, smallInputCls, labelCls } from "./shared";
import { PeopleTable } from "./shared";
import { LocationsEditor, MovementOrderEditor } from "./LocationMap";
import { WeatherEditor } from "./WeatherWidget";
import { ShotlistEditor } from "./Shotlist";
import { CallSheetDeliverables } from "./CallSheetDeliverables";
import { CateringEditor } from "./CateringSection";
import { DocumentsEditor } from "./DocumentsSection";
import { DirectoryPicker } from "./DirectoryPicker";

export interface EditorProps {
  shootDate: string; setShootDate: (v: string) => void;
  // The master call time for the whole unit — every crew/talent row inherits it
  // unless that row carries its own override.
  unitCallTime: string; setUnitCallTime: (v: string) => void;
  wrapTime: string; setWrapTime: (v: string) => void;
  schedule: ScheduleItem[]; setSchedule: (v: ScheduleItem[]) => void;
  locations: CallSheetLocation[]; setLocations: (v: CallSheetLocation[]) => void;
  locationLat: number | null; locationLng: number | null;
  setCoords: (lat: number | null, lng: number | null) => void;
  weatherData: WeatherData | null; setWeatherData: (v: WeatherData | null) => void;
  shotlist: Shot[]; setShotlist: (v: Shot[]) => void;
  shotStyle: ShotStyle; setShotStyle: (v: ShotStyle) => void;
  crew: CrewMember[]; setCrew: (v: CrewMember[]) => void;
  talent: TalentMember[]; setTalent: (v: TalentMember[]) => void;
  catering: CateringDetails; setCatering: (v: CateringDetails) => void;
  documents: Attachment[]; setDocuments: (v: Attachment[]) => void;
  notesGeneral: string; setNotesGeneral: (v: string) => void;
  notesSafety: string; setNotesSafety: (v: string) => void;
  notesParking: string; setNotesParking: (v: string) => void;
  // New industry-standard sections
  header: CallSheetHeader; setHeader: (v: CallSheetHeader) => void;
  clientTeam: ClientTeamMember[]; setClientTeam: (v: ClientTeamMember[]) => void;
  agencyTeam: AgencyTeamMember[]; setAgencyTeam: (v: AgencyTeamMember[]) => void;
  productionCompany: ProductionCompanyInfo; setProductionCompany: (v: ProductionCompanyInfo) => void;
  callTimes: CallTimeRow[]; setCallTimes: (v: CallTimeRow[]) => void;
  productionMobiles: ProductionMobile[]; setProductionMobiles: (v: ProductionMobile[]) => void;
  movementOrder: MovementOrder; setMovementOrder: (v: MovementOrder) => void;
  equipment: EquipmentInfo; setEquipment: (v: EquipmentInfo) => void;
  production: CallSheet["production"];
  onSyncDirectory: () => Promise<void>;
}

const iconCls = "text-gray-400 dark:text-gray-500";

export function CallSheetEditor(p: EditorProps) {
  const rosterCount = p.crew.length + p.talent.length;
  const overrideCount = [...p.crew, ...p.talent].filter((m) =>
    hasCallOverride(m, p.unitCallTime)
  ).length;
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState(false);
  const [loadingStaff, setLoadingStaff] = useState(false);

  function handleDrop(target: number) {
    if (dragIndex === null || dragIndex === target) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    const next = [...p.schedule];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(target, 0, moved);
    p.setSchedule(next);
    setDragIndex(null);
    setDragOverIndex(null);
  }

  // Merge the production team into crew, skipping people already listed.
  function importTeam() {
    const team = p.production.teamMembers ?? [];
    if (!team.length) return;
    const existing = new Set(
      p.crew.map((c) => `${(c.name || "").trim().toLowerCase()}|${(c.email || "").trim().toLowerCase()}`)
    );
    const incoming = team
      .filter(
        (m) =>
          !existing.has(`${(m.name || "").trim().toLowerCase()}|${(m.email || "").trim().toLowerCase()}`)
      )
      .map((m) => ({
        role: m.role || "",
        name: m.name,
        // No override — imported crew inherit the unit call.
        callTime: "",
        email: m.email || "",
        phone: m.phone || "",
      }));
    if (incoming.length) p.setCrew([...p.crew, ...incoming]);
  }

  function addFromPicker(people: CrewMember[]) {
    const existing = new Set(
      p.crew.map((c) => `${(c.name || "").trim().toLowerCase()}|${(c.email || "").trim().toLowerCase()}`)
    );
    const incoming = people.filter(
      (m) => !existing.has(`${(m.name || "").trim().toLowerCase()}|${(m.email || "").trim().toLowerCase()}`)
    );
    if (incoming.length) p.setCrew([...p.crew, ...incoming]);
  }

  async function syncDirectory() {
    setSyncing(true);
    try {
      await p.onSyncDirectory();
      setSynced(true);
      setTimeout(() => setSynced(false), 2500);
    } finally {
      setSyncing(false);
    }
  }

  // Auto-fill the Agency Team from active Outlander staff, matching standard roles.
  async function importAgencyStaff() {
    setLoadingStaff(true);
    try {
      const res = await fetch("/api/users");
      const users = (await res.json()) as {
        name: string;
        email: string | null;
        role: string;
        department: string | null;
      }[];
      if (!Array.isArray(users)) return;
      const existing = new Set(p.agencyTeam.map((a) => (a.name || "").trim().toLowerCase()));
      const rows: AgencyTeamMember[] = [];
      for (const want of AGENCY_TEAM_ROLES) {
        const match = users.find(
          (u) =>
            (u.department || "").toLowerCase().includes(want.split(" ")[0].toLowerCase()) ||
            (u.role || "").toLowerCase() === want.toLowerCase()
        );
        rows.push({
          role: want,
          name: match && !existing.has(match.name.toLowerCase()) ? match.name : "",
          phone: "",
          email: match?.email || "",
        });
      }
      // Replace blank default rows but keep anything already typed.
      const merged = p.agencyTeam.length > 0 ? [...p.agencyTeam] : [];
      for (const r of rows) {
        if (!merged.some((m) => m.role === r.role)) merged.push(r);
      }
      p.setAgencyTeam(merged.length ? merged : rows);
    } finally {
      setLoadingStaff(false);
    }
  }

  const billingContact = p.production.campaign?.billingContact ?? null;
  // Budget is NEVER shown on a call sheet — only the client billing contact is
  // surfaced here as a reference. (See portal overhaul rule #6.)
  const hasReference = billingContact != null;
  const clientName =
    p.production.campaign?.client?.name || p.production.clientName || "";

  return (
    <div className="space-y-4">
      {/* 1. Header / Job Info */}
      <Section title="Header & Job Info" icon={<FileText size={15} className={iconCls} />}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Production Company</label>
            <input
              type="text"
              value={p.header.productionCompany}
              onChange={(e) => p.setHeader({ ...p.header, productionCompany: e.target.value })}
              placeholder="Outlander"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Job Number</label>
            <input
              type="text"
              value={p.header.jobNumber}
              onChange={(e) => p.setHeader({ ...p.header, jobNumber: e.target.value })}
              placeholder="e.g. OL-2026-014"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Client</label>
            <input
              type="text"
              value={clientName}
              readOnly
              placeholder="From linked campaign"
              className={`${inputCls} bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400`}
            />
          </div>
          <div>
            <label className={labelCls}>Project Title</label>
            <input
              type="text"
              value={p.production.title}
              readOnly
              className={`${inputCls} bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400`}
            />
          </div>
          <div>
            <label className={labelCls}>Shoot Date</label>
            <input
              type="date"
              value={p.shootDate}
              onChange={(e) => p.setShootDate(e.target.value)}
              className={inputCls}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Unit Call</label>
              <input
                type="time"
                value={p.unitCallTime}
                onChange={(e) => p.setUnitCallTime(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Wrap</label>
              <input
                type="time"
                value={p.wrapTime}
                onChange={(e) => p.setWrapTime(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>
        </div>

        {hasReference && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 pt-4 border-t border-gray-50 dark:border-gray-800">
            {billingContact && (
              <div className="rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-800 px-3.5 py-2.5">
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1">
                  <ContactIcon size={11} /> Client contact
                </p>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                  {billingContact.name}
                  {billingContact.role ? (
                    <span className="text-gray-400 dark:text-gray-500 font-normal"> · {billingContact.role}</span>
                  ) : null}
                </p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  {[billingContact.email, billingContact.phone].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
            )}
          </div>
        )}
      </Section>

      {/* 2. Client Team */}
      <Section
        title="Client Team"
        icon={<Briefcase size={15} className={iconCls} />}
        action={
          p.clientTeam.length === 0 ? (
            <button
              onClick={() =>
                p.setClientTeam(CLIENT_TEAM_ROLES.map((role) => ({ role, name: "" })))
              }
              className="flex items-center gap-1.5 text-xs font-medium text-[#A93B2E]"
            >
              <Plus size={13} /> Add standard roles
            </button>
          ) : undefined
        }
      >
        <RoleNameTable
          rows={p.clientTeam}
          setRows={p.setClientTeam}
          addLabel="Add Client Contact"
          rolePlaceholder="Role (e.g. Art Director)"
        />
      </Section>

      {/* 3. Agency Team */}
      <Section
        title="Agency Team (Outlander)"
        icon={<Users size={15} className={iconCls} />}
        action={
          <button
            onClick={importAgencyStaff}
            disabled={loadingStaff}
            className="flex items-center gap-1.5 text-xs font-medium text-[#A93B2E] disabled:opacity-40"
          >
            {loadingStaff ? <RefreshCw size={13} className="animate-spin" /> : <UserPlus size={13} />}
            Auto-fill from staff
          </button>
        }
      >
        <AgencyTeamTable rows={p.agencyTeam} setRows={p.setAgencyTeam} />
      </Section>

      {/* 4. Production Company */}
      <Section title="Production Company" icon={<Building2 size={15} className={iconCls} />}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className={labelCls}>Company Name</label>
            <input
              type="text"
              value={p.productionCompany.name}
              onChange={(e) => p.setProductionCompany({ ...p.productionCompany, name: e.target.value })}
              placeholder="Production company"
              className={inputCls}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Address</label>
            <textarea
              value={p.productionCompany.address}
              onChange={(e) => p.setProductionCompany({ ...p.productionCompany, address: e.target.value })}
              placeholder="Full address"
              rows={2}
              className={`${inputCls} resize-none`}
            />
          </div>
          <div>
            <label className={labelCls}>Executive Producer</label>
            <input
              type="text"
              value={p.productionCompany.execProducer}
              onChange={(e) => p.setProductionCompany({ ...p.productionCompany, execProducer: e.target.value })}
              placeholder="Exec Producer name"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Producer</label>
            <input
              type="text"
              value={p.productionCompany.producer}
              onChange={(e) => p.setProductionCompany({ ...p.productionCompany, producer: e.target.value })}
              placeholder="Producer name"
              className={inputCls}
            />
          </div>
        </div>
      </Section>

      {/* 6. Production Mobiles */}
      <Section title="Production Mobiles" icon={<Phone size={15} className={iconCls} />}>
        <div className="space-y-2">
          {p.productionMobiles.map((row, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_1fr_32px] gap-2 items-center">
              <input
                type="text"
                value={row.role}
                onChange={(e) =>
                  p.setProductionMobiles(p.productionMobiles.map((r, j) => (j === i ? { ...r, role: e.target.value } : r)))
                }
                placeholder="Role (e.g. 1st AD)"
                className={smallInputCls}
              />
              <input
                type="text"
                value={row.name}
                onChange={(e) =>
                  p.setProductionMobiles(p.productionMobiles.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))
                }
                placeholder="Name"
                className={smallInputCls}
              />
              <input
                type="tel"
                value={row.phone}
                onChange={(e) =>
                  p.setProductionMobiles(p.productionMobiles.map((r, j) => (j === i ? { ...r, phone: e.target.value } : r)))
                }
                placeholder="Phone"
                className={smallInputCls}
              />
              <DeleteButton onClick={() => p.setProductionMobiles(p.productionMobiles.filter((_, j) => j !== i))} />
            </div>
          ))}
          <AddButton
            label="Add Contact"
            onClick={() => p.setProductionMobiles([...p.productionMobiles, { role: "", name: "", phone: "" }])}
          />
        </div>
      </Section>

      {/* 7. Locations */}
      <Section title="Locations" icon={<MapPin size={15} className={iconCls} />}>
        <LocationsEditor locations={p.locations} setLocations={p.setLocations} />
      </Section>

      {/* 8. Movement Order — stops derived from the ordered locations above */}
      <Section title="Movement Order" icon={<Route size={15} className={iconCls} />}>
        <MovementOrderEditor
          movementOrder={p.movementOrder}
          setMovementOrder={p.setMovementOrder}
          lat={p.locations[0]?.lat ?? p.locationLat}
          lng={p.locations[0]?.lng ?? p.locationLng}
          locations={p.locations}
          schedule={p.schedule}
        />
      </Section>

      {/* 9. Weather — uses the first location's coordinates */}
      <Section title="Weather" icon={<Cloud size={15} className={iconCls} />}>
        <WeatherEditor
          lat={p.locations[0]?.lat ?? p.locationLat}
          lng={p.locations[0]?.lng ?? p.locationLng}
          shootDate={p.shootDate}
          weatherData={p.weatherData}
          setWeatherData={p.setWeatherData}
        />
      </Section>

      {/* 10. Schedule & Call Times — merged input, split output */}
      <Section title="Schedule & Call Times" icon={<Clock size={15} className={iconCls} />}>
        <div className="space-y-4">
          {/* Unit Call — the master time everyone on the sheet inherits. */}
          <div className="rounded-xl border border-[#A93B2E]/20 bg-[#A93B2E]/[0.03] dark:bg-[#A93B2E]/10 px-4 py-3">
            <div className="flex items-center gap-4 flex-wrap">
              <div>
                <label className={labelCls}>Unit Call</label>
                <input
                  type="time"
                  value={p.unitCallTime}
                  onChange={(e) => p.setUnitCallTime(e.target.value)}
                  className={`${inputCls} w-[130px] font-semibold`}
                />
              </div>
              <div>
                <label className={labelCls}>Wrap</label>
                <input
                  type="time"
                  value={p.wrapTime}
                  onChange={(e) => p.setWrapTime(e.target.value)}
                  className={`${inputCls} w-[130px]`}
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 flex-1 min-w-[220px] leading-snug">
                The default call time for everyone on the unit. Crew and talent
                inherit it unless you set a custom time on their row below —{" "}
                {overrideCount > 0 ? (
                  <span className="font-semibold text-[#A93B2E]">
                    {overrideCount} {overrideCount === 1 ? "person has" : "people have"} a custom call.
                  </span>
                ) : (
                  <span>everyone is on the unit call right now.</span>
                )}
              </p>
            </div>
          </div>

          <p className="text-xs text-gray-400 dark:text-gray-500">
            Enter the whole day in one place. Call-time entries (crew call, talent
            call, wrap, unit call, cast call…) are auto-detected and shown separately
            under CALL TIMES on the call sheet; everything else becomes the Run of the
            Day.
          </p>

          <ScheduleImporter
            onParsed={({ callTimes, schedule }) => {
              if (callTimes.length) p.setCallTimes(sortCallTimes([...p.callTimes, ...callTimes]));
              if (schedule.length) p.setSchedule(sortSchedule([...p.schedule, ...schedule]));
            }}
          />

          {/* Call Times (auto-detected from the paste, or added manually) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Call Times
              </p>
              {p.callTimes.length === 0 && (
                <button
                  onClick={() => p.setCallTimes(defaultCallTimes())}
                  className="flex items-center gap-1.5 text-xs font-medium text-[#A93B2E]"
                >
                  <Plus size={13} /> Use template
                </button>
              )}
            </div>
            <div className="space-y-2">
              {p.callTimes.map((row, i) => (
                <div key={i} className="grid grid-cols-[110px_1fr_32px] gap-2 items-center">
                  <input
                    type="time"
                    value={row.time}
                    onChange={(e) =>
                      p.setCallTimes(p.callTimes.map((r, j) => (j === i ? { ...r, time: e.target.value } : r)))
                    }
                    // Rows re-sort on blur, not on change: a row that jumped as
                    // you typed would take the focused input with it.
                    onBlur={() => p.setCallTimes(sortCallTimes(p.callTimes))}
                    className={smallInputCls}
                  />
                  <input
                    type="text"
                    value={row.department}
                    onChange={(e) =>
                      p.setCallTimes(p.callTimes.map((r, j) => (j === i ? { ...r, department: e.target.value } : r)))
                    }
                    placeholder="Department (e.g. Crew Call, Talent Call)"
                    className={smallInputCls}
                  />
                  <DeleteButton onClick={() => p.setCallTimes(p.callTimes.filter((_, j) => j !== i))} />
                </div>
              ))}
              <AddButton
                label="Add Call Time"
                onClick={() => p.setCallTimes([...p.callTimes, { time: "", department: "" }])}
              />
            </div>
          </div>

          {/* Run of the Day (the rest of the schedule) */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
              Run of the Day
            </p>
            <div className="space-y-2">
              {p.locations.length > 0 && (
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  Tag a block with its location and the Movement Order will auto-insert a travel
                  leg (with departure/arrival times) whenever the location changes.
                </p>
              )}
              {p.schedule.map((item, i) => (
            <div
              key={i}
              draggable
              onDragStart={(e) => {
                setDragIndex(i);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (dragOverIndex !== i) setDragOverIndex(i);
              }}
              onDragLeave={() => setDragOverIndex((d) => (d === i ? null : d))}
              onDrop={(e) => {
                e.preventDefault();
                handleDrop(i);
              }}
              onDragEnd={() => {
                setDragIndex(null);
                setDragOverIndex(null);
              }}
              className={`grid ${
                p.locations.length > 0
                  ? "grid-cols-[20px_100px_1fr_1fr_130px_32px]"
                  : "grid-cols-[20px_100px_1fr_1fr_32px]"
              } gap-2 items-center rounded-lg transition-colors ${
                dragOverIndex === i && dragIndex !== null && dragIndex !== i
                  ? "bg-red-50/70 dark:bg-red-900/30 ring-1 ring-[#A93B2E]/30"
                  : dragIndex === i
                  ? "opacity-50"
                  : ""
              }`}
            >
              <span className="cursor-grab active:cursor-grabbing text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 flex justify-center">
                <GripVertical size={14} />
              </span>
              <input
                type="time"
                value={item.time}
                onChange={(e) =>
                  p.setSchedule(p.schedule.map((s, j) => (j === i ? { ...s, time: e.target.value } : s)))
                }
                onBlur={() => p.setSchedule(sortSchedule(p.schedule))}
                className={smallInputCls}
              />
              <input
                type="text"
                value={item.description}
                onChange={(e) =>
                  p.setSchedule(
                    p.schedule.map((s, j) => (j === i ? { ...s, description: e.target.value } : s))
                  )
                }
                placeholder="Activity"
                className={smallInputCls}
              />
              <input
                type="text"
                value={item.notes}
                onChange={(e) =>
                  p.setSchedule(p.schedule.map((s, j) => (j === i ? { ...s, notes: e.target.value } : s)))
                }
                placeholder="Notes"
                className={smallInputCls}
              />
              {p.locations.length > 0 && (
                <select
                  value={item.locationRef ?? ""}
                  onChange={(e) =>
                    p.setSchedule(
                      p.schedule.map((s, j) =>
                        j === i ? { ...s, locationRef: e.target.value || undefined } : s
                      )
                    )
                  }
                  className={smallInputCls}
                  title="Location for this block"
                >
                  <option value="">— location —</option>
                  {p.locations.map((l, li) => {
                    const name = l.name || `Location ${li + 1}`;
                    return (
                      <option key={li} value={name}>
                        {name}
                      </option>
                    );
                  })}
                </select>
              )}
              <DeleteButton onClick={() => p.setSchedule(p.schedule.filter((_, j) => j !== i))} />
            </div>
          ))}
              <AddButton
                label="Add Row"
                onClick={() => p.setSchedule([...p.schedule, { time: "", description: "", notes: "" }])}
              />
            </div>
          </div>
        </div>
      </Section>

      {/* 11. Shotlist */}
      <Section title="Shotlist" icon={<Camera size={15} className={iconCls} />}>
        <ShotlistEditor
          shotlist={p.shotlist}
          setShotlist={p.setShotlist}
          shotStyle={p.shotStyle}
          setShotStyle={p.setShotStyle}
          locations={p.locations}
          productionId={p.production.id}
        />
      </Section>

      {/* 11b. Deliverables — synced two-way with the project Deliverables tab */}
      <Section title="Deliverables" icon={<Package size={15} className={iconCls} />}>
        <CallSheetDeliverables productionId={p.production.id} />
      </Section>

      {/* 12. Conduct Policy (auto-included, read-only) */}
      <Section title="Conduct Policy" icon={<Shield size={15} className={iconCls} />}>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
          Auto-included on every call sheet — not editable.
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap leading-relaxed">{CONDUCT_POLICY}</p>
      </Section>

      {/* 13. Confidentiality Notice (auto-included, read-only) */}
      <Section title="Confidentiality Notice" icon={<Lock size={15} className={iconCls} />}>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
          Auto-included on every call sheet — not editable.
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap leading-relaxed">{CONFIDENTIALITY_NOTICE}</p>
      </Section>

      {/* 14. Unit List (Crew) */}
      <Section
        title="Unit List (Crew)"
        icon={<Users size={15} className={iconCls} />}
        action={
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPickerOpen(true)}
              className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            >
              <ContactIcon size={13} /> Import Directory
            </button>
            {(p.production.teamMembers ?? []).length > 0 && (
              <button
                onClick={importTeam}
                className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                <UserPlus size={13} /> Import Team
              </button>
            )}
            <button
              onClick={syncDirectory}
              disabled={syncing || p.crew.length === 0}
              className="flex items-center gap-1.5 text-xs font-medium text-[#A93B2E] disabled:opacity-40"
              title="Save crew to the Directory with this production as a credit"
            >
              {syncing ? (
                <RefreshCw size={13} className="animate-spin" />
              ) : synced ? (
                <Check size={13} className="text-emerald-600 dark:text-emerald-400" />
              ) : (
                <RefreshCw size={13} />
              )}
              {synced ? "Saved" : "Save to Directory"}
            </button>
          </div>
        }
      >
        <PeopleTable
          people={p.crew}
          setPeople={(v) => p.setCrew(v as CrewMember[])}
          unitCallTime={p.unitCallTime}
          addLabel="Add Crew"
          rolePresets={CREW_ROLE_PRESETS}
        />
      </Section>

      {/* 15. Talent */}
      <Section
        title="Talent / Cast"
        icon={<Users size={15} className={iconCls} />}
        action={
          <a
            href="/directory"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
          >
            <ContactIcon size={12} /> Browse Directory
          </a>
        }
      >
        <PeopleTable
          people={p.talent}
          setPeople={(v) => p.setTalent(v as TalentMember[])}
          unitCallTime={p.unitCallTime}
          addLabel="Add Talent"
        />
      </Section>

      {/* 16. Catering */}
      <Section title="Catering" icon={<Coffee size={15} className={iconCls} />}>
        <CateringEditor catering={p.catering} setCatering={p.setCatering} rosterCount={rosterCount} />
      </Section>

      {/* 17. Equipment (Phase 4E — standard departments, directory suppliers, kit templates) */}
      <Section title="Equipment" icon={<Aperture size={15} className={iconCls} />}>
        <EquipmentEditor equipment={p.equipment} setEquipment={p.setEquipment} />
      </Section>

      {/* 18. Documents */}
      <Section title="Documents" icon={<Paperclip size={15} className={iconCls} />}>
        <DocumentsEditor documents={p.documents} setDocuments={p.setDocuments} />
      </Section>

      {/* 19. Notes */}
      <Section title="Notes" icon={<FileText size={15} className={iconCls} />}>
        <div className="space-y-3">
          {[
            { label: "Production Notes", value: p.notesGeneral, set: p.setNotesGeneral, ph: "General production notes..." },
            { label: "Safety Notes", value: p.notesSafety, set: p.setNotesSafety, ph: "Safety briefing, hazards..." },
            { label: "Parking Instructions", value: p.notesParking, set: p.setNotesParking, ph: "Parking details..." },
          ].map(({ label, value, set, ph }) => (
            <div key={label}>
              <label className={labelCls}>{label}</label>
              <textarea
                value={value}
                onChange={(e) => set(e.target.value)}
                placeholder={ph}
                rows={2}
                className={`${inputCls} resize-none`}
              />
            </div>
          ))}
        </div>
      </Section>

      {pickerOpen && (
        <DirectoryPicker
          onClose={() => setPickerOpen(false)}
          onAdd={addFromPicker}
          // Blank = no override; people added from the directory inherit the unit call.
          defaultCallTime=""
        />
      )}
    </div>
  );
}

// ── Paste-a-schedule importer ─────────────────────────────────────────────────
// Merged input: one pasted "full schedule" is split into call-time rows and
// run-of-day schedule blocks (see parseSchedule). Output stays split.
function ScheduleImporter({
  onParsed,
}: {
  onParsed: (r: { callTimes: CallTimeRow[]; schedule: ScheduleItem[] }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState("");

  function run() {
    if (!raw.trim()) return;
    const parsed = parseSchedule(raw);
    if (parsed.callTimes.length === 0 && parsed.schedule.length === 0) return;
    onParsed(parsed);
    setRaw("");
    setOpen(false);
  }

  return (
    <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
      >
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        <Wand2 size={13} /> Paste full schedule
      </button>
      {open && (
        <div className="mt-3 space-y-2">
          <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-snug">
            One entry per line, starting with a time — e.g.{" "}
            <span className="font-mono">08:00 Crew Call</span>,{" "}
            <span className="font-mono">08:30 Talent Call</span>,{" "}
            <span className="font-mono">09:00 Breakfast &amp; setup</span>,{" "}
            <span className="font-mono">18:00 Wrap</span>. Call times are detected
            automatically; everything else becomes a schedule block.
          </p>
          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder={
              "08:00 Crew Call\n08:30 Talent Call\n09:00 HMU & styling\n10:00 Main Unit Call — first setup\n13:00 Lunch\n18:00 Wrap"
            }
            rows={7}
            className={`${inputCls} resize-y font-mono text-xs`}
          />
          <div className="flex items-center gap-2">
            <button
              onClick={run}
              disabled={!raw.trim()}
              className="flex items-center gap-1.5 bg-[#A93B2E] text-white px-3.5 py-1.5 rounded-lg text-xs font-medium disabled:opacity-40"
            >
              <Wand2 size={13} /> Parse full schedule
            </button>
            <span className="text-[11px] text-gray-400 dark:text-gray-500">
              Parsed rows are appended below — edit any field after.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Small editor tables ──

function RoleNameTable({
  rows,
  setRows,
  addLabel,
  rolePlaceholder,
}: {
  rows: ClientTeamMember[];
  setRows: (v: ClientTeamMember[]) => void;
  addLabel: string;
  rolePlaceholder: string;
}) {
  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_32px] gap-2 items-center">
          <input
            type="text"
            value={row.role}
            onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, role: e.target.value } : r)))}
            placeholder={rolePlaceholder}
            className={smallInputCls}
          />
          <input
            type="text"
            value={row.name}
            onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))}
            placeholder="Name"
            className={smallInputCls}
          />
          <DeleteButton onClick={() => setRows(rows.filter((_, j) => j !== i))} />
        </div>
      ))}
      <AddButton label={addLabel} onClick={() => setRows([...rows, { role: "", name: "" }])} />
    </div>
  );
}

function AgencyTeamTable({
  rows,
  setRows,
}: {
  rows: AgencyTeamMember[];
  setRows: (v: AgencyTeamMember[]) => void;
}) {
  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_1fr_1fr_32px] gap-2 items-center">
          <input
            type="text"
            value={row.role}
            onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, role: e.target.value } : r)))}
            placeholder="Role"
            className={smallInputCls}
          />
          <input
            type="text"
            value={row.name}
            onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))}
            placeholder="Name"
            className={smallInputCls}
          />
          <input
            type="tel"
            value={row.phone}
            onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, phone: e.target.value } : r)))}
            placeholder="Phone"
            className={smallInputCls}
          />
          <input
            type="email"
            value={row.email}
            onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, email: e.target.value } : r)))}
            placeholder="Email"
            className={smallInputCls}
          />
          <DeleteButton onClick={() => setRows(rows.filter((_, j) => j !== i))} />
        </div>
      ))}
      <AddButton
        label="Add Team Member"
        onClick={() => setRows([...rows, { role: "", name: "", phone: "", email: "" }])}
      />
    </div>
  );
}

// ── Equipment editor (Phase 4E) ──────────────────────────────────────────────
interface SupplierContact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  category: string;
}

function EquipmentEditor({
  equipment,
  setEquipment,
}: {
  equipment: EquipmentInfo;
  setEquipment: (v: EquipmentInfo) => void;
}) {
  const [suppliers, setSuppliers] = useState<SupplierContact[]>([]);

  // Equipment/Rental suppliers from the directory for one-click supplier fill.
  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/contacts?category=Equipment&radar=false").then((r) => r.json()).catch(() => []),
      fetch("/api/contacts?category=Rental&radar=false").then((r) => r.json()).catch(() => []),
    ])
      .then(([a, b]) => {
        const list = [
          ...(Array.isArray(a) ? a : a?.data ?? []),
          ...(Array.isArray(b) ? b : b?.data ?? []),
        ];
        // De-dup by id.
        const seen = new Set<string>();
        const unique = list.filter((c: SupplierContact) => {
          if (seen.has(c.id)) return false;
          seen.add(c.id);
          return true;
        });
        if (active) setSuppliers(unique);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  function setField(key: string, value: string) {
    setEquipment({ ...equipment, [key]: value } as EquipmentInfo);
  }

  function pickSupplier(catKey: string, c: SupplierContact) {
    setEquipment({
      ...equipment,
      [`${catKey}Supplier`]: c.company || c.name,
      [`${catKey}Contact`]: c.name,
      [`${catKey}Email`]: c.email || "",
    } as EquipmentInfo);
  }

  function applyKitTemplate(items: string[]) {
    const existing = equipment.kitList ?? [];
    const merged = [...existing];
    for (const it of items) if (!merged.includes(it)) merged.push(it);
    setEquipment({ ...equipment, kitList: merged });
  }

  const kitList = equipment.kitList ?? [];

  return (
    <div className="space-y-4">
      {EQUIPMENT_CATEGORIES.map((cat) => {
        const eq = equipment as unknown as Record<string, unknown>;
        const supplier = eq[`${cat.key}Supplier`] as string | undefined;
        const contact = eq[`${cat.key}Contact`] as string | undefined;
        const email = eq[`${cat.key}Email`] as string | undefined;
        return (
          <div key={cat.key}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                {cat.label}
              </p>
              <SupplierPicker suppliers={suppliers} onPick={(c) => pickSupplier(cat.key, c)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                value={supplier ?? ""}
                onChange={(e) => setField(`${cat.key}Supplier`, e.target.value)}
                placeholder="Supplier"
                className={inputCls}
              />
              <input
                type="text"
                value={contact ?? ""}
                onChange={(e) => setField(`${cat.key}Contact`, e.target.value)}
                placeholder="Contact name"
                className={inputCls}
              />
              <input
                type="email"
                value={email ?? ""}
                onChange={(e) => setField(`${cat.key}Email`, e.target.value)}
                placeholder="Email"
                className={inputCls}
              />
            </div>
          </div>
        );
      })}

      {/* Kit list + templates */}
      <div>
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <label className={labelCls}>Kit List</label>
          <div className="flex items-center gap-1.5 flex-wrap">
            {KIT_TEMPLATES.map((t) => (
              <button
                key={t.name}
                onClick={() => applyKitTemplate(t.items)}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-[#A93B2E] border border-[#A93B2E]/30 rounded-full px-2.5 py-1 hover:bg-[#A93B2E]/5"
                title={`Add: ${t.items.join(", ")}`}
              >
                <Wand2 size={11} /> {t.name}
              </button>
            ))}
          </div>
        </div>
        {kitList.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {kitList.map((item, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full pl-2.5 pr-1 py-1"
              >
                {item}
                <button
                  onClick={() => setEquipment({ ...equipment, kitList: kitList.filter((_, j) => j !== i) })}
                  className="text-gray-400 hover:text-red-500"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
        <textarea
          value={equipment.otherNotes}
          onChange={(e) => setEquipment({ ...equipment, otherNotes: e.target.value })}
          placeholder="Other equipment notes — special kit, consumables…"
          rows={2}
          className={`${inputCls} resize-none`}
        />
      </div>
    </div>
  );
}

function SupplierPicker({
  suppliers,
  onPick,
}: {
  suppliers: SupplierContact[];
  onPick: (c: SupplierContact) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (suppliers.length === 0) return null;
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
      >
        <ContactIcon size={12} /> From Directory <ChevronDown size={11} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 max-h-56 w-64 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 py-1 shadow-xl">
          {suppliers.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                onPick(c);
                setOpen(false);
              }}
              className="flex w-full flex-col px-3 py-1.5 text-left hover:bg-amber-50 dark:hover:bg-amber-900/30"
            >
              <span className="text-[12px] font-medium text-gray-800 dark:text-gray-200">
                {c.company || c.name}
              </span>
              <span className="text-[11px] text-gray-400">
                {[c.name, c.email].filter(Boolean).join(" · ")}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
