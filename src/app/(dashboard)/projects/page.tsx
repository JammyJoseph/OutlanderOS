import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { FolderKanban, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

const projects = [
  {
    name: "April 2025 Issue",
    client: "In-house",
    description: "Monthly flagship print and digital issue. Cover feature: sustainable fashion in 2025.",
    status: "ACTIVE",
    budget: 45000,
    actuals: 38200,
    startDate: "Feb 1",
    dueDate: "Apr 3",
    team: ["JS", "QT", "PA", "CA"],
    tasksTotal: 24,
    tasksDone: 18,
  },
  {
    name: "ASOS Brand Partnership",
    client: "ASOS",
    description: "Sponsored editorial and social content package for ASOS spring collection launch.",
    status: "ACTIVE",
    budget: 22000,
    actuals: 14100,
    startDate: "Mar 10",
    dueDate: "Apr 12",
    team: ["JS", "SH", "CA"],
    tasksTotal: 12,
    tasksDone: 6,
  },
  {
    name: "Digital Rebrand",
    client: "Internal",
    description: "Website redesign and new digital design system for outlandermag.com.",
    status: "ACTIVE",
    budget: 8000,
    actuals: 9200,
    startDate: "Jan 15",
    dueDate: "Apr 30",
    team: ["JS", "QT"],
    tasksTotal: 32,
    tasksDone: 20,
  },
  {
    name: "LFW September Coverage",
    client: "In-house",
    description: "Pre-planning for London Fashion Week September 2025 press coverage and digital content.",
    status: "PAUSED",
    budget: 15000,
    actuals: 1200,
    startDate: "Apr 1",
    dueDate: "Sep 12",
    team: ["PA", "CA"],
    tasksTotal: 8,
    tasksDone: 1,
  },
];

const statusStyles: Record<string, string> = {
  ACTIVE: "bg-emerald-500/20 text-emerald-400",
  PAUSED: "bg-amber-500/20 text-amber-400",
  COMPLETED: "bg-blue-500/20 text-blue-400",
  CANCELLED: "bg-red-500/20 text-red-400",
};

const avatarColors = ["bg-[#D4A853]", "bg-blue-500", "bg-emerald-500", "bg-purple-500", "bg-pink-500"];

function MarginPill({ budget, actuals }: { budget: number; actuals: number }) {
  const margin = ((budget - actuals) / budget) * 100;
  const color =
    margin < 0 ? "text-red-400 bg-red-500/10" :
    margin < 15 ? "text-amber-400 bg-amber-500/10" :
    "text-emerald-400 bg-emerald-500/10";
  return (
    <span className={`rounded px-1.5 py-0.5 font-mono text-xs font-semibold ${color}`}>
      {margin >= 0 ? "+" : ""}{margin.toFixed(0)}% margin
    </span>
  );
}

export default function ProjectsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-100">Projects</h1>
        <Button size="sm" className="bg-[#D4A853] text-black hover:bg-[#c49a47]">
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          New Project
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {projects.map((project) => {
          const pct = Math.min((project.actuals / project.budget) * 100, 100);
          return (
            <Card key={project.name} className="border-neutral-800 bg-neutral-900 hover:border-neutral-700 transition-colors cursor-pointer">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-sm font-semibold text-neutral-100">
                      {project.name}
                    </CardTitle>
                    <p className="text-xs text-neutral-500">{project.client}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge className={`text-[10px] ${statusStyles[project.status]}`}>
                      {project.status.toLowerCase()}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-neutral-500 line-clamp-2">{project.description}</p>

                {/* Budget */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-neutral-500">Budget usage</span>
                    <MarginPill budget={project.budget} actuals={project.actuals} />
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-neutral-800">
                    <div
                      className={`h-full rounded-full transition-all ${
                        pct > 100 ? "bg-red-500" : pct > 80 ? "bg-amber-500" : "bg-[#D4A853]"
                      }`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-neutral-600">
                    <span>£{project.actuals.toLocaleString()} spent</span>
                    <span>£{project.budget.toLocaleString()} budget</span>
                  </div>
                </div>

                {/* Tasks */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-[11px] text-neutral-500">Tasks</p>
                    <p className="text-xs text-neutral-300">
                      {project.tasksDone}/{project.tasksTotal} complete
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-neutral-500">Due</p>
                    <p className="font-mono text-xs text-neutral-300">{project.dueDate}</p>
                  </div>
                </div>

                {/* Team */}
                <div className="flex items-center gap-1">
                  {project.team.map((initials, i) => (
                    <Avatar key={i} className="h-5 w-5 -ml-1 first:ml-0 ring-1 ring-neutral-900">
                      <AvatarFallback className={`text-[8px] font-bold text-black ${avatarColors[i % avatarColors.length]}`}>
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
