"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Link2, Palette, FileText, CheckCircle2 } from "lucide-react";

interface Campaign {
  id: string;
  title: string;
  status: string;
  stage: string;
  value: number | null;
  currency: string;
  client: { id: string; name: string } | null;
  workflowType?: string;
  creativeStatus?: string | null;
  creativeResponse?: { figmaUrl?: string | null; treatment?: string | null } | null;
  clientBrief?: { content?: string | null } | null;
  briefContent?: string | null;
}

const CREATIVE_STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  AWAITING_RESPONSE: { label: "Awaiting Response", cls: "bg-amber-50 text-amber-700" },
  RESPONSE_SENT: { label: "Response Sent", cls: "bg-sky-50 text-sky-700" },
  IN_REVIEW: { label: "In Review", cls: "bg-blue-50 text-blue-700" },
  REVISIONS_REQUESTED: { label: "Revisions Requested", cls: "bg-orange-50 text-orange-700" },
  APPROVED: { label: "Approved", cls: "bg-emerald-50 text-emerald-700" },
};

interface Props {
  campaignId: string | null;
}

const STAGE_LABELS: Record<string, string> = {
  NEW_BRIEF: "New Brief",
  PITCHING_FEEDBACK: "Pitching & Feedback",
  APPROVAL: "Approval",
  SIGN_OFF: "Sign Off",
  IO_SIGNED_KICK_OFF: "IO Signed & Kick Off",
  IN_PRODUCTION: "In Production",
  LIVE: "Live",
  COMPLETED: "Completed",
  PAID: "Paid",
  // legacy
  LEAD: "New Brief",
  PITCHED: "Pitching & Feedback",
  DEAL_SIGNED: "Sign Off",
  CREATIVE_BRIEF: "New Brief",
  CREATIVE_REVIEW: "Pitching & Feedback",
  CREATIVE_APPROVED: "Sign Off",
  IO_SIGNED: "IO Signed & Kick Off",
  CLEARED_FOR_PRODUCTION: "In Production",
  NEGOTIATING: "Pitching & Feedback",
  BRIEF_RECEIVED: "New Brief",
  CREATIVE_RESPONSE: "Pitching & Feedback",
  CLIENT_REVIEW: "Pitching & Feedback",
  CLIENT_APPROVED: "Sign Off",
  CONTRACTED: "Sign Off",
  BUDGET_SET: "IO Signed & Kick Off",
};

const STAGE_STYLES: Record<string, string> = {
  NEW_BRIEF: "bg-gray-100 text-gray-600",
  PITCHING_FEEDBACK: "bg-purple-100 text-purple-700",
  APPROVAL: "bg-sky-50 text-sky-700",
  SIGN_OFF: "bg-amber-50 text-amber-700",
  IO_SIGNED_KICK_OFF: "bg-yellow-50 text-yellow-700",
  IN_PRODUCTION: "bg-red-50 text-red-700",
  LIVE: "bg-emerald-50 text-emerald-700",
  COMPLETED: "bg-blue-50 text-blue-700",
  PAID: "bg-emerald-100 text-emerald-800",
  // legacy
  LEAD: "bg-gray-100 text-gray-600",
  PITCHED: "bg-purple-100 text-purple-700",
  DEAL_SIGNED: "bg-amber-50 text-amber-700",
  CREATIVE_BRIEF: "bg-gray-100 text-gray-600",
  CREATIVE_REVIEW: "bg-purple-100 text-purple-700",
  CREATIVE_APPROVED: "bg-amber-50 text-amber-700",
  IO_SIGNED: "bg-yellow-50 text-yellow-700",
  CLEARED_FOR_PRODUCTION: "bg-red-50 text-red-700",
  NEGOTIATING: "bg-purple-100 text-purple-700",
  BRIEF_RECEIVED: "bg-gray-100 text-gray-600",
  CREATIVE_RESPONSE: "bg-purple-100 text-purple-700",
  CLIENT_REVIEW: "bg-purple-100 text-purple-700",
  CLIENT_APPROVED: "bg-amber-50 text-amber-700",
  CONTRACTED: "bg-amber-50 text-amber-700",
  BUDGET_SET: "bg-yellow-50 text-yellow-700",
};

function formatBudget(value: number | null, currency: string): string | null {
  if (value == null) return null;
  const symbol = currency === "GBP" ? "£" : currency === "USD" ? "$" : currency === "EUR" ? "€" : `${currency} `;
  return `${symbol}${value.toLocaleString("en-GB")}`;
}

export default function LinkedDeal({ campaignId }: Props) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);

  useEffect(() => {
    if (!campaignId) {
      setCampaign(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/campaigns/${campaignId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled) setCampaign(d && d.id ? d : null);
      })
      .catch(() => {
        if (!cancelled) setCampaign(null);
      });
    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  if (!campaignId || !campaign) return null;

  const budget = formatBudget(campaign.value, campaign.currency);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5">
      <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2 mb-3">
        <Link2 size={15} className="text-[#ffd700]" />
        Linked Deal
      </h2>
      <div className="space-y-2">
        <Link
          href={`/commercial/deals/${campaign.id}`}
          className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-[#ffd700] transition-colors"
        >
          {campaign.title}
        </Link>
        {campaign.client?.name && (
          <p className="text-xs text-gray-500 dark:text-gray-400">{campaign.client.name}</p>
        )}
        <div className="flex items-center gap-2 pt-1">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
              STAGE_STYLES[campaign.stage] ?? "bg-gray-100 text-gray-600"
            }`}
          >
            {STAGE_LABELS[campaign.stage] ?? campaign.stage}
          </span>
          {budget && (
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{budget}</span>
          )}
        </div>
        <Link
          href={`/commercial/deals/${campaign.id}`}
          className="inline-flex items-center gap-1 text-xs font-medium text-[#ffd700] hover:text-[#ffd700] pt-1"
        >
          View deal in Commercial <ArrowUpRight size={12} />
        </Link>
      </div>

      {/* Creative — in-progress indicator, or the approved deck + brief */}
      {campaign.workflowType !== "SUPPLIED_ASSETS" && campaign.creativeStatus && (
        <div className="mt-3 pt-3 border-t border-gray-50">
          {campaign.creativeStatus === "APPROVED" ? (
            <>
              <p className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1.5 mb-2">
                <CheckCircle2 size={13} /> Creative approved
              </p>
              <div className="space-y-1.5">
                {campaign.creativeResponse?.figmaUrl && (
                  <a
                    href={campaign.creativeResponse.figmaUrl.startsWith("http") ? campaign.creativeResponse.figmaUrl : `https://${campaign.creativeResponse.figmaUrl}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-purple-600 hover:text-purple-800"
                  >
                    <Palette size={12} /> Approved Figma deck <ArrowUpRight size={11} />
                  </a>
                )}
                {(campaign.clientBrief?.content || campaign.briefContent) && (
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 flex items-start gap-1.5">
                    <FileText size={12} className="mt-0.5 shrink-0 text-gray-400" />
                    <span className="line-clamp-3">{campaign.clientBrief?.content || campaign.briefContent}</span>
                  </p>
                )}
              </div>
            </>
          ) : (
            <span
              className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                CREATIVE_STATUS_LABELS[campaign.creativeStatus]?.cls ?? "bg-purple-50 text-purple-700"
              }`}
            >
              <Palette size={11} /> Creative in Progress ·{" "}
              {CREATIVE_STATUS_LABELS[campaign.creativeStatus]?.label ?? campaign.creativeStatus}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
