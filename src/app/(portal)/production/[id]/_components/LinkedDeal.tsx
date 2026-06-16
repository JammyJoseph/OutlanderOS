"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Link2 } from "lucide-react";

interface Campaign {
  id: string;
  title: string;
  status: string;
  stage: string;
  value: number | null;
  currency: string;
  client: { id: string; name: string } | null;
}

interface Props {
  campaignId: string | null;
}

const STAGE_LABELS: Record<string, string> = {
  LEAD: "Lead",
  PITCHED: "Pitched",
  DEAL_SIGNED: "Deal Signed",
  CREATIVE_BRIEF: "Creative Brief",
  CREATIVE_REVIEW: "Creative Review",
  CREATIVE_APPROVED: "Creative Approved",
  APPROVAL: "Approval",
  IO_SIGNED: "IO Signed",
  CLEARED_FOR_PRODUCTION: "Cleared for Production",
  LIVE: "Live",
  COMPLETED: "Completed",
  PAID: "Paid",
  // legacy
  NEGOTIATING: "Pitched",
  BRIEF_RECEIVED: "Creative Brief",
  CREATIVE_RESPONSE: "Creative Review",
  CLIENT_REVIEW: "Creative Review",
  CLIENT_APPROVED: "Creative Approved",
  CONTRACTED: "Deal Signed",
  BUDGET_SET: "IO Signed",
};

const STAGE_STYLES: Record<string, string> = {
  LEAD: "bg-gray-100 text-gray-600",
  PITCHED: "bg-blue-50 text-blue-700",
  DEAL_SIGNED: "bg-amber-50 text-amber-700",
  CREATIVE_BRIEF: "bg-purple-50 text-purple-700",
  CREATIVE_REVIEW: "bg-purple-100 text-purple-700",
  CREATIVE_APPROVED: "bg-violet-50 text-violet-700",
  APPROVAL: "bg-sky-50 text-sky-700",
  IO_SIGNED: "bg-yellow-50 text-yellow-700",
  CLEARED_FOR_PRODUCTION: "bg-teal-50 text-teal-700",
  LIVE: "bg-emerald-50 text-emerald-700",
  COMPLETED: "bg-teal-50 text-teal-700",
  PAID: "bg-emerald-100 text-emerald-800",
  // legacy
  NEGOTIATING: "bg-blue-50 text-blue-700",
  BRIEF_RECEIVED: "bg-purple-50 text-purple-700",
  CREATIVE_RESPONSE: "bg-purple-100 text-purple-700",
  CLIENT_REVIEW: "bg-purple-100 text-purple-700",
  CLIENT_APPROVED: "bg-violet-50 text-violet-700",
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
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2 mb-3">
        <Link2 size={15} className="text-[#ffd700]" />
        Linked Deal
      </h2>
      <div className="space-y-2">
        <Link
          href={`/commercial/deals/${campaign.id}`}
          className="text-sm font-medium text-gray-900 hover:text-[#ffd700] transition-colors"
        >
          {campaign.title}
        </Link>
        {campaign.client?.name && (
          <p className="text-xs text-gray-500">{campaign.client.name}</p>
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
            <span className="text-xs font-medium text-gray-700">{budget}</span>
          )}
        </div>
        <Link
          href={`/commercial/deals/${campaign.id}`}
          className="inline-flex items-center gap-1 text-xs font-medium text-[#ffd700] hover:text-[#e6c200] pt-1"
        >
          View deal in Commercial <ArrowUpRight size={12} />
        </Link>
      </div>
    </div>
  );
}
