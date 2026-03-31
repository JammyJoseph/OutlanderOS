import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, Flag, ArrowRight } from "lucide-react";
import Link from "next/link";

const emails = [
  { from: "Vogue UK", subject: "Re: Spring collaboration brief", time: "9:14am", flagged: true },
  { from: "Condé Nast Finance", subject: "Q1 invoice approval needed", time: "8:50am", flagged: false },
  { from: "Patricia Chen", subject: "Shoot schedule update – Apr issue", time: "8:22am", flagged: false },
  { from: "LFW Press Office", subject: "Accreditation confirmed ✓", time: "Yesterday", flagged: false },
];

export function EmailSummaryWidget() {
  return (
    <Card className="border-neutral-800 bg-neutral-900">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-neutral-200">
          <Mail className="h-4 w-4 text-[#D4A853]" />
          Email
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge className="bg-[#D4A853]/20 text-[#D4A853] hover:bg-[#D4A853]/30">
            12 unread
          </Badge>
          <Link
            href="/email"
            className="text-xs text-neutral-500 hover:text-neutral-300"
          >
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        {emails.map((email, i) => (
          <div
            key={i}
            className="flex items-start gap-3 rounded-md px-2 py-2 hover:bg-neutral-800/50"
          >
            <div className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#D4A853]" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-xs font-medium text-neutral-200">
                  {email.from}
                </span>
                <span className="shrink-0 text-[10px] text-neutral-500">
                  {email.time}
                </span>
              </div>
              <p className="truncate text-xs text-neutral-500">{email.subject}</p>
            </div>
            {email.flagged && (
              <Flag className="mt-0.5 h-3 w-3 shrink-0 text-red-400" />
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
