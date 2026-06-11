"use client";

import Link from "next/link";
import { Banknote, Briefcase, Clapperboard, Newspaper } from "lucide-react";
import { PORTAL_COLORS, type QuickLinkCounts } from "./types";

interface Props {
  counts: QuickLinkCounts;
}

// Quick links into the four portals, each with its accent colour and a count.
export function QuickLinks({ counts }: Props) {
  const links = [
    {
      label: "Commercial Pipeline",
      href: "/commercial/pipeline",
      portal: "commercial",
      count: counts.deals,
      unit: "deals",
      icon: Briefcase,
    },
    {
      label: "Production Studio",
      href: "/production",
      portal: "production",
      count: counts.productions,
      unit: "productions",
      icon: Clapperboard,
    },
    {
      label: "Finance Overview",
      href: "/finance",
      portal: "finance",
      count: counts.financeProjects,
      unit: "projects",
      icon: Banknote,
    },
    {
      label: "Print Planning",
      href: "/print",
      portal: "print",
      count: counts.printIssues,
      unit: "issues",
      icon: Newspaper,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {links.map((l) => {
        const colors = PORTAL_COLORS[l.portal];
        const Icon = l.icon;
        return (
          <Link
            key={l.href}
            href={l.href}
            className="group flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-3 shadow-sm transition-shadow hover:shadow-md"
            style={{ borderLeft: `3px solid ${colors.accent}` }}
          >
            <Icon className="h-4 w-4 shrink-0" style={{ color: colors.accent }} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-semibold text-gray-800 group-hover:text-gray-900">
                {l.label}
              </div>
              <div className="text-[11px] text-gray-400">
                {l.count} {l.unit}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
