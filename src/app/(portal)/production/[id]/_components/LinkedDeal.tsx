"use client";

import { useEffect, useState } from "react";
import { Link2 } from "lucide-react";

interface Campaign {
  id: string;
  title: string;
  status: string;
  value: number | null;
  currency: string;
  client: { id: string; name: string } | null;
}

interface Props {
  campaignId: string | null;
}

function formatStatus(status: string): string {
  return status
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

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
        <Link2 size={15} className="text-[#D4A853]" />
        Linked Deal
      </h2>
      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-900">{campaign.title}</p>
        {campaign.client?.name && (
          <p className="text-xs text-gray-500">{campaign.client.name}</p>
        )}
        <div className="flex items-center gap-2 pt-1">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-[11px] font-medium text-gray-600">
            {formatStatus(campaign.status)}
          </span>
          {budget && (
            <span className="text-xs font-medium text-gray-700">{budget}</span>
          )}
        </div>
      </div>
    </div>
  );
}
