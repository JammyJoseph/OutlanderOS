"use client";

import { useState } from "react";
import {
  Clock, MapPin, Cloud, Camera, Users, Coffee, Paperclip, FileText,
  GripVertical, UserPlus, Wallet, Contact as ContactIcon, Building2, Briefcase,
  Phone, Shield, Lock, Route, Aperture, RefreshCw, Check, Plus,
} from "lucide-react";
import type {
  AgencyTeamMember, Attachment, CallSheet, CallSheetHeader, CallTimeRow,
  CateringDetails, ClientTeamMember, CrewMember, EquipmentInfo, LocationData,
  MovementOrder, ProductionCompanyInfo, ProductionMobile, ScheduleItem, Shot,
  TalentMember, WeatherData,
} from "./types";
import {
  AGENCY_TEAM_ROLES, CLIENT_TEAM_ROLES, CONDUCT_POLICY, CONFIDENTIALITY_NOTICE,
  CREW_ROLE_PRESETS, defaultCallTimes,
} from "./types";
import { Section, AddButton, DeleteButton, inputCls, smallInputCls, labelCls } from "./shared";
import { PeopleTable } from "./shared";
import { LocationEditor, MovementOrderEditor } from "./LocationMap";
import { WeatherEditor } from "./WeatherWidget";
import { ShotlistEditor } from "./Shotlist";
import { CateringEditor } from "./CateringSection";
import { DocumentsEditor } from "./DocumentsSection";
import { DirectoryPicker } from "./DirectoryPicker";

