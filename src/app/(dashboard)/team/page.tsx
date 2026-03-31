import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Users, Mail, Calendar, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

const team = [
  {
    name: "Joe Silver",
    role: "Operations & Admin",
    department: "Operations",
    email: "joe@outlandermag.com",
    status: "IN",
    initials: "JS",
    startDate: "Jan 2022",
    holidays: { taken: 8, allowance: 25 },
    color: "bg-[#D4A853]",
  },
  {
    name: "Quinn Titsworth",
    role: "Chief Executive Officer",
    department: "Executive",
    email: "quinn@outlandermag.com",
    status: "IN",
    initials: "QT",
    startDate: "Jun 2020",
    holidays: { taken: 5, allowance: 30 },
    color: "bg-blue-500",
  },
  {
    name: "Shreeya Patel",
    role: "Head of Sales & Partnerships",
    department: "Commercial",
    email: "shreeya@outlandermag.com",
    status: "IN",
    initials: "SH",
    startDate: "Mar 2023",
    holidays: { taken: 4, allowance: 25 },
    color: "bg-emerald-500",
  },
  {
    name: "Callum Reid",
    role: "Content & Social Media Manager",
    department: "Content",
    email: "callum@outlandermag.com",
    status: "REMOTE",
    initials: "CA",
    startDate: "Sep 2024",
    holidays: { taken: 2, allowance: 25 },
    color: "bg-purple-500",
  },
  {
    name: "Patricia Chen",
    role: "Production Manager",
    department: "Production",
    email: "patricia@outlandermag.com",
    status: "HOLIDAY",
    initials: "PA",
    startDate: "Nov 2021",
    holidays: { taken: 12, allowance: 25 },
    color: "bg-pink-500",
  },
];

const statusConfig: Record<string, { label: string; badge: string; dot: string }> = {
  IN: { label: "In office", badge: "bg-emerald-500/20 text-emerald-400", dot: "bg-emerald-400" },
  REMOTE: { label: "Remote", badge: "bg-blue-500/20 text-blue-400", dot: "bg-blue-400" },
  HOLIDAY: { label: "On holiday", badge: "bg-amber-500/20 text-amber-400", dot: "bg-amber-400" },
  OUT: { label: "Out", badge: "bg-neutral-500/20 text-neutral-400", dot: "bg-neutral-600" },
};

export default function TeamPage() {
  return (
    <div className="space-y-6">
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

      {/* Status overview */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "In Office", count: team.filter(t => t.status === "IN").length, color: "text-emerald-400" },
          { label: "Remote", count: team.filter(t => t.status === "REMOTE").length, color: "text-blue-400" },
          { label: "On Holiday", count: team.filter(t => t.status === "HOLIDAY").length, color: "text-amber-400" },
          { label: "Total", count: team.length, color: "text-neutral-200" },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-neutral-800 bg-neutral-900 p-3">
            <p className="text-[11px] text-neutral-500">{s.label}</p>
            <p className={`font-mono text-2xl font-bold ${s.color}`}>{s.count}</p>
          </div>
        ))}
      </div>

      {/* Team cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {team.map((member) => {
          const status = statusConfig[member.status] ?? statusConfig.OUT;
          const holidayPct = (member.holidays.taken / member.holidays.allowance) * 100;
          return (
            <Card key={member.name} className="border-neutral-800 bg-neutral-900 hover:border-neutral-700 transition-colors">
              <CardContent className="p-4 space-y-4">
                {/* Header */}
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className={`font-bold text-black text-sm ${member.color}`}>
                        {member.initials}
                      </AvatarFallback>
                    </Avatar>
                    <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-neutral-900 ${status.dot}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm text-neutral-100">{member.name}</p>
                    <p className="text-xs text-neutral-500 truncate">{member.role}</p>
                  </div>
                  <Badge className={`text-[10px] shrink-0 ${status.badge}`}>
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
                  </div>
                  <div className="flex items-center gap-2 text-xs text-neutral-500">
                    <Calendar className="h-3 w-3 shrink-0" />
                    <span>Started {member.startDate}</span>
                  </div>
                </div>

                {/* Holiday allowance */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-neutral-500">Holiday allowance</span>
                    <span className="text-neutral-400 font-mono">
                      {member.holidays.taken}/{member.holidays.allowance} days
                    </span>
                  </div>
                  <div className="h-1 overflow-hidden rounded-full bg-neutral-800">
                    <div
                      className={`h-full rounded-full ${
                        holidayPct > 80 ? "bg-amber-500" : "bg-[#D4A853]"
                      }`}
                      style={{ width: `${holidayPct}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
