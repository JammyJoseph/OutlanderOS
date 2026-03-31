import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bot, Sparkles, Zap, FileSearch, Mail, BarChart3, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

const agents = [
  {
    name: "Email Triage Agent",
    description: "Automatically categorises, prioritises, and drafts replies for incoming emails. Flags urgent items for immediate attention.",
    icon: Mail,
    status: "COMING_SOON",
    capabilities: ["Auto-categorise", "Priority scoring", "Draft replies", "Flag urgent"],
  },
  {
    name: "Finance Analyst",
    description: "Analyses Xero data to surface cash flow insights, flag overdue invoices, and prepare monthly P&L summaries.",
    icon: BarChart3,
    status: "COMING_SOON",
    capabilities: ["Xero integration", "Cash flow alerts", "Invoice chasing", "P&L reports"],
  },
  {
    name: "Content Brief Generator",
    description: "Generates editorial briefs, shoot concepts, and social captions based on the issue theme and brand guidelines.",
    icon: Sparkles,
    status: "COMING_SOON",
    capabilities: ["Editorial briefs", "Shoot concepts", "Social captions", "Brand-aligned"],
  },
  {
    name: "Project Status Reporter",
    description: "Monitors project budgets vs actuals, identifies at-risk projects, and generates weekly status reports.",
    icon: FileSearch,
    status: "COMING_SOON",
    capabilities: ["Budget tracking", "Risk alerts", "Weekly reports", "Margin analysis"],
  },
  {
    name: "Scheduling Assistant",
    description: "Coordinates team calendars, books meetings, and surfaces scheduling conflicts before they become problems.",
    icon: Clock,
    status: "COMING_SOON",
    capabilities: ["Calendar sync", "Meeting booking", "Conflict detection", "Reminders"],
  },
  {
    name: "Partnership Researcher",
    description: "Researches potential brand partners, analyses fit scores, and prepares initial outreach materials.",
    icon: Zap,
    status: "COMING_SOON",
    capabilities: ["Brand research", "Fit scoring", "Outreach drafts", "Market analysis"],
  },
];

export default function AgentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold text-neutral-100">AI Agents</h1>
          <Badge className="bg-[#D4A853]/20 text-[#D4A853]">Phase 2</Badge>
        </div>
        <p className="mt-1 text-sm text-neutral-500">
          Intelligent agents that automate repetitive tasks across Outlander OS. Powered by Claude.
        </p>
      </div>

      {/* Coming soon banner */}
      <div className="flex items-center gap-3 rounded-lg border border-[#D4A853]/30 bg-[#D4A853]/5 p-4">
        <Bot className="h-5 w-5 text-[#D4A853] shrink-0" />
        <div>
          <p className="text-sm font-medium text-[#D4A853]">Agents Hub — Coming in Phase 2</p>
          <p className="text-xs text-neutral-400 mt-0.5">
            These AI agents will be built into OutlanderOS to automate your most time-consuming workflows. The architecture is ready — agents will be activated progressively.
          </p>
        </div>
      </div>

      {/* Agent cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {agents.map((agent) => {
          const Icon = agent.icon;
          return (
            <Card key={agent.name} className="border-neutral-800 bg-neutral-900 opacity-75 hover:opacity-90 transition-opacity">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-neutral-800">
                      <Icon className="h-4 w-4 text-[#D4A853]" />
                    </div>
                    <CardTitle className="text-sm font-semibold text-neutral-200">
                      {agent.name}
                    </CardTitle>
                  </div>
                  <Badge className="shrink-0 text-[10px] bg-neutral-700/50 text-neutral-500">
                    soon
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-neutral-500">{agent.description}</p>
                <div className="flex flex-wrap gap-1">
                  {agent.capabilities.map((cap) => (
                    <span
                      key={cap}
                      className="rounded px-1.5 py-0.5 text-[10px] bg-neutral-800 text-neutral-400"
                    >
                      {cap}
                    </span>
                  ))}
                </div>
                <Button
                  size="sm"
                  disabled
                  className="w-full text-xs bg-neutral-800 text-neutral-500 cursor-not-allowed hover:bg-neutral-800"
                >
                  Activate Agent
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
