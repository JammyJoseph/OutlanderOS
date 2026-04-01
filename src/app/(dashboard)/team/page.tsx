"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Users, Mail, Calendar, Plus, ChevronLeft, ChevronRight } from "lucide-react";
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
  color: string;
  capacity: Capacity;
};

const team: TeamMember[] = [
  {
    name: "Joe Silver",
    role: "Operations & Admin",
    department: "Operations",
    email: "joe@outlandermag.com",
    status: "IN",
    initials: "JS",
    color: "bg-[#D4A853]",
    capacity: "Busy",
  },
  {
    name: "Quinn Titsworth",
    role: "Chief Executive Officer",
    department: "Executive",
    email: "quinn@outlandermag.com",
    status: "REMOTE",
    initials: "QT",
    color: "bg-blue-500",
    capacity: "Busy",
  },
  {
    name: "Shreeya Patel",
    role: "Head of Sales & Partnerships",
    department: "Commercial",
    email: "shreeya@outlandermag.com",
    status: "IN",
    initials: "SP",
    color: "bg-emerald-500",
    capacity: "At Capacity",
  },
  {
    name: "Callum Reid",
    role: "Content & Social Media Manager",
    department: "Content",
    email: "callum@outlandermag.com",
    status: "IN",
    initials: "CR",
    color: "bg-purple-500",
    capacity: "Busy",
  },
  {
    name: "Patricia Chen",
    role: "Production Manager",
    department: "Production",
    email: "patricia@outlandermag.com",
    status: "IN",
    initials: "PC",
    color: "bg-pink-500",
    capacity: "Available",
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

function generateCalendar(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = firstDay.getDay();
  const startOffset = (startDow + 6) % 7;
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
  const [calMonth, setCalMonth] = useState({ year: 2026, month: 3 });

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
            <span className="text-xs text-neutral-600">— no holidays booked</span>
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
        </div>

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

        <div className="grid grid-cols-7">
          {calDays.map((day, i) => {
            const isWeekend = i % 7 >= 5;
            return (
              <div
                key={i}
                className={cn(
                  "min-h-[60px] border-b border-r border-neutral-800 p-1.5",
                  !day && "bg-neutral-950/40",
                  isWeekend && day && "bg-neutral-950/20",
                  i % 7 === 6 && "border-r-0"
                )}
              >
                {day && (
                  <span className="text-xs text-neutral-600">{day}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
