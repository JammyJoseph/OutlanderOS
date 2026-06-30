"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Loader2,
  LayoutDashboard,
  Briefcase,
  Film,
  Receipt,
  Newspaper,
  Contact,
  Shield,
  Sparkles,
} from "lucide-react";

interface Portal {
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
}

// Maps a team assignment to the portal it unlocks. Everyone also gets the Hub
// and Directory; admins additionally get the Admin portal.
const TEAM_PORTALS: Record<string, Portal> = {
  COMMERCIAL: { title: "Commercial", desc: "Pipeline, deals, clients & media plans", icon: Briefcase },
  PRODUCTION: { title: "Production", desc: "Projects, schedules & budgets", icon: Film },
  FINANCE: { title: "Finance", desc: "Invoices, expenses & P&L", icon: Receipt },
  OPERATIONS: { title: "Operations", desc: "Print, distribution & systems", icon: Newspaper },
  ADMIN: { title: "Admin", desc: "Team, settings & business plan", icon: Shield },
};

export default function WelcomePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [portals, setPortals] = useState<Portal[]>([]);
  const [loading, setLoading] = useState(true);
  const [entering, setEntering] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [meRes, permRes] = await Promise.all([
          fetch("/api/me"),
          fetch("/api/me/permissions"),
        ]);
        const me = await meRes.json().catch(() => ({}));
        const perm = await permRes.json().catch(() => ({}));

        // Already onboarded — don't show the welcome again.
        if (me?.user?.hasSeenWelcome) {
          router.replace("/me");
          return;
        }

        setName(me?.user?.name?.split(" ")[0] || me?.user?.name || "");

        const teams: string[] = Array.isArray(perm?.teams) ? perm.teams : [];
        const list: Portal[] = [
          { title: "Your Hub", desc: "Deadlines, tasks & your dashboard", icon: LayoutDashboard },
        ];
        for (const t of teams) {
          const p = TEAM_PORTALS[t];
          if (p && !list.some((x) => x.title === p.title)) list.push(p);
        }
        if (perm?.isAdmin && !list.some((x) => x.title === "Admin")) {
          list.push(TEAM_PORTALS.ADMIN);
        }
        list.push({ title: "Directory", desc: "Contacts & network", icon: Contact });
        setPortals(list);
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  async function getStarted() {
    setEntering(true);
    try {
      await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hasSeenWelcome: true }),
      });
    } catch {
      /* non-fatal — still let them in */
    }
    router.push("/me");
    router.refresh();
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#05060a] p-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,#10131f_0%,#05060a_55%,#020308_100%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/3 h-[460px] w-[460px] rounded-full bg-[#ffd700]/10 blur-3xl"
      />

      <div className="relative w-full max-w-lg">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
          </div>
        ) : (
          <>
            <div className="mb-8 text-center">
              <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#ffd700]/15 ring-1 ring-[#ffd700]/30">
                <Sparkles className="h-6 w-6 text-[#ffd700]" />
              </span>
              <h1 className="text-3xl font-extrabold tracking-tight text-white">
                Welcome to Outlander<span className="text-[#ffd700]">OS</span>
                {name ? <span className="text-white">, {name}</span> : ""}
              </h1>
              <p className="mt-3 text-sm text-gray-400">
                Your workspace is ready. Here&apos;s what you have access to:
              </p>
            </div>

            <div className="space-y-2.5">
              {portals.map((p) => {
                const Icon = p.icon;
                return (
                  <div
                    key={p.title}
                    className="flex items-center gap-3 rounded-xl border border-[#2a2a2a] bg-[#0e1018]/80 px-4 py-3 backdrop-blur-md"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#ffd700]/15">
                      <Icon className="h-4 w-4 text-[#ffd700]" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">{p.title}</p>
                      <p className="truncate text-xs text-gray-400">{p.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={getStarted}
              disabled={entering}
              className="mt-8 flex w-full items-center justify-center gap-2 rounded-lg bg-[#ffd700] py-3 text-sm font-semibold text-black transition-all duration-200 hover:brightness-110 disabled:opacity-50"
            >
              {entering ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Get Started
              {!entering && <ArrowRight className="h-4 w-4" />}
            </button>

            <p className="mt-6 text-center text-[11px] text-gray-500">
              Internal operating system · Outlander Magazine
            </p>
          </>
        )}
      </div>
    </div>
  );
}
