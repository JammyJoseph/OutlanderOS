"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Users, Mail, Calendar, Plus, ChevronLeft, ChevronRight, Sun, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";

type Status = "IN" | "REMOTE" | "HOLIDAY" | "SICK" | "OUT";
type Capacity = "Available" | "Busy" | "At Capacity";

type TeamMember = {
  name: string;
  role: string;
  department: string;
  email: string;
  status: Status;
  initials: string;
  startDate: string;
  color: string;
  holidays: { taken: number; booked: number; allowance: number };
  capacity: Capacity;
  projects: string[];
};

const team: TeamMember[] = [
  {
    name: "Joe Silver",
    role: "Operations & Admin",
    department: "Operations",
    email: "joe@outlandermag.com",
    status: "IN",
    initials: "JS",
    startDate: "Jan 2022",
    color: "bg-[#D4A853]",
    holidays: { taken: 8, booked: 0, allowance: 25 },
    capacity: "Busy",
    projects: ["Finance", "Operations", "Q2 Campaigns"],
  },
  {
    name: "Quinn Titsworth",
    role: "Chief Executive Officer",
    department: "Executive",
    email: "quinn@outlandermag.com",
    status: "REMOTE",
    initials: "QT",
    startDate: "Jun 2020",
    color: "bg-blue-500",
    holidays: { taken: 5, booked: 3, allowance: 25 },
    capacity: "Busy",
    projects: ["Issue 02", "Q2 Campaigns"],
  },
  {
    name: "Shreeya Patel",
    role: "Head of Sales & Partnerships",
    department: "Commercial",
    email: "shreeya@outlandermag.com",
    status: "IN",
    initials: "SP",
    startDate: "Mar 2023",
    color: "bg-emerald-500",
    holidays: { taken: 6, booked: 2, allowance: 25 },
    capacity: "At Capacity",
    projects: ["Q2 Campaigns", "New Business"],
  },
  {
    name: "Callum Reid",
    role: "Content & Social Media Manager",
    department: "Content",
    email: "callum@outlandermag.com",
    status: "IN",
    initials: "CR",
    startDate: "Sep 2024",
    color: "bg-purple-500",
    holidays: { taken: 10, booked: 4, allowance: 25 },
    capacity: "Busy",
    projects: ["Issue 02", "Social Media", "Q2 Campaigns"],
  },
  {
    name: "Patricia Chen",
    role: "Production Manager",
    department: "Production",
    email: "patricia@outlandermag.com",
    status: "HOLIDAY",
    initials: "PC",
    startDate: "Nov 2021",
    color: "bg-pink-500",
    holidays: { taken: 4, booked: 4, allowance: 25 },
    capacity: "Available",
    projects: ["Issue 02", "Q2 Campaigns"],
  },
];

const statusConfig: Record<Status, { label: string; badge: string; dot: string }> = {
  IN: { label: "In Office", badge: "bg-emerald-500/20 text-emerald-400", dot: "bg-emerald-400" },
  REMOTE: { label: "Remote", badge: "bg-blue-500/20 text-blue-400", dot: "bg-blue-400" },
  HOLIDAY: { label: "On Holiday", badge: "bg-amber-500/20 text-amber-400", dot: "bg-amber-400" },
  SICK: { label: "Sick Leave", badge: "bg-red-500/20 text-red-400", dot: "bg-red-400" },
  OUT: { label: "Out", badge: "bg-neutral-500/20 text-neutral-400", dot: "bg-neutral-600" },
};

const capacityConfig: Record<Capacity, string> = {
  Available: "text-emerald-400",
  Busy: "text-amber-400",
  "At Capacity": "text-red-400",
};

// Holiday data — who's off when in April 2026
// key: "YYYY-M-D", value: initials[]
const holidayMap: Record<string, string[]> = {
  // Patricia: April 3-7
  "2026-3-3": ["PC"],
  "2026-3-4": ["PC"],
  "2026-3-5": ["PC"],
  "2026-3-6": ["PC"],
  "2026-3-7": ["PC"],
  // Quinn: April 14-17 (booked)
  "2026-3-14": ["QT"],
  "2026-3-15": ["QT"],
  "2026-3-16": ["QT"],
  "2026-3-17": ["QT"],
  // Shreeya: April 28-30 (booked)
  "2026-3-28": ["SP"],
  "2026-3-29": ["SP"],
  "2026-3-30": ["SP"],
};

