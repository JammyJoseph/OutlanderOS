"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import {
  Briefcase,
  Film,
  Newspaper,
  PenTool,
  BookUser,
  DollarSign,
  Shield,
  MessageCircle,
  TrendingUp,
  Users,
  AlertCircle,
  Activity,
} from "lucide-react";

function greeting(name?: string | null): string {
  const hour = new Date().getHours();
  const time = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  return `Good ${time}${name ? `, ${name.split(" ")[0]}` : ""}`;
}

function formatDate(): string {
  return new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

interface KpiStats {
  bookedRevenue: number;
  activeCampaigns: number;
  outstandingInvoices: number;
  outstandingCount: number;
  contactsCount: number;
}

export default function HubPage() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<KpiStats>({
    bookedRevenue: 0,
    activeCampaigns: 0,
    outstandingInvoices: 0,
    outstandingCount: 0,
    contactsCount: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [campaignsRes, contactsRes, dashboardRes] = await Promise.allSettled([
          fetch("/api/campaigns"),
          fetch("/api/contacts"),
          fetch("/api/dashboard"),
        ]);

        let activeCampaigns = 0;
        let bookedRevenue = 0;
        if (campaignsRes.status === "fulfilled" && campaignsRes.value.ok) {
          const campaigns = await campaignsRes.value.json();
          activeCampaigns = campaigns.filter(
            (c: { status: string }) => ["BOOKED", "LIVE"].includes(c.status)
          ).length;
          bookedRevenue = campaigns
            .filter((c: { status: string }) =>
              ["BOOKED", "LIVE", "DELIVERED", "PAID"].includes(c.status)
            )
            .reduce((sum: number, c: { value?: number }) => sum + (c.value || 0), 0);
        }

        let contactsCount = 0;
        if (contactsRes.status === "fulfilled" && contactsRes.value.ok) {
          const contacts = await contactsRes.value.json();
          contactsCount = Array.isArray(contacts) ? contacts.length : 0;
        }

        let outstandingInvoices = 0;
        let outstandingCount = 0;
        if (dashboardRes.status === "fulfilled" && dashboardRes.value.ok) {
          const dash = await dashboardRes.value.json();
          if (dash.xero?.invoices) {
            const outstanding = (
              dash.xero.invoices as Array<{ Status: string; AmountDue?: number }>
            ).filter((inv) => inv.Status === "AUTHORISED" || inv.Status === "SENT");
            outstandingCount = outstanding.length;
            outstandingInvoices = outstanding.reduce(
              (sum, inv) => sum + (inv.AmountDue || 0),
              0
            );
          }
        }

        setStats({
          bookedRevenue,
          activeCampaigns,
          outstandingInvoices,
          outstandingCount,
          contactsCount,
        });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const fmt = (n: number) =>
    "£" + n.toLocaleString("en-GB", { maximumFractionDigits: 0 });

  const kpis = [
    {
      label: "Booked Revenue YTD",
      value: loading ? "—" : fmt(stats.bookedRevenue),
      icon: TrendingUp,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      label: "Active Campaigns",
      value: loading ? "—" : String(stats.activeCampaigns),
      icon: Activity,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      label: "Outstanding Invoices",
      value: loading ? "—" : fmt(stats.outstandingInvoices),
      sub:
        stats.outstandingCount > 0
          ? `${stats.outstandingCount} invoice${stats.outstandingCount !== 1 ? "s" : ""}`
          : undefined,
      icon: AlertCircle,
      color: "text-red-500",
      bg: "bg-red-50",
    },
    {
      label: "Team Online",
      value: "5",
      icon: Users,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
  ];

  const portals = [
    {
      icon: Briefcase,
      name: "Commercial",
      description: "Brand partnerships, campaigns, media plans",
      href: "/commercial",
      stat: loading ? "—" : `${stats.activeCampaigns} active campaigns`,
    },
    {
      icon: Film,
      name: "Production",
      description: "Briefs, call sheets, shoot management",
      href: "/production",
      stat: "2 upcoming shoots",
    },
    {
      icon: Newspaper,
      name: "Print",
      description: "Magazine planning, flat plan, distribution",
      href: "/print",
      stat: "Issue 2026 — Planning",
    },
    {
      icon: PenTool,
      name: "Editorial",
      description: "Content pipeline, writers, calendar",
      href: "/editorial",
      stat: "12 pieces in pipeline",
    },
    {
      icon: BookUser,
      name: "Contacts",
      description: "Blackbook, everyone you work with",
      href: "/contacts",
      stat: loading ? "—" : `${stats.contactsCount} contacts`,
    },
    {
      icon: DollarSign,
      name: "Finance",
      description: "Revenue, billing, Xero, cash flow",
      href: "/finance",
      adminOnly: true,
      stat: loading ? "—" : `${fmt(stats.bookedRevenue)} YTD`,
    },
    {
      icon: Shield,
      name: "Admin",
      description: "Team, system, settings, engine room",
      href: "/admin",
      adminOnly: true,
      stat: "5 team members",
    },
    {
      icon: MessageCircle,
      name: "Ask OS",
      description: "AI assistant for your business",
      href: "/ask-os",
      stat: "AI ready",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-10">
      <div className="mx-auto max-w-5xl">
        {/* Greeting */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            {greeting(session?.user?.name)}
          </h1>
          <p className="mt-1 text-sm text-gray-500">{formatDate()}</p>
        </div>

        {/* KPI Row */}
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {kpis.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <div
                key={kpi.label}
                className="rounded-xl border border-gray-200 bg-white p-5"
              >
                <div
                  className={`mb-3 flex h-9 w-9 items-center justify-center rounded-lg ${kpi.bg}`}
                >
                  <Icon className={`h-[18px] w-[18px] ${kpi.color}`} />
                </div>
                <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
                {kpi.sub && (
                  <p className="text-[11px] text-gray-400">{kpi.sub}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">{kpi.label}</p>
              </div>
            );
          })}
        </div>

        {/* Portal grid */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {portals.map((portal) => {
            const Icon = portal.icon;
            return (
              <Link
                key={portal.href}
                href={portal.href}
                className="group relative flex flex-col rounded-xl border border-gray-200 bg-white p-5 transition-all hover:border-[#D4A853]/40 hover:shadow-md hover:shadow-amber-100/50"
              >
                {(portal as { adminOnly?: boolean }).adminOnly && (
                  <span className="absolute right-3 top-3 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                    Admin
                  </span>
                )}
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 transition-colors group-hover:bg-amber-50">
                  <Icon className="h-5 w-5 text-gray-500 transition-colors group-hover:text-[#D4A853]" />
                </div>
                <p className="font-semibold text-gray-900">{portal.name}</p>
                <p className="mt-1 text-xs leading-snug text-gray-500">
                  {portal.description}
                </p>
                {portal.stat && (
                  <p className="mt-3 text-xs font-medium text-[#D4A853]">
                    {portal.stat}
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
