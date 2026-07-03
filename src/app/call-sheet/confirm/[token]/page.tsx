"use client";

import { useEffect, useState, use } from "react";
import { Check, Loader2, CalendarDays } from "lucide-react";

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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm p-8 text-center">
        {loading ? (
          <Loader2 size={24} className="animate-spin text-gray-400 mx-auto" />
        ) : error || !info ? (
          <>
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">Link not found</p>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              This confirmation link is invalid or has expired.
            </p>
          </>
        ) : (
          <>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-900/30">
              <Check size={26} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {info.shootTitle}
            </h1>
            <p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
              <CalendarDays size={14} /> {fmtDate(info.shootDate)}
            </p>
            {info.recipientName && (
              <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
                Hi {info.recipientName.split(" ")[0]}, please confirm you&apos;ve received this call
                sheet.
              </p>
            )}

            {confirmed ? (
              <div className="mt-6 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 px-4 py-3">
                <p className="flex items-center justify-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                  <Check size={16} /> Receipt confirmed — thank you!
                </p>
              </div>
            ) : (
              <button
                onClick={confirmReceipt}
                disabled={busy}
                className="mt-6 inline-flex items-center justify-center gap-2 w-full rounded-xl bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-4 py-3 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                Confirm receipt
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
