import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

const events = [
  { time: "09:00", title: "Weekly team standup", duration: "30m", type: "internal" },
  { time: "11:00", title: "Brand partnership call – ASOS", duration: "1h", type: "external" },
  { time: "13:30", title: "April issue review", duration: "1.5h", type: "internal" },
  { time: "16:00", title: "Payroll review with Patricia", duration: "30m", type: "internal" },
];

const typeColors: Record<string, string> = {
  internal: "bg-blue-500/20 text-blue-400",
  external: "bg-emerald-500/20 text-emerald-400",
};

export function TodaysScheduleWidget() {
  return (
    <Card className="border-neutral-800 bg-neutral-900">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-neutral-200">
          <Calendar className="h-4 w-4 text-[#D4A853]" />
          Today&apos;s Schedule
        </CardTitle>
        <Link href="/calendar" className="text-xs text-neutral-500 hover:text-neutral-300">
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-2">
        {events.map((event, i) => (
          <div key={i} className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-neutral-800/50">
            <span className="w-10 shrink-0 font-mono text-xs text-[#D4A853]">
              {event.time}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-neutral-200">{event.title}</p>
              <p className="text-[10px] text-neutral-500">{event.duration}</p>
            </div>
            <Badge className={`text-[10px] ${typeColors[event.type] ?? ""}`}>
              {event.type}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
