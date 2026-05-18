"use client";

import Link from "next/link";
import { Briefcase, Film, Newspaper, Plane, User, ArrowRight } from "lucide-react";
import type { Holiday } from "./types";

interface Props {
  holiday: Holiday;
}

export function QuickAccess({ holiday }: Props) {
  const links = [
    { label: "My Deals", href: "/commercial", icon: Briefcase, hint: "Brand partnerships" },
    { label: "My Productions", href: "/production", icon: Film, hint: "Shoots & call sheets" },
    { label: "My Print Features", href: "/print", icon: Newspaper, hint: "Editorial print" },
    {
      label: "Holiday Balance",
      href: "/me/holiday",
      icon: Plane,
      hint: `${holiday.remaining} of ${holiday.allowance} days left`,
    },
    { label: "Profile & Settings", href: "/me/profile", icon: User, hint: "Your details" },
  ];

  return (
    <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-bold text-gray-900">Quick Access</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="group flex flex-col gap-2 rounded-xl border border-gray-100 bg-gray-50/60 p-4 transition-colors hover:border-[#D4A853]/40 hover:bg-[#D4A853]/5"
          >
            <div className="flex items-center justify-between">
              <l.icon className="h-5 w-5 text-[#D4A853]" />
              <ArrowRight className="h-4 w-4 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-gray-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">{l.label}</p>
              <p className="text-xs text-gray-400">{l.hint}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
