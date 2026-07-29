"use client";

import { use, useCallback, useEffect, useState } from "react";
import { Loader2, Check } from "lucide-react";

// Public invoice submission. Crew members aren't OutlanderOS users, so this page
// sits outside the portal shell entirely — no nav, no theme toggle, nothing that
// implies they should have an account. Registered as public in src/proxy.ts.

interface InvoiceRequest {
  supplierName: string;
  productionTitle: string | null;
  ioNumber: string | null;
  expectedAmount: number | null;
  currency: string;
  paymentDeadline: string;
  submitted: boolean;
  submittedAt: string | null;
  amount: number | null;
}

const money = (v: number, ccy: string) => {
  const s = ccy === "USD" ? "$" : ccy === "EUR" ? "€" : "£";
  return `${s}${v.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default function InvoiceSubmissionPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [req, setReq] = useState<InvoiceRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("GBP");
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/invoice/${token}`, { cache: "no-store" });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error ?? "This link isn’t valid.");
        return;
      }
      setReq(d.request);
      setCurrency(d.request.currency ?? "GBP");
      if (d.request.expectedAmount != null) setAmount(String(d.request.expectedAmount));
    } catch {
      setError("Something went wrong loading this page.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/invoice/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(amount), currency, attachmentUrl: url, notes }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error ?? "Couldn’t submit that.");
        return;
      }
      setDone(true);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <Shell>
        <div className="flex justify-center py-12">
          <Loader2 size={22} className="animate-spin text-gray-400" />
        </div>
      </Shell>
    );
  }

  if (error && !req) {
    return (
      <Shell>
        <h1 className="text-lg font-semibold text-gray-900">This link isn’t valid</h1>
        <p className="mt-2 text-sm text-gray-600">
          It may have expired or been mistyped. Reply to the email we sent and we’ll sort it out.
        </p>
      </Shell>
    );
  }

  if (done || req?.submitted) {
    const shown = done ? Number(amount) : req?.amount ?? 0;
    return (
      <Shell>
        <div className="flex items-center gap-2 text-emerald-700">
          <Check size={18} />
          <h1 className="text-lg font-semibold">Invoice received</h1>
        </div>
        <p className="mt-2 text-sm text-gray-600">
          Thank you{req?.supplierName ? `, ${req.supplierName.split(" ")[0]}` : ""} — we have{" "}
          <strong>{money(shown, currency)}</strong> against{" "}
          {req?.productionTitle ?? "your work with us"}.
        </p>
        <p className="mt-2 text-sm text-gray-600">
          It’s with our finance team now. We aim to pay by{" "}
          <strong>
            {req?.paymentDeadline
              ? new Date(req.paymentDeadline).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })
              : "within 30 days"}
          </strong>
          .
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="text-lg font-semibold text-gray-900">Submit your invoice</h1>
      <p className="mt-1 text-sm text-gray-600">
        Hi {req?.supplierName?.split(" ")[0]} — thanks for your work on{" "}
        <strong>{req?.productionTitle ?? "the shoot"}</strong>.
      </p>

      {req?.ioNumber && (
        <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">
          Please quote <strong>{req.ioNumber}</strong> on your invoice.
        </p>
      )}

      <form onSubmit={submit} className="mt-5 space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
            Invoice amount
          </label>
          <div className="mt-1 flex gap-2">
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm"
            >
              <option>GBP</option>
              <option>USD</option>
              <option>EUR</option>
            </select>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="0.00"
            />
          </div>
          {req?.expectedAmount != null && (
            <p className="mt-1 text-xs text-gray-500">
              We have {money(req.expectedAmount, req.currency)} agreed for your role. If your
              invoice differs, tell us why below.
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
            Link to your invoice
          </label>
          <input
            type="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://drive.google.com/…"
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-gray-500">
            Drive, Dropbox, WeTransfer — anywhere we can open it. Make sure it’s shared so we can
            view it.
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
            Anything we should know? <span className="font-normal normal-case">(optional)</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="mt-1 w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="Extra days, expenses, a different rate…"
          />
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-xl bg-[#111] px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {busy && <Loader2 size={14} className="animate-spin" />}
          Submit invoice
        </button>
      </form>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#faf9f7] px-5 py-12">
      <div className="mx-auto max-w-lg">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/OutlanderOS_Logo_Light.svg"
          alt="Outlander"
          className="mb-8 h-5 w-auto"
        />
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">{children}</div>
        <p className="mt-6 text-center text-xs text-gray-400">
          Outlander Magazine Ltd · Company 13257633 · VAT GB 483323490
        </p>
      </div>
    </div>
  );
}
