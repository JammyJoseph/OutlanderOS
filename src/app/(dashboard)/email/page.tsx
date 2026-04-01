"use client";

import { useState } from "react";
import {
  Search,
  Star,
  Flag,
  Paperclip,
  Download,
  Reply,
  Forward,
  Archive,
  CheckSquare,
  Pencil,
  ChevronDown,
  AlertCircle,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Email = {
  id: number;
  from: string;
  email: string;
  subject: string;
  preview: string;
  date: string;
  timestamp: string;
  unread: boolean;
  starred: boolean;
  flagged: boolean;
  folder: "inbox" | "sent" | "flagged";
  group: "Today" | "Yesterday" | "Earlier";
  followUpRequired: boolean;
  hasAttachment: boolean;
  attachments: { name: string; size: string }[];
  body: string;
  initials: string;
  avatarColor: string;
};

const emails: Email[] = [
  {
    id: 1,
    from: "Marcus Webb Photography",
    email: "marcus@marcuswebbphoto.com",
    subject: "Invoice #MW-2024-089 — March Editorial Shoot",
    preview: "Hi Joe, please find attached invoice #MW-2024-089 for the March editorial shoot at Hackney Wick. Total: £1,850.00. Payment terms: 30 days.",
    date: "28 Mar",
    timestamp: "28 Mar 2026, 9:14am",
    unread: true,
    starred: false,
    flagged: true,
    folder: "inbox",
    group: "Earlier",
    followUpRequired: true,
    hasAttachment: true,
    attachments: [{ name: "Invoice_MW-2024-089.pdf", size: "245 KB" }],
    initials: "MW",
    avatarColor: "bg-orange-500",
    body: `Hi Joe,

Please find attached invoice #MW-2024-089 for the March editorial shoot conducted on 15th March at Hackney Wick Studios.

Invoice Details:
— Date of service: 15 March 2026
— Location: Hackney Wick Studios, London E9
— Services: Full-day editorial photography (10 hours)
— Total: £1,850.00
— Payment terms: 30 days from invoice date

Please process payment to:
Bank: Barclays Business
Account: Marcus Webb Photography Ltd
Sort code: 20-41-53
Account no: 83412967

If you have any questions, please don't hesitate to reach out.

Best,
Marcus`,
  },
  {
    id: 2,
    from: "Nike UK Partnerships",
    email: "partnerships@nike.com",
    subject: "Q2/Q3 Campaign Collaboration — Outlander Magazine",
    preview: "Following our call last week, we'd love to formalise the partnership for Q2 and Q3. We're looking at a £45,000 investment across print, digital and events...",
    date: "29 Mar",
    timestamp: "29 Mar 2026, 11:32am",
    unread: true,
    starred: true,
    flagged: true,
    folder: "inbox",
    group: "Earlier",
    followUpRequired: true,
    hasAttachment: false,
    attachments: [],
    initials: "NK",
    avatarColor: "bg-zinc-600",
    body: `Hi Shreeya,

Following our call last week, I wanted to follow up on the Outlander Magazine partnership for Q2 and Q3 2026.

We're proposing a £45,000 investment across:
— 2x full-page print placements (May & September issues)
— 6x social media activations (Instagram + TikTok)
— 1x event partnership (LFW September)
— Digital homepage takeover (2 weeks)

We'd love to get a formal proposal and IO from your team before end of April. Could you have Shreeya send over a deck?

Looking forward to making this happen.

Best regards,
Tom Bradley
Brand Partnerships, Nike UK`,
  },
  {
    id: 3,
    from: "Adidas Brand Finance",
    email: "brandfinance@adidas.com",
    subject: "Payment Confirmation — Palace Drop Campaign",
    preview: "Please find confirmation of payment of £12,500 for the Palace drop campaign delivered in March 2026. Transfer ref: ADI-PAY-20260331.",
    date: "31 Mar",
    timestamp: "31 Mar 2026, 4:45pm",
    unread: false,
    starred: false,
    flagged: false,
    folder: "inbox",
    group: "Yesterday",
    followUpRequired: false,
    hasAttachment: true,
    attachments: [{ name: "Payment_Confirmation_ADI-2026-031.pdf", size: "89 KB" }],
    initials: "AD",
    avatarColor: "bg-blue-600",
    body: `Dear Outlander Magazine Team,

Please find below confirmation of payment for the Palace Drop Campaign delivered in March 2026.

Payment Details:
— Invoice ref: OL-ADI-2026-031
— Campaign: Palace x Adidas Drop — March 2026
— Amount: £12,500.00
— Payment date: 31 March 2026
— Transfer ref: ADI-PAY-20260331-0047

Payment has been made via BACS to your registered account. Please allow 1–3 business days for the funds to clear.

Thank you for delivering an exceptional campaign. We look forward to continuing our partnership.

Kind regards,
Lucia Fernandez
Brand Finance, Adidas UK`,
  },
  {
    id: 4,
    from: "Xero",
    email: "notify@xero.com",
    subject: "Overdue Invoice Alert: New Balance £4,200",
    preview: "Invoice #OL-NB-2026-012 for New Balance UK is now 30 days overdue. The outstanding amount of £4,200.00 has not been received.",
    date: "1 Apr",
    timestamp: "1 Apr 2026, 8:02am",
    unread: true,
    starred: false,
    flagged: true,
    folder: "inbox",
    group: "Today",
    followUpRequired: false,
    hasAttachment: false,
    attachments: [],
    initials: "XR",
    avatarColor: "bg-blue-400",
    body: `Hi Joe,

This is an automated notification from Xero.

The following invoice is now 30 days overdue:

Invoice: #OL-NB-2026-012
Client: New Balance UK Ltd
Issued: 1 March 2026
Due date: 31 March 2026
Amount outstanding: £4,200.00

We recommend following up with your client directly to arrange payment. You can send a reminder directly from Xero or log in to your account to view the full invoice.

Xero Accounting`,
  },
  {
    id: 5,
    from: "Quinn Titsworth",
    email: "quinn@outlandermag.com",
    subject: "May Issue Shoot Schedule — Review Needed",
    preview: "Hey Joe, I've put together the initial schedule for the May editorial shoot. Can you review the crew costs and studio booking before I confirm with Patricia?",
    date: "1 Apr",
    timestamp: "1 Apr 2026, 9:18am",
    unread: true,
    starred: false,
    flagged: false,
    folder: "inbox",
    group: "Today",
    followUpRequired: false,
    hasAttachment: true,
    attachments: [
      { name: "May_Shoot_Schedule_Draft.pdf", size: "312 KB" },
      { name: "Crew_Budget_Breakdown.xlsx", size: "48 KB" },
    ],
    initials: "QT",
    avatarColor: "bg-blue-500",
    body: `Hey Joe,

I've put together the initial schedule for the May issue editorial shoot. The theme is "New Brutalism" — we're looking at a brutalist architecture location in East London.

Key dates:
— Pre-production meeting: 14 April
— Shoot day 1: 5 May (Barbican Centre, if approved)
— Shoot day 2: 6 May (backup/studio)
— Post deadline: 20 May

Budget summary:
— Studio/location: £3,200
— Photography (lead + assistant): £2,800
— Hair & makeup: £1,400
— Styling: £1,200
— Props & transport: £600
— Contingency: £500
Total: £9,700

Can you confirm this is within Q2 budget before I lock it in with Patricia?

Thanks,
Quinn`,
  },
  {
    id: 6,
    from: "billing@outlandermag.com",
    email: "billing@outlandermag.com",
    subject: "URGENT: Invoice #OL-NB-2026-012 — 30 Days Overdue",
    preview: "Automated escalation alert. Invoice #OL-NB-2026-012 sent to New Balance UK remains unpaid at 30 days. Immediate follow-up required.",
    date: "1 Apr",
    timestamp: "1 Apr 2026, 10:00am",
    unread: true,
    starred: false,
    flagged: true,
    folder: "inbox",
    group: "Today",
    followUpRequired: false,
    hasAttachment: false,
    attachments: [],
    initials: "OL",
    avatarColor: "bg-[#D4A853]",
    body: `AUTOMATED BILLING ESCALATION

Invoice: #OL-NB-2026-012
Client: New Balance UK Ltd
Original due date: 31 March 2026
Days overdue: 1
Amount: £4,200.00

Recommended action:
1. Call New Balance UK accounts payable: 020 7412 6500
2. Send formal late payment notice (template in Shared Drive)
3. Consider applying late payment interest under the Late Payment of Commercial Debts Act 1998

If payment is not received within 7 days, consider referring to your solicitor.

— Outlander Magazine Billing System`,
  },
  {
    id: 7,
    from: "HMRC",
    email: "noreply@hmrc.gov.uk",
    subject: "VAT Return Due — Period Ending 31 March 2026",
    preview: "Your VAT return for the period ending 31 March 2026 is due by 7 April 2026. Submit on time to avoid penalties.",
    date: "25 Mar",
    timestamp: "25 Mar 2026, 9:00am",
    unread: false,
    starred: false,
    flagged: true,
    folder: "inbox",
    group: "Earlier",
    followUpRequired: true,
    hasAttachment: false,
    attachments: [],
    initials: "HM",
    avatarColor: "bg-red-600",
    body: `Dear Taxpayer,

This is a reminder that your VAT return for the period ending 31 March 2026 is due by 7 April 2026.

Your VAT registration number: GB 382 4912 15

To avoid a surcharge, please ensure:
— Your VAT return is submitted by 7 April 2026
— Any VAT owed is paid by 7 April 2026

You can submit your return online at gov.uk/vat-returns

HMRC VAT Services`,
  },
  {
    id: 8,
    from: "Hiscox Business Insurance",
    email: "renewals@hiscox.co.uk",
    subject: "Business Insurance Renewal — Due 1 May 2026",
    preview: "Your Hiscox policy (HX-2024-OLM-8821) is due for renewal on 1 May 2026. Current premium: £2,340/year. New premium: £2,457/year (+5%).",
    date: "30 Mar",
    timestamp: "30 Mar 2026, 2:15pm",
    unread: true,
    starred: false,
    flagged: false,
    folder: "inbox",
    group: "Earlier",
    followUpRequired: false,
    hasAttachment: true,
    attachments: [{ name: "Policy_Renewal_HX-2026-OLM.pdf", size: "1.2 MB" }],
    initials: "HI",
    avatarColor: "bg-violet-600",
    body: `Dear Joe Silver,

Your Hiscox Business Insurance policy (Policy No: HX-2024-OLM-8821) is due for renewal on 1 May 2026.

Current policy summary:
— Policy type: Media & Communications Professional Liability
— Coverage: £1,000,000 public liability / £500,000 professional indemnity
— Current annual premium: £2,340.00
— Renewal premium: £2,457.00 (+5%)

To renew or make changes, please contact:
Sarah Mitchell: 020 7105 4890
renewals@hiscox.co.uk

Your policy will auto-renew if we don't hear from you by 25 April 2026.

Kind regards,
Hiscox Renewals Team`,
  },
  {
    id: 9,
    from: "Hackney Wick Studios",
    email: "bookings@hacknewickstudios.co.uk",
    subject: "Booking Confirmed — Studio A, 4–5 April 2026",
    preview: "Your studio booking for Studio A has been confirmed for 4–5 April 2026. Booking reference: HWS-2026-0042. Balance due on arrival: £1,920.00.",
    date: "31 Mar",
    timestamp: "31 Mar 2026, 11:30am",
    unread: false,
    starred: false,
    flagged: false,
    folder: "inbox",
    group: "Yesterday",
    followUpRequired: false,
    hasAttachment: true,
    attachments: [{ name: "Booking_Confirmation_HWS-2026-0042.pdf", size: "134 KB" }],
    initials: "HW",
    avatarColor: "bg-teal-600",
    body: `Dear Patricia Chen,

Thank you for booking with Hackney Wick Studios. Your booking is confirmed:

Booking Reference: HWS-2026-0042
Studio: Studio A (Ground floor, 3,200 sq ft)
Dates: 4–5 April 2026
Hours: 7:00am – 8:00pm (both days)

Includes:
— Full studio access with natural light
— Changing rooms x4
— Kitchenette & green room
— 4x Arri LED panels (pre-rigged)
— 2x parking spaces

Rate: £1,200/day × 2 days = £2,400.00
Deposit paid: £480.00
Balance due on arrival: £1,920.00

We look forward to hosting your shoot!
Hackney Wick Studios`,
  },
  {
    id: 10,
    from: "The Truman Brewery Studios",
    email: "accounts@trumanbrewery.com",
    subject: "Invoice #TB-2024-071 — Studio Hire, 22 March",
    preview: "Please find attached invoice #TB-2024-071 for studio hire on 22 March 2026. Amount due: £2,400.00. Payment due: 29 March 2026.",
    date: "28 Mar",
    timestamp: "28 Mar 2026, 3:45pm",
    unread: true,
    starred: false,
    flagged: false,
    folder: "inbox",
    group: "Earlier",
    followUpRequired: true,
    hasAttachment: true,
    attachments: [{ name: "Invoice_TB-2024-071.pdf", size: "178 KB" }],
    initials: "TB",
    avatarColor: "bg-amber-700",
    body: `Dear Joe,

Please find attached invoice for studio hire services.

Invoice: #TB-2024-071
Client: Outlander Magazine Ltd
Date of service: 22 March 2026
Location: The Truman Brewery, Brick Lane, E1 6RF

Services:
— Main Hall hire (10 hours): £1,800.00
— Equipment package (lighting rig): £400.00
— Generator hire: £200.00
Total: £2,400.00

Payment due: 29 March 2026

Please remit to:
The Truman Brewery Studios Ltd
Barclays Bank
Sort code: 20-72-41
Account: 42817653

Kind regards,
Accounts Team`,
  },
];

const GROUP_ORDER = ["Today", "Yesterday", "Earlier"] as const;

export default function EmailPage() {
  const [activeTab, setActiveTab] = useState<"inbox" | "sent" | "flagged">("inbox");
  const [selectedEmail, setSelectedEmail] = useState<Email>(emails[0]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFollowUp, setShowFollowUp] = useState(true);
  const [starredIds, setStarredIds] = useState<Set<number>>(
    new Set(emails.filter((e) => e.starred).map((e) => e.id))
  );
  const [flaggedIds, setFlaggedIds] = useState<Set<number>>(
    new Set(emails.filter((e) => e.flagged).map((e) => e.id))
  );

  const filtered = emails.filter((e) => {
    if (activeTab === "flagged") return flaggedIds.has(e.id);
    if (activeTab === "sent") return e.folder === "sent";
    const q = searchQuery.toLowerCase();
    return (
      e.folder === "inbox" &&
      (q === "" || e.from.toLowerCase().includes(q) || e.subject.toLowerCase().includes(q))
    );
  });

  const followUps = emails.filter((e) => e.followUpRequired);

  const grouped = GROUP_ORDER.reduce<Record<string, Email[]>>((acc, g) => {
    const group = filtered.filter((e) => e.group === g);
    if (group.length > 0) acc[g] = group;
    return acc;
  }, {});

  return (
    <div className="-m-6 flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden bg-neutral-950">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center gap-3 border-b border-neutral-800 bg-neutral-950 px-4 py-2">
        {/* Tabs */}
        <div className="flex overflow-hidden rounded-md border border-neutral-800">
          {(["inbox", "sent", "flagged"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-3 py-1.5 text-xs capitalize transition-colors",
                activeTab === tab
                  ? "bg-neutral-800 text-white"
                  : "text-neutral-500 hover:text-neutral-300"
              )}
            >
              {tab}
              {tab === "inbox" && (
                <span className="ml-1.5 rounded bg-[#D4A853]/20 px-1 py-0.5 text-[10px] font-medium text-[#D4A853]">
                  {emails.filter((e) => e.unread && e.folder === "inbox").length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-500" />
          <Input
            placeholder="Search emails..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 border-neutral-800 bg-neutral-900 pl-9 text-xs text-neutral-200 placeholder:text-neutral-600"
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" className="bg-[#D4A853] text-black hover:bg-[#c49a47]">
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            Compose
          </Button>
        </div>
      </div>

      {/* Follow-up Required Banner */}
      {showFollowUp && followUps.length > 0 && (
        <div className="shrink-0 border-b border-amber-800/40 bg-amber-900/10 px-4 py-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
            <span className="text-xs font-medium text-amber-400">
              Follow-up Required
            </span>
            <span className="text-xs text-amber-600">
              — {followUps.length} emails with no reply in 48+ hours
            </span>
            <div className="ml-2 flex gap-1.5">
              {followUps.map((e) => (
                <button
                  key={e.id}
                  onClick={() => setSelectedEmail(e)}
                  className={cn(
                    "rounded px-2 py-0.5 text-[10px] font-medium transition-colors",
                    selectedEmail.id === e.id
                      ? "bg-amber-500/30 text-amber-300"
                      : "bg-amber-900/30 text-amber-500 hover:bg-amber-900/50"
                  )}
                >
                  {e.from.split(" ")[0]} · {e.date}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowFollowUp(false)}
              className="ml-auto text-neutral-600 hover:text-neutral-400"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Split Pane */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Email List (40%) */}
        <div className="flex w-[40%] shrink-0 flex-col overflow-y-auto border-r border-neutral-800">
          {Object.entries(grouped).length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-neutral-600">
              No emails
            </div>
          ) : (
            Object.entries(grouped).map(([group, groupEmails]) => (
              <div key={group}>
                <div className="sticky top-0 z-10 bg-neutral-950 px-4 py-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-600">
                    {group}
                  </span>
                </div>
                {groupEmails.map((email) => {
                  const isSelected = selectedEmail.id === email.id;
                  const isUnread = email.unread;
                  const isStarred = starredIds.has(email.id);
                  const isFlagged = flaggedIds.has(email.id);
                  return (
                    <button
                      key={email.id}
                      onClick={() => setSelectedEmail(email)}
                      className={cn(
                        "relative w-full border-b border-neutral-800/60 px-4 py-3 text-left transition-colors hover:bg-neutral-900",
                        isSelected && "bg-neutral-900",
                        isUnread && "before:absolute before:left-0 before:top-0 before:h-full before:w-[3px] before:bg-[#D4A853]"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        {/* Avatar */}
                        <div
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white",
                            email.avatarColor
                          )}
                        >
                          {email.initials}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={cn(
                                "truncate text-xs",
                                isUnread ? "font-semibold text-neutral-100" : "font-medium text-neutral-400"
                              )}
                            >
                              {email.from}
                            </span>
                            <span className="ml-auto shrink-0 text-[10px] text-neutral-600">
                              {email.date}
                            </span>
                          </div>
                          <p
                            className={cn(
                              "truncate text-xs",
                              isUnread ? "font-medium text-neutral-200" : "text-neutral-500"
                            )}
                          >
                            {email.subject}
                          </p>
                          <p className="mt-0.5 truncate text-[10px] text-neutral-600">
                            {email.preview}
                          </p>

                          {/* Indicators */}
                          <div className="mt-1.5 flex items-center gap-1.5">
                            {email.hasAttachment && (
                              <Paperclip className="h-3 w-3 text-neutral-600" />
                            )}
                            {email.followUpRequired && (
                              <span className="rounded bg-amber-900/30 px-1 py-0.5 text-[9px] font-medium text-amber-500">
                                Follow-up
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Star / Flag */}
                        <div className="flex shrink-0 flex-col gap-1">
                          <button
                            onClick={(ev) => {
                              ev.stopPropagation();
                              setStarredIds((prev) => {
                                const next = new Set(prev);
                                next.has(email.id) ? next.delete(email.id) : next.add(email.id);
                                return next;
                              });
                            }}
                          >
                            <Star
                              className={cn(
                                "h-3 w-3 transition-colors",
                                isStarred ? "fill-amber-400 text-amber-400" : "text-neutral-700 hover:text-amber-400"
                              )}
                            />
                          </button>
                          <button
                            onClick={(ev) => {
                              ev.stopPropagation();
                              setFlaggedIds((prev) => {
                                const next = new Set(prev);
                                next.has(email.id) ? next.delete(email.id) : next.add(email.id);
                                return next;
                              });
                            }}
                          >
                            <Flag
                              className={cn(
                                "h-3 w-3 transition-colors",
                                isFlagged ? "fill-red-400 text-red-400" : "text-neutral-700 hover:text-red-400"
                              )}
                            />
                          </button>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Right: Email Detail (60%) */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {selectedEmail ? (
            <>
              {/* Email Header */}
              <div className="shrink-0 border-b border-neutral-800 px-6 py-4">
                <h2 className="mb-3 text-base font-semibold text-neutral-100">
                  {selectedEmail.subject}
                </h2>
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white",
                      selectedEmail.avatarColor
                    )}
                  >
                    {selectedEmail.initials}
                  </div>
                  <div className="flex-1 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-neutral-100">
                        {selectedEmail.from}
                      </span>
                      <span className="text-xs text-neutral-500">
                        &lt;{selectedEmail.email}&gt;
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-neutral-500">
                      <span>To: billing@outlandermag.com</span>
                      <span>·</span>
                      <span>{selectedEmail.timestamp}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button className="rounded p-1.5 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300">
                      <Star
                        className={cn(
                          "h-4 w-4",
                          starredIds.has(selectedEmail.id) && "fill-amber-400 text-amber-400"
                        )}
                      />
                    </button>
                    <button className="rounded p-1.5 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300">
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex shrink-0 items-center gap-2 border-b border-neutral-800 px-6 py-2">
                <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs">
                  <Reply className="h-3 w-3" />
                  Reply
                </Button>
                <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs">
                  <Forward className="h-3 w-3" />
                  Forward
                </Button>
                <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs">
                  <Archive className="h-3 w-3" />
                  Archive
                </Button>
                <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs">
                  <Flag className="h-3 w-3" />
                  Flag
                </Button>
                <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs">
                  <CheckSquare className="h-3 w-3" />
                  Add to Tasks
                </Button>
              </div>

              {/* Email Body */}
              <div className="flex-1 overflow-y-auto px-6 py-5">
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-neutral-300">
                  {selectedEmail.body}
                </pre>

                {/* Attachments */}
                {selectedEmail.hasAttachment && selectedEmail.attachments.length > 0 && (
                  <div className="mt-6 space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                      Attachments ({selectedEmail.attachments.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {selectedEmail.attachments.map((att) => (
                        <div
                          key={att.name}
                          className="flex items-center gap-2.5 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2"
                        >
                          <Paperclip className="h-3.5 w-3.5 shrink-0 text-neutral-500" />
                          <div>
                            <p className="text-xs font-medium text-neutral-200">{att.name}</p>
                            <p className="text-[10px] text-neutral-600">{att.size}</p>
                          </div>
                          <button className="ml-2 rounded p-1 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300">
                            <Download className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Reply */}
              <div className="shrink-0 border-t border-neutral-800 px-6 py-3">
                <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-3">
                  <textarea
                    placeholder={`Reply to ${selectedEmail.from}...`}
                    className="w-full resize-none bg-transparent text-sm text-neutral-300 placeholder:text-neutral-600 focus:outline-none"
                    rows={2}
                  />
                  <div className="mt-2 flex justify-end">
                    <Button size="sm" className="bg-[#D4A853] text-black hover:bg-[#c49a47]">
                      Send Reply
                    </Button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-neutral-600">
              Select an email to read
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
