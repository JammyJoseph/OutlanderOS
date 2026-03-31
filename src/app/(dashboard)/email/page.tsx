import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Flag, Mail, Search, Star } from "lucide-react";

const emails = [
  {
    from: "Vogue UK",
    email: "partnerships@vogue.co.uk",
    subject: "Re: Spring collaboration brief",
    snippet: "Thanks for sending over the mood board — we love the direction. Can we schedule a call this week to discuss the next steps for the April co-feature?",
    time: "9:14am",
    unread: true,
    flagged: true,
    labels: ["partnerships"],
  },
  {
    from: "Condé Nast Finance",
    email: "finance@condenast.co.uk",
    subject: "Q1 invoice approval needed",
    snippet: "Hi Joe, please review and approve the attached invoice for Q1 content licensing fees before end of week.",
    time: "8:50am",
    unread: true,
    flagged: false,
    labels: ["finance"],
  },
  {
    from: "Patricia Chen",
    email: "patricia@outlandermag.com",
    subject: "Shoot schedule update – Apr issue",
    snippet: "The Hackney Wick studio is confirmed for April 4-5. I've attached the updated call sheet and talent list.",
    time: "8:22am",
    unread: true,
    flagged: false,
    labels: ["internal", "production"],
  },
  {
    from: "LFW Press Office",
    email: "press@londonfashionweek.co.uk",
    subject: "Accreditation confirmed ✓",
    snippet: "Your press accreditation for London Fashion Week September 2025 has been confirmed. Please find attached your digital badge and schedule.",
    time: "Yesterday",
    unread: false,
    flagged: false,
    labels: ["events"],
  },
  {
    from: "Callum Reid",
    email: "callum@outlandermag.com",
    subject: "Instagram content calendar – April",
    snippet: "Hey, I've put together the draft content calendar for April. Can you sign off on the partnership posts before I schedule them?",
    time: "Yesterday",
    unread: false,
    flagged: false,
    labels: ["internal", "social"],
  },
  {
    from: "HMRC",
    email: "noreply@hmrc.gov.uk",
    subject: "VAT return reminder – period ending 31 Mar 2025",
    snippet: "This is a reminder that your VAT return for the period ending 31 March 2025 is due by 7 April 2025.",
    time: "Mon",
    unread: false,
    flagged: true,
    labels: ["compliance"],
  },
];

const labelColors: Record<string, string> = {
  partnerships: "bg-purple-500/20 text-purple-400",
  finance: "bg-emerald-500/20 text-emerald-400",
  internal: "bg-blue-500/20 text-blue-400",
  production: "bg-pink-500/20 text-pink-400",
  events: "bg-amber-500/20 text-amber-400",
  compliance: "bg-red-500/20 text-red-400",
  social: "bg-cyan-500/20 text-cyan-400",
};

export default function EmailPage() {
  return (
    <div className="flex h-full gap-4">
      {/* Sidebar */}
      <div className="w-44 shrink-0 space-y-1">
        {[
          { label: "Inbox", count: 12 },
          { label: "Starred", count: 2 },
          { label: "Sent", count: null },
          { label: "Drafts", count: 1 },
          { label: "Flagged", count: 2 },
          { label: "Archive", count: null },
        ].map((f) => (
          <button
            key={f.label}
            className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm text-neutral-400 hover:bg-neutral-800 hover:text-white"
          >
            <span>{f.label}</span>
            {f.count && (
              <Badge className="bg-neutral-700 text-neutral-300">{f.count}</Badge>
            )}
          </button>
        ))}
      </div>

      {/* Email list */}
      <div className="flex flex-1 flex-col gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-neutral-100">Inbox</h1>
          <Badge className="bg-[#D4A853]/20 text-[#D4A853]">12 unread</Badge>
          <div className="relative ml-auto w-64">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-500" />
            <Input
              placeholder="Search emails..."
              className="h-8 border-neutral-700 bg-neutral-900 pl-8 text-sm"
            />
          </div>
        </div>

        <div className="space-y-1">
          {emails.map((email, i) => (
            <Card
              key={i}
              className={`cursor-pointer border-neutral-800 transition-colors hover:border-neutral-700 ${
                email.unread ? "bg-neutral-900" : "bg-neutral-900/50"
              }`}
            >
              <CardContent className="flex items-start gap-3 p-3">
                {email.unread && (
                  <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#D4A853]" />
                )}
                {!email.unread && <div className="mt-1.5 h-1.5 w-1.5 shrink-0" />}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${email.unread ? "text-white" : "text-neutral-400"}`}>
                      {email.from}
                    </span>
                    <div className="flex gap-1">
                      {email.labels.map((l) => (
                        <Badge key={l} className={`text-[10px] ${labelColors[l] ?? ""}`}>
                          {l}
                        </Badge>
                      ))}
                    </div>
                    <span className="ml-auto shrink-0 text-xs text-neutral-500">{email.time}</span>
                  </div>
                  <p className={`text-sm ${email.unread ? "font-medium text-neutral-200" : "text-neutral-400"}`}>
                    {email.subject}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-neutral-500">{email.snippet}</p>
                </div>
                <div className="flex flex-col gap-1">
                  {email.flagged && <Flag className="h-3.5 w-3.5 text-red-400" />}
                  <Star className="h-3.5 w-3.5 text-neutral-600 hover:text-amber-400" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
