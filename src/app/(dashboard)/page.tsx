"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  Briefcase,
  Film,
  Newspaper,
  PenTool,
  BookUser,
  DollarSign,
  Shield,
  MessageCircle,
} from "lucide-react";

interface PortalCard {
  icon: React.ElementType;
  name: string;
  description: string;
  href: string;
  adminOnly?: boolean;
  stat?: string;
}

const portals: PortalCard[] = [
  {
    icon: Briefcase,
    name: "Commercial",
    description: "Brand partnerships, campaigns, media plans",
    href: "/commercial",
    stat: "8 active",
  },
  {
    icon: Film,
    name: "Production",
    description: "Briefs, call sheets, shoot management",
    href: "/production",
    stat: "2 shoots",
  },
  {
    icon: Newspaper,
    name: "Print",
    description: "Magazine planning, flat plan, distribution",
    href: "/print",
    stat: "Issue 14",
  },
  {
    icon: PenTool,
    name: "Editorial",
    description: "Content pipeline, writers, calendar",
    href: "/editorial",
    stat: "12 pieces",
  },
  {
    icon: BookUser,
    name: "Contacts",
    description: "Blackbook, everyone you work with",
    href: "/contacts",
    stat: "247 contacts",
  },
  {
    icon: DollarSign,
    name: "Finance",
    description: "Revenue, billing, Xero, cash flow",
    href: "/finance",
    adminOnly: true,
    stat: "£842k YTD",
  },
  {
    icon: Shield,
    name: "Admin",
    description: "Team, system, settings, engine room",
    href: "/admin",
    adminOnly: true,
  },
  {
    icon: MessageCircle,
    name: "Ask OS",
    description: "AI assistant for your business",
    href: "/ask-os",
  },
];

function greeting(name?: string | null): string {
  const hour = new Date().getHours();
  const time = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  return `Good ${time}${name ? `, ${name.split(" ")[0]}` : ""}`;
}

export default function HubPage() {
  const { data: session } = useSession();

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-10">
      <div className="mx-auto max-w-5xl">
        {/* Greeting */}
        <div className="mb-10">
          <h1 className="text-2xl font-bold text-gray-900">
            {greeting(session?.user?.name)}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Where would you like to work today?
          </p>
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
                {portal.adminOnly && (
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
