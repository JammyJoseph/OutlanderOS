"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  FileText,
  ExternalLink,
  Image,
  Mail,
  CheckCircle2,
  Clock,
  XCircle,
  Info,
} from "lucide-react";

type CampaignStatus =
  | "BRIEF_RECEIVED"
  | "BRIEF_RESPONDED"
  | "BOOKED"
  | "LIVE"
  | "DELIVERED"
  | "PAID";

type CampaignType =
  | "SUPPLIED_ASSET"
  | "BESPOKE_PRODUCTION"
  | "WHITE_LABEL"
  | "EDITORIAL_FEATURE"
  | "PRINT_AD";

interface MediaPlanSummary {
  id: string;
  campaignName: string;
  status: string;
}

interface AssetSummary {
  id: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
}

interface Campaign {
  id: string;
  title: string;
  type: CampaignType;
  status: CampaignStatus;
  value?: number;
  currency: string;
  timelineStart?: string;
  timelineEnd?: string;
  ioUrl?: string;
  ioSigned: boolean;
  notes?: string;
  mediaPlans: MediaPlanSummary[];
  assets: AssetSummary[];
}

interface ClientDetail {
  id: string;
  name: string;
  industry?: string;
  brandColor?: string;
  campaigns: Campaign[];
}

const STATUS_CONFIG: Record<CampaignStatus, { label: string; color: string; icon: React.ElementType }> = {
  BRIEF_RECEIVED: { label: "Brief Received", color: "bg-gray-100 text-gray-600", icon: Clock },
  BRIEF_RESPONDED: { label: "Brief Responded", color: "bg-blue-100 text-blue-700", icon: Clock },
  BOOKED: { label: "Booked", color: "bg-amber-100 text-amber-700", icon: CheckCircle2 },
  LIVE: { label: "Live", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  DELIVERED: { label: "Delivered", color: "bg-purple-100 text-purple-700", icon: CheckCircle2 },
  PAID: { label: "Paid", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
};

const TYPE_LABELS: Record<CampaignType, string> = {
  SUPPLIED_ASSET: "Supplied Asset",
  BESPOKE_PRODUCTION: "Bespoke Production",
  WHITE_LABEL: "White Label",
  EDITORIAL_FEATURE: "Editorial Feature",
  PRINT_AD: "Print Ad",
};

const TYPE_COLORS: Record<CampaignType, string> = {
  SUPPLIED_ASSET: "bg-gray-100 text-gray-600",
  BESPOKE_PRODUCTION: "bg-blue-100 text-blue-700",
  WHITE_LABEL: "bg-purple-100 text-purple-700",
  EDITORIAL_FEATURE: "bg-amber-100 text-amber-700",
  PRINT_AD: "bg-pink-100 text-pink-700",
};

function fmt(n: number, currency: string): string {
  const symbol = currency === "USD" ? "$" : currency === "EUR" ? "€" : "£";
  if (n >= 1_000_000) return symbol + (n / 1_000_000).toFixed(1) + "m";
  if (n >= 1_000) return symbol + (n / 1_000).toFixed(1) + "k";
  return symbol + n.toLocaleString("en-GB", { maximumFractionDigits: 0 });
}

function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();
}

function fmtDate(d?: string): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function InviteButton() {
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!show) return;
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setShow(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [show]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setShow((s) => !s)}
        className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
      >
        <Mail className="h-4 w-4" />
        Invite Client
      </button>
      {show && (
        <div className="absolute right-0 top-full mt-2 w-52 rounded-xl border border-gray-200 bg-white p-3 shadow-lg z-10">
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#D4A853]" />
            <p className="text-xs text-gray-500 leading-snug">
              Client portal invitations are <span className="font-semibold text-gray-700">coming soon</span>.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/clients/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setClient)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-20 animate-pulse rounded-xl bg-gray-100" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="p-6 text-center text-sm text-gray-400">
        <XCircle className="mx-auto mb-2 h-8 w-8 text-gray-200" />
        Client not found
      </div>
    );
  }

  const totalSpend = client.campaigns.reduce((s, c) => s + (c.value ?? 0), 0);
  const primaryCurrency = client.campaigns[0]?.currency ?? "GBP";

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <Link
          href="/commercial/clients"
          className="mb-3 inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All Clients
        </Link>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-xl text-white font-bold text-lg"
              style={{ backgroundColor: client.brandColor ?? "#D4A853" }}
            >
              {initials(client.name)}
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{client.name}</h1>
              <div className="mt-0.5 flex items-center gap-3 text-sm text-gray-500">
                {client.industry && <span>{client.industry}</span>}
                <span className="text-[#D4A853] font-semibold">
                  {fmt(totalSpend, primaryCurrency)} total
                </span>
                <span>{client.campaigns.length} campaign{client.campaigns.length !== 1 ? "s" : ""}</span>
              </div>
            </div>
          </div>
          <InviteButton />
        </div>
      </div>

      {/* Campaign list */}
      <div className="flex-1 overflow-auto p-6">
        {client.campaigns.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 p-12 text-center">
            <FileText className="mx-auto h-8 w-8 text-gray-300" />
            <p className="mt-3 text-sm text-gray-400">No campaigns yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400">
              Campaigns ({client.campaigns.length})
            </h2>
            {client.campaigns.map((campaign) => {
              const StatusIcon = STATUS_CONFIG[campaign.status]?.icon ?? Clock;
              return (
                <div
                  key={campaign.id}
                  className="rounded-xl border border-gray-200 bg-white p-5"
                >
                  {/* Campaign header */}
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900">{campaign.title}</h3>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${TYPE_COLORS[campaign.type]}`}>
                          {TYPE_LABELS[campaign.type]}
                        </span>
                        <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_CONFIG[campaign.status]?.color}`}>
                          <StatusIcon className="h-3 w-3" />
                          {STATUS_CONFIG[campaign.status]?.label}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-3 text-xs text-gray-400">
                        {campaign.timelineStart && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {fmtDate(campaign.timelineStart)} → {fmtDate(campaign.timelineEnd)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {campaign.value && (
                        <span className="text-base font-bold text-gray-900">
                          {fmt(campaign.value, campaign.currency)}
                        </span>
                      )}
                      <Link
                        href={`/commercial?campaign=${campaign.id}`}
                        className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        View
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>

                  {/* Links row */}
                  <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100">
                    {/* Media plans */}
                    {campaign.mediaPlans.length > 0 ? (
                      campaign.mediaPlans.map((mp) => (
                        <Link
                          key={mp.id}
                          href={`/commercial/media-plans/${mp.id}`}
                          className="flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors"
                        >
                          <FileText className="h-3 w-3" />
                          Media Plan
                        </Link>
                      ))
                    ) : (
                      <Link
                        href="/commercial/media-plans/new"
                        className="flex items-center gap-1.5 rounded-lg bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-400 hover:bg-gray-100 transition-colors"
                      >
                        <FileText className="h-3 w-3" />
                        + Media Plan
                      </Link>
                    )}

                    {/* IO */}
                    {campaign.ioUrl ? (
                      <a
                        href={campaign.ioUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100 transition-colors"
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        IO {campaign.ioSigned ? "(Signed)" : "(Pending)"}
                      </a>
                    ) : (
                      <span className="flex items-center gap-1.5 rounded-lg bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-400">
                        <CheckCircle2 className="h-3 w-3" />
                        No IO
                      </span>
                    )}

                    {/* Content tracker */}
                    <Link
                      href={`/commercial/content-tracker?campaign=${campaign.id}`}
                      className="flex items-center gap-1.5 rounded-lg bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-700 hover:bg-purple-100 transition-colors"
                    >
                      <Calendar className="h-3 w-3" />
                      Content Tracker
                    </Link>

                    {/* Assets */}
                    {campaign.assets.length > 0 && (
                      <span className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                        <Image className="h-3 w-3" />
                        {campaign.assets.length} Asset{campaign.assets.length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>

                  {campaign.notes && (
                    <p className="mt-3 text-xs text-gray-500 italic">"{campaign.notes}"</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
