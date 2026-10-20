"use client";

import { useEffect, useState, use } from "react";
import { Check, Loader2, CalendarDays } from "lucide-react";
import { SuccessScreen, pill } from "@/components/os";

interface Info {
  shootTitle: string;
  shootDate: string;
  recipientName: string | null;
  alreadyConfirmed: boolean;
  confirmedAt: string | null;
  found: boolean;
}

export default function ConfirmReceiptPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [info, setInfo] = useState<Info | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    fetch(`/api/call-sheet/confirm/${token}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: Info) => {
        setInfo(d);
        setConfirmed(d.alreadyConfirmed);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [token]);

  async function confirmReceipt() {
    setBusy(true);
    try {
      const res = await fetch(`/api/call-sheet/confirm/${token}`, { method: "POST" });
      if (res.ok) setConfirmed(true);
    } finally {
      setBusy(false);
    }
  }

  const fmtDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return iso;
    }
  };

  if (!loading && info && confirmed) {
    return (
      <SuccessScreen title="Confirmed">
        Thanks{info.recipientName ? `, ${info.recipientName.split(" ")[0]}` : ""}. The production team can see
        you&apos;ve got the call sheet for {info.shootTitle}, {fmtDate(info.shootDate)}.
      </SuccessScreen>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-line px-4 py-5 sm:px-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/OutlanderOS_Logo_Ink.svg" alt="OutlanderOS" className="h-5 w-auto" />
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-[24px] bg-surface p-8 text-center">
          {loading ? (
            <Loader2 size={24} className="mx-auto animate-spin text-muted-foreground" />
          ) : error || !info ? (
            <>
              <h1 className="text-2xl font-semibold">Link not found</h1>
              <p className="mt-2 text-[15px] text-muted-foreground">
                This confirmation link is invalid or has expired.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-semibold leading-tight">{info.shootTitle}</h1>
              <p className="mt-2 flex items-center justify-center gap-1.5 text-[15px] text-muted-foreground">
                <CalendarDays size={16} /> {fmtDate(info.shootDate)}
              </p>
              {info.recipientName && (
                <p className="mt-4 text-[15px] text-ink-2">
                  Hi {info.recipientName.split(" ")[0]}, please confirm you&apos;ve received this call sheet.
                </p>
              )}
              <button onClick={confirmReceipt} disabled={busy} className={`${pill("primary")} mt-6 w-full`}>
                {busy ? <Loader2 className="animate-spin" /> : <Check />}
                Confirm receipt
              </button>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