const memberColors: Record<string, string> = {
  JS: "bg-[#D4A853] text-black",
  QT: "bg-blue-500 text-white",
  SP: "bg-emerald-500 text-white",
  CR: "bg-purple-500 text-white",
  PC: "bg-pink-500 text-white",
};

function generateCalendar(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = firstDay.getDay();
  const startOffset = (startDow + 6) % 7; // Mon-start
  const days: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) days.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(d);
  while (days.length % 7 !== 0) days.push(null);
  return days;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DOW_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function TeamPage() {
  const [calMonth, setCalMonth] = useState({ year: 2026, month: 3 }); // April 2026

  const calDays = generateCalendar(calMonth.year, calMonth.month);

  const prevMonth = () =>
    setCalMonth((p) => ({
      month: p.month === 0 ? 11 : p.month - 1,
      year: p.month === 0 ? p.year - 1 : p.year,
    }));

  const nextMonth = () =>
    setCalMonth((p) => ({
      month: p.month === 11 ? 0 : p.month + 1,
      year: p.month === 11 ? p.year + 1 : p.year,
    }));

  const getHolidaysForDay = (day: number) => {
    const key = `${calMonth.year}-${calMonth.month}-${day}`;
    return holidayMap[key] ?? [];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-100">Team</h1>
          <p className="text-sm text-neutral-500">{team.length} members</p>
        </div>
        <Button size="sm" className="bg-[#D4A853] text-black hover:bg-[#c49a47]">
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add Member
        </Button>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "In Office", count: team.filter((t) => t.status === "IN").length, color: "text-emerald-400" },
          { label: "Remote", count: team.filter((t) => t.status === "REMOTE").length, color: "text-blue-400" },
          { label: "On Holiday", count: team.filter((t) => t.status === "HOLIDAY").length, color: "text-amber-400" },
          { label: "Total Team", count: team.length, color: "text-neutral-200" },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-neutral-800 bg-neutral-900 p-3">
            <p className="text-[11px] text-neutral-500">{s.label}</p>
            <p className={cn("font-mono text-2xl font-bold", s.color)}>{s.count}</p>
          </div>
        ))}
      </div>

      {/* Team Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {team.map((member) => {
          const status = statusConfig[member.status] ?? statusConfig.OUT;
          const usedPct = ((member.holidays.taken + member.holidays.booked) / member.holidays.allowance) * 100;
          const remaining = member.holidays.allowance - member.holidays.taken - member.holidays.booked;
          return (
            <Card
              key={member.name}
              className="border-neutral-800 bg-neutral-900 transition-colors hover:border-neutral-700"
            >
              <CardContent className="space-y-4 p-4">
                {/* Header */}
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className={cn("text-sm font-bold", member.color)}>
                        {member.initials}
                      </AvatarFallback>
                    </Avatar>
                    <span
                      className={cn(
                        "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-neutral-900",
                        status.dot
                      )}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-neutral-100">{member.name}</p>
                    <p className="truncate text-xs text-neutral-500">{member.role}</p>
                  </div>
                  <Badge className={cn("shrink-0 text-[10px]", status.badge)}>
                    {status.label}
                  </Badge>
                </div>

                {/* Details */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs text-neutral-500">
                    <Mail className="h-3 w-3 shrink-0" />
                    <span className="truncate">{member.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-neutral-500">
                    <Users className="h-3 w-3 shrink-0" />
                    <span>{member.department}</span>
                    <span className="text-neutral-700">·</span>
                    <span className={cn("text-[11px] font-medium", capacityConfig[member.capacity])}>
                      {member.capacity}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-neutral-500">
                    <Calendar className="h-3 w-3 shrink-0" />
                    <span>Started {member.startDate}</span>
                  </div>
                </div>

                {/* Current Projects */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-[11px] text-neutral-600">
                    <Briefcase className="h-3 w-3" />
                    Projects
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {member.projects.map((p) => (
                      <span
                        key={p}
                        className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-400"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Holiday Allowance */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px]">
                    <span className="flex items-center gap-1 text-neutral-500">
                      <Sun className="h-3 w-3" />
                      Holiday
                    </span>
                    <span className="font-mono text-neutral-400">
                      {member.holidays.taken} used · {member.holidays.booked} booked · {remaining} left
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-neutral-800">
                    <div className="flex h-full">
                      <div
                        className="h-full bg-[#D4A853]"
                        style={{ width: `${(member.holidays.taken / member.holidays.allowance) * 100}%` }}
                      />
                      {member.holidays.booked > 0 && (
                        <div
                          className="h-full bg-[#D4A853]/40"
                          style={{ width: `${(member.holidays.booked / member.holidays.allowance) * 100}%` }}
                        />
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between text-[10px] text-neutral-600">
                    <span>0</span>
                    <span>{member.holidays.allowance} days</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Holiday Calendar */}
      <div className="rounded-lg border border-neutral-800 bg-neutral-900">
        <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-[#D4A853]" />
            <h2 className="text-sm font-semibold text-neutral-200">Holiday Calendar</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={prevMonth}
              className="rounded p-1 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[120px] text-center text-sm text-neutral-300">
              {MONTH_NAMES[calMonth.month]} {calMonth.year}
            </span>
            <button
              onClick={nextMonth}
              className="rounded p-1 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          {/* Legend */}
          <div className="flex items-center gap-3">
            {team.map((m) => (
              <div key={m.initials} className="flex items-center gap-1.5">
                <div className={cn("h-3 w-3 rounded-full", m.color)} />
                <span className="text-[10px] text-neutral-500">{m.initials}</span>
              </div>
            ))}
          </div>
        </div>

        {/* DOW Headers */}
        <div className="grid grid-cols-7 border-b border-neutral-800">
          {DOW_LABELS.map((d) => (
            <div
              key={d}
              className="py-2 text-center text-[10px] font-medium uppercase tracking-wider text-neutral-600"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Days */}
        <div className="grid grid-cols-7">
          {calDays.map((day, i) => {
            const offs = day ? getHolidaysForDay(day) : [];
            const isToday = day === 1 && calMonth.month === 3 && calMonth.year === 2026;
            const isWeekend = i % 7 >= 5;
            return (
              <div
                key={i}
                className={cn(
                  "min-h-[70px] border-b border-r border-neutral-800 p-1.5",
                  !day && "bg-neutral-950/40",
                  isWeekend && day && "bg-neutral-950/20",
                  i % 7 === 6 && "border-r-0"
                )}
              >
                {day && (
                  <>
                    <span
                      className={cn(
                        "mb-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-xs",
                        isToday
                          ? "bg-[#D4A853] font-bold text-black"
                          : "text-neutral-500"
                      )}
                    >
                      {day}
                    </span>
                    <div className="flex flex-wrap gap-0.5">
                      {offs.map((initials) => (
                        <div
                          key={initials}
                          className={cn(
                            "flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold",
                            memberColors[initials] ?? "bg-neutral-600 text-white"
                          )}
                          title={team.find((m) => m.initials === initials)?.name}
                        >
                          {initials[0]}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Holiday Allowance Summary Table */}
      <div className="rounded-lg border border-neutral-800 bg-neutral-900">
        <div className="border-b border-neutral-800 px-4 py-3">
          <h2 className="text-sm font-semibold text-neutral-200">Holiday Allowance Summary</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-neutral-800 text-[10px] uppercase tracking-wider text-neutral-600">
                <th className="px-4 py-2 text-left">Name</th>
                <th className="px-4 py-2 text-center">Allowance</th>
                <th className="px-4 py-2 text-center">Used</th>
                <th className="px-4 py-2 text-center">Booked</th>
                <th className="px-4 py-2 text-center">Remaining</th>
                <th className="px-4 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {team.map((m) => {
                const remaining = m.holidays.allowance - m.holidays.taken - m.holidays.booked;
                const status = statusConfig[m.status];
                return (
                  <tr key={m.name} className="border-b border-neutral-800 hover:bg-neutral-800/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className={cn("flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold", m.color)}>
                          {m.initials}
                        </div>
                        <span className="text-neutral-200">{m.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-neutral-400">{m.holidays.allowance}</td>
                    <td className="px-4 py-3 text-center font-mono text-neutral-400">{m.holidays.taken}</td>
                    <td className="px-4 py-3 text-center font-mono text-[#D4A853]">{m.holidays.booked}</td>
                    <td className="px-4 py-3 text-center font-mono text-emerald-400">{remaining}</td>
                    <td className="px-4 py-3">
                      <Badge className={cn("text-[10px]", status.badge)}>{status.label}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
