"use client";

// First sign-in, after choosing a password: step 2 (connect Google) and step 3
// (what you can use). Either way out marks the welcome as seen, so it is only
// ever shown once.
//
// Connecting Google itself happens in Settings, which already handles both the
// hosted redirect and the paste-a-code fallback; this page sends you there
// rather than keeping a second copy of that flow.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, FileSpreadsheet, Mail } from "lucide-react";
import { FlowFrame, FlowTitle, Rows, Row, Dot } from "@/components/os";
import { visibleWorkspaces } from "@/lib/workspaces";

type Step = "loading" | "google" | "done";

const PERKS = [
  { icon: CalendarDays, title: "Calendar", text: "Shoots, deadlines and meetings appear on your dashboard week." },
  { icon: FileSpreadsheet, title: "Drive and Sheets", text: "Budgets, call sheets and media plans save to the right project folder." },
  { icon: Mail, title: "Gmail", text: "Send IOs and invoices from your own address." },
];

export default function WelcomePage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("loading");
  const [name, setName] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [meRes, permRes] = await Promise.all([fetch("/api/me"), fetch("/api/me/permissions")]);
        const me = await meRes.json().catch(() => ({}));
        const perm = await permRes.json().catch(() => ({}));
        // Already onboarded — don't show the welcome again.
        if (me?.user?.hasSeenWelcome) {
          router.replace("/hub");
          return;
        }
        setName(me?.user?.name?.split(" ")[0] || me?.user?.name || "");
        setIsAdmin(!!perm?.isAdmin);
        setStep(me?.user?.googleConnected ? "done" : "google");
      } catch {
        setStep("google");
      }
    })();
  }, [router]);

  async function finish(to: string) {
    setBusy(true);
    try {
      await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hasSeenWelcome: true }),
      });
    } catch {
      /* non-fatal — still let them in */
    }
    router.push(to);
    router.refresh();
  }

  if (step === "loading") return <div className="min-h-dvh bg-background" />;

  const steps = ["Password", "Google", "Done"];

  if (step === "google") {
    return (
      <FlowFrame steps={steps} current={1} onClose={() => setStep("done")}>
        <FlowTitle sub="OutlanderOS reads from your Outlander Google account so your day is in one place. You can disconnect it in Settings.">
          Connect your Google account
        </FlowTitle>
        <Rows className="mb-8">
          {PERKS.map((p) => (
            <Row
              key={p.title}
              lead={
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface">
                  <p.icon className="size-5 text-ink-2" strokeWidth={1.75} aria-hidden />
                </span>
              }
              title={p.title}
              meta={<span className="whitespace-normal">{p.text}</span>}
              className="[&_.truncate]:whitespace-normal"
            />
          ))}
        </Rows>
        <button
          type="button"
          disabled={busy}
          onClick={() => finish("/me/settings#google")}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-primary px-6 text-[15px] font-semibold text-primary-foreground hover:brightness-[0.97] disabled:opacity-50"
        >
          Connect Google account
        </button>
        <p className="mt-5 text-center">
          <button
            type="button"
            onClick={() => setStep("done")}
            className="text-sm font-semibold underline decoration-[1.5px] underline-offset-4 hover:text-brand"
          >
            Skip for now
          </button>
        </p>
      </FlowFrame>
    );
  }

  const spaces = visibleWorkspaces(isAdmin);
  return (
    <FlowFrame steps={steps} current={2} onClose={() => finish("/hub")}>
      <FlowTitle sub="Here's what you can use. You can switch between them from the top of the sidebar.">
        {name ? `You're all set, ${name}` : "You're all set"}
      </FlowTitle>
      <Rows className="mb-8">
        {spaces.map((w) => (
          <Row
            key={w.key}
            lead={
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface">
                <Dot color={w.dot} />
              </span>
            }
            title={w.name}
            meta={w.blurb}
          />
        ))}
      </Rows>
      <button
        type="button"
        disabled={busy}
        onClick={() => finish("/hub")}
        className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-primary px-6 text-[15px] font-semibold text-primary-foreground hover:brightness-[0.97] disabled:opacity-50"
      >
        {busy ? "Opening…" : "Open OutlanderOS"}
      </button>
    </FlowFrame>
  );
}
