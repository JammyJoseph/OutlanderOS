"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Lightbulb, X } from "lucide-react";
import { SMART_TIPS } from "@/lib/smart-tips";

// A dismissible, once-per-user nudge. Drop <SmartTip id="..."/> where the tip
// should appear; the copy lives in lib/smart-tips.ts so tips read consistently
// and the API can validate dismissals against the same registry.
//
// Nothing renders until the dismissal list has loaded. The alternative — render
// first, hide when the fetch lands — flashes every dismissed tip at every
// visitor on every page load, which is exactly the nagging this system exists
// to avoid.

// One fetch per page load, shared by every tip on the page.
let dismissedPromise: Promise<Set<string>> | null = null;

function loadDismissed(): Promise<Set<string>> {
  dismissedPromise ??= fetch("/api/me/tips", { cache: "no-store" })
    .then((r) => r.json())
    .then((d) => new Set<string>(Array.isArray(d.dismissed) ? d.dismissed : []))
    .catch(() => new Set<string>());
  return dismissedPromise;
}

export default function SmartTip({ id, className }: { id: string; className?: string }) {
  const [visible, setVisible] = useState(false);
  const tip = SMART_TIPS[id];

  useEffect(() => {
    let mounted = true;
    void loadDismissed().then((set) => {
      if (mounted && !set.has(id)) setVisible(true);
    });
    return () => {
      mounted = false;
    };
  }, [id]);

  if (!tip || !visible) return null;

  function dismiss() {
    setVisible(false);
    // Update the shared cache so a re-mount on the same page load stays hidden.
    void loadDismissed().then((set) => set.add(id));
    void fetch("/api/me/tips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => undefined);
  }

  return (
    <div
      className={`flex items-start gap-3 rounded-xl border border-[#e7dfc9] bg-[#faf7ee] px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/20 ${className ?? ""}`}
    >
      <Lightbulb size={15} className="mt-0.5 shrink-0 text-[#9C7C2E] dark:text-amber-400" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{tip.title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-gray-600 dark:text-gray-400">{tip.body}</p>
        {tip.cta && (
          <Link
            href={tip.cta.href}
            className="mt-1.5 inline-block text-xs font-medium text-[#9C7C2E] underline-offset-2 hover:underline dark:text-amber-400"
          >
            {tip.cta.label}
          </Link>
        )}
      </div>
      <button
        onClick={dismiss}
        title="Got it, don't show this again"
        className="shrink-0 rounded-md p-1 text-gray-400 hover:bg-black/5 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-gray-200"
      >
        <X size={14} />
      </button>
    </div>
  );
}