export interface EditorProps {
  shootDate: string; setShootDate: (v: string) => void;
  callTime: string; setCallTime: (v: string) => void;
  wrapTime: string; setWrapTime: (v: string) => void;
  schedule: ScheduleItem[]; setSchedule: (v: ScheduleItem[]) => void;
  location: LocationData; setLocation: (v: LocationData) => void;
  locationLat: number | null; locationLng: number | null;
  setCoords: (lat: number | null, lng: number | null) => void;
  weatherData: WeatherData | null; setWeatherData: (v: WeatherData | null) => void;
  shotlist: Shot[]; setShotlist: (v: Shot[]) => void;
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

const iconCls = "text-gray-400";

function gbp(n: number): string {
  return n.toLocaleString("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  });
}

export function CallSheetEditor(p: EditorProps) {
  const rosterCount = p.crew.length + p.talent.length;
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
        callTime: p.callTime || "",
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
  const hasReference = p.production.budgetTotal != null || billingContact != null;
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
              className={`${inputCls} bg-gray-50 text-gray-500`}
            />
          </div>
          <div>
            <label className={labelCls}>Project Title</label>
            <input
              type="text"
              value={p.production.title}
              readOnly
              className={`${inputCls} bg-gray-50 text-gray-500`}
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
              <label className={labelCls}>Main Call</label>
              <input
                type="time"
                value={p.callTime}
                onChange={(e) => p.setCallTime(e.target.value)}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 pt-4 border-t border-gray-50">
            {p.production.budgetTotal != null && (
              <div className="rounded-xl bg-gray-50 border border-gray-100 px-3.5 py-2.5">
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">
                  <Wallet size={11} /> Budget reference
                </p>
                <p className="text-sm font-semibold text-gray-800">
                  {gbp(p.production.budgetTotal)}
                </p>
              </div>
            )}
            {billingContact && (
              <div className="rounded-xl bg-gray-50 border border-gray-100 px-3.5 py-2.5">
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">
                  <ContactIcon size={11} /> Client contact
                </p>
                <p className="text-sm font-semibold text-gray-800">
                  {billingContact.name}
                  {billingContact.role ? (
                    <span className="text-gray-400 font-normal"> · {billingContact.role}</span>
                  ) : null}
                </p>
                <p className="text-[11px] text-gray-500">
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
              className="flex items-center gap-1.5 text-xs font-medium text-[#ff4444]"
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
            className="flex items-center gap-1.5 text-xs font-medium text-[#ff4444] disabled:opacity-40"
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

      {/* 5. Call Times */}
      <Section
        title="Call Times"
        icon={<Clock size={15} className={iconCls} />}
        action={
          p.callTimes.length === 0 ? (
            <button
              onClick={() => p.setCallTimes(defaultCallTimes())}
              className="flex items-center gap-1.5 text-xs font-medium text-[#ff4444]"
            >
              <Plus size={13} /> Use template
            </button>
          ) : undefined
        }
      >
        <div className="space-y-2">
          {p.callTimes.map((row, i) => (
            <div key={i} className="grid grid-cols-[110px_1fr_32px] gap-2 items-center">
              <input
                type="time"
                value={row.time}
                onChange={(e) =>
                  p.setCallTimes(p.callTimes.map((r, j) => (j === i ? { ...r, time: e.target.value } : r)))
                }
                className={smallInputCls}
              />
              <input
                type="text"
                value={row.department}
                onChange={(e) =>
                  p.setCallTimes(p.callTimes.map((r, j) => (j === i ? { ...r, department: e.target.value } : r)))
                }
                placeholder="Department"
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

      {/* 7. Location */}
      <Section title="Location" icon={<MapPin size={15} className={iconCls} />}>
        <LocationEditor
          location={p.location}
          setLocation={p.setLocation}
          lat={p.locationLat}
          lng={p.locationLng}
          onCoordsChange={p.setCoords}
        />
      </Section>

      {/* 8. Movement Order */}
      <Section title="Movement Order" icon={<Route size={15} className={iconCls} />}>
        <MovementOrderEditor
          movementOrder={p.movementOrder}
          setMovementOrder={p.setMovementOrder}
          lat={p.locationLat}
          lng={p.locationLng}
        />
      </Section>

      {/* 9. Weather */}
      <Section title="Weather" icon={<Cloud size={15} className={iconCls} />}>
        <WeatherEditor
          lat={p.locationLat}
          lng={p.locationLng}
          shootDate={p.shootDate}
          weatherData={p.weatherData}
          setWeatherData={p.setWeatherData}
        />
      </Section>

      {/* 10. Schedule */}
      <Section title="Schedule" icon={<Clock size={15} className={iconCls} />}>
        <div className="space-y-2">
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
              className={`grid grid-cols-[20px_100px_1fr_1fr_32px] gap-2 items-center rounded-lg transition-colors ${
                dragOverIndex === i && dragIndex !== null && dragIndex !== i
                  ? "bg-red-50/70 ring-1 ring-[#ff4444]/30"
                  : dragIndex === i
                  ? "opacity-50"
                  : ""
              }`}
            >
              <span className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 flex justify-center">
                <GripVertical size={14} />
              </span>
              <input
                type="time"
                value={item.time}
                onChange={(e) =>
                  p.setSchedule(p.schedule.map((s, j) => (j === i ? { ...s, time: e.target.value } : s)))
                }
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
              <DeleteButton onClick={() => p.setSchedule(p.schedule.filter((_, j) => j !== i))} />
            </div>
          ))}
          <AddButton
            label="Add Row"
            onClick={() => p.setSchedule([...p.schedule, { time: "", description: "", notes: "" }])}
          />
        </div>
      </Section>

      {/* 11. Shotlist */}
      <Section title="Shotlist" icon={<Camera size={15} className={iconCls} />}>
        <ShotlistEditor shotlist={p.shotlist} setShotlist={p.setShotlist} />
      </Section>

      {/* 12. Conduct Policy (auto-included, read-only) */}
      <Section title="Conduct Policy" icon={<Shield size={15} className={iconCls} />}>
        <p className="text-xs text-gray-400 mb-2">
          Auto-included on every call sheet — not editable.
        </p>
        <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{CONDUCT_POLICY}</p>
      </Section>

      {/* 13. Confidentiality Notice (auto-included, read-only) */}
      <Section title="Confidentiality Notice" icon={<Lock size={15} className={iconCls} />}>
        <p className="text-xs text-gray-400 mb-2">
          Auto-included on every call sheet — not editable.
        </p>
        <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{CONFIDENTIALITY_NOTICE}</p>
      </Section>

      {/* 14. Unit List (Crew) */}
      <Section
        title="Unit List (Crew)"
        icon={<Users size={15} className={iconCls} />}
        action={
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPickerOpen(true)}
              className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-800"
            >
              <ContactIcon size={13} /> Import Directory
            </button>
            {(p.production.teamMembers ?? []).length > 0 && (
              <button
                onClick={importTeam}
                className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-800"
              >
                <UserPlus size={13} /> Import Team
              </button>
            )}
            <button
              onClick={syncDirectory}
              disabled={syncing || p.crew.length === 0}
              className="flex items-center gap-1.5 text-xs font-medium text-[#ff4444] disabled:opacity-40"
              title="Save crew to the Directory with this production as a credit"
            >
              {syncing ? (
                <RefreshCw size={13} className="animate-spin" />
              ) : synced ? (
                <Check size={13} className="text-emerald-600" />
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
            className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-800"
          >
            <ContactIcon size={12} /> Browse Directory
          </a>
        }
      >
        <PeopleTable
          people={p.talent}
          setPeople={(v) => p.setTalent(v as TalentMember[])}
          addLabel="Add Talent"
        />
      </Section>

      {/* 16. Catering */}
      <Section title="Catering" icon={<Coffee size={15} className={iconCls} />}>
        <CateringEditor catering={p.catering} setCatering={p.setCatering} rosterCount={rosterCount} />
      </Section>

      {/* 17. Equipment */}
      <Section title="Equipment" icon={<Aperture size={15} className={iconCls} />}>
        <div className="space-y-4">
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Camera</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                value={p.equipment.cameraSupplier}
                onChange={(e) => p.setEquipment({ ...p.equipment, cameraSupplier: e.target.value })}
                placeholder="Supplier"
                className={inputCls}
              />
              <input
                type="text"
                value={p.equipment.cameraContact}
                onChange={(e) => p.setEquipment({ ...p.equipment, cameraContact: e.target.value })}
                placeholder="Contact name"
                className={inputCls}
              />
              <input
                type="email"
                value={p.equipment.cameraEmail}
                onChange={(e) => p.setEquipment({ ...p.equipment, cameraEmail: e.target.value })}
                placeholder="Email"
                className={inputCls}
              />
            </div>
          </div>
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Lighting</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                value={p.equipment.lightingSupplier}
                onChange={(e) => p.setEquipment({ ...p.equipment, lightingSupplier: e.target.value })}
                placeholder="Supplier"
                className={inputCls}
              />
              <input
                type="text"
                value={p.equipment.lightingContact}
                onChange={(e) => p.setEquipment({ ...p.equipment, lightingContact: e.target.value })}
                placeholder="Contact name"
                className={inputCls}
              />
              <input
                type="email"
                value={p.equipment.lightingEmail}
                onChange={(e) => p.setEquipment({ ...p.equipment, lightingEmail: e.target.value })}
                placeholder="Email"
                className={inputCls}
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>Other Equipment Notes</label>
            <textarea
              value={p.equipment.otherNotes}
              onChange={(e) => p.setEquipment({ ...p.equipment, otherNotes: e.target.value })}
              placeholder="Grip, sound, special equipment…"
              rows={2}
              className={`${inputCls} resize-none`}
            />
          </div>
        </div>
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
          defaultCallTime={p.callTime}
        />
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
