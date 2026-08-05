"use client";

import { use, useCallback, useEffect, useState } from "react";
import { Loader2, Check, Lock } from "lucide-react";

// Public credit-confirmation page. Contributors aren't OutlanderOS users, so
// this sits outside the portal shell — no nav, nothing implying an account.
// Registered as public in src/proxy.ts.
//
// The page is deliberately staged. First the agreement, in plain language, with
// what-we-print and what-stays-private given equal weight. Only after accepting
// does the full picture of what's being built appear, together with the form.
// That ordering is the point: the confidentiality terms cover what the page is
// about to reveal.

interface CreditData {
  request: {
    name: string;
    role: string | null;
    instagram: string | null;
    email: string | null;
    accepted: boolean;
    responded: boolean;
    confirmedName: string | null;
    printConsent: boolean | null;
  };
  agreement: {
    version: string;
    summary: string;
    terms: { heading: string; body: string }[];
  };
}

export default function CreditConfirmPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [data, setData] = useState<CreditData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // agreement → form → done | declined
  const [stage, setStage] = useState<"agreement" | "form" | "done" | "declined">("agreement");

  const [name, setName] = useState("");
  const [instagram, setInstagram] = useState("");
  const [email, setEmail] = useState("");
  const [addr, setAddr] = useState({ line1: "", line2: "", city: "", region: "", postcode: "", country: "" });
  const [agree, setAgree] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [declineNote, setDeclineNote] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/credit/${token}`, { cache: "no-store" });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error ?? "This link isn’t valid.");
        return;
      }
      setData(d);
      const r = d.request;
      setName(r.name ?? "");
      setInstagram((r.instagram ?? "").replace(/^@+/, ""));
      setEmail(r.email ?? "");
      if (r.responded) setStage(r.printConsent ? "done" : "declined");
      else if (r.accepted) setStage("form");
    } catch {
      setError("Something went wrong loading this page.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function post(body: Record<string, unknown>) {
    const res = await fetch(`/api/credit/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error ?? "Something went wrong.");
    return d;
  }

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      await post({ action: "accept" });
      setStage("form");
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await post({ action: "submit", name, instagram, email, address: addr, agree });
      setStage("done");
    } catch (err) {
      setError(String((err as Error).message));
    } finally {
      setBusy(false);
    }
  }

  async function decline() {
    setBusy(true);
    setError(null);
    try {
      await post({ action: "decline", note: declineNote });
      setStage("declined");
    } catch (err) {
      setError(String((err as Error).message));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <Shell>
        <div className="flex justify-center py-16">
          <Loader2 size={22} className="animate-spin text-gray-400" />
        </div>
      </Shell>
    );
  }

  if (error && !data) {
    return (
      <Shell>
        <h1 className="font-serif text-2xl text-black">This link isn’t valid</h1>
        <p className="mt-3 text-sm leading-relaxed text-gray-600">
          It may have expired or been mistyped. Reply to the email we sent you and we’ll sort it
          out.
        </p>
      </Shell>
    );
  }

  const r = data!.request;
  const first = (r.name || "").trim().split(/\s+/)[0];

  // ── Done ──
  if (stage === "done") {
    return (
      <Shell>
        <div className="flex items-center gap-2.5 text-emerald-700">
          <Check size={20} />
          <h1 className="font-serif text-2xl text-black">You’re in the Directory</h1>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-gray-600">
          Thank you{first ? `, ${first}` : ""}. Your credit is confirmed
          {r.confirmedName ? (
            <>
              {" "}
              as <strong className="text-black">{r.confirmedName}</strong>
            </>
          ) : null}
          . We’ll be in touch before the issue is announced. Until then, this stays between us. A confirmation email is on its way to you.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-gray-600">
          Need to change anything? Email{" "}
          <a href="mailto:silver@outlandermag.com" className="underline">
            silver@outlandermag.com
          </a>
          .
        </p>
      </Shell>
    );
  }

  // ── Declined ──
  if (stage === "declined") {
    return (
      <Shell>
        <h1 className="font-serif text-2xl text-black">Understood</h1>
        <p className="mt-4 text-sm leading-relaxed text-gray-600">
          We won’t print your name, and that’s the end of it, no hard feelings. We’ve emailed you confirmation of that choice. If you change your
          mind before we go to print, email{" "}
          <a href="mailto:silver@outlandermag.com" className="underline">
            silver@outlandermag.com
          </a>
          .
        </p>
      </Shell>
    );
  }

  // ── Stage 1: the agreement ──
  if (stage === "agreement") {
    return (
      <Shell>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">
          Private &amp; confidential{first ? ` · for ${r.name}` : ""}
        </p>
        <h1 className="mt-3 font-serif text-3xl leading-tight text-black">
          We’d like to put your name in print.
        </h1>

        {data!.agreement.summary.split("\n\n").map((p, i) => (
          <p key={i} className="mt-4 text-sm leading-relaxed text-black">
            {p}
          </p>
        ))}

        <div className="mt-8 space-y-5 border-t border-gray-200 pt-6">
          {data!.agreement.terms.map((t) => (
            <div key={t.heading}>
              <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-500">
                {t.heading}
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-black">{t.body}</p>
            </div>
          ))}
        </div>

        {error && <p className="mt-5 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            onClick={accept}
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#111] px-6 py-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            I agree, show me
          </button>
          <button
            onClick={() => setDeclining(true)}
            className="text-sm text-gray-500 underline-offset-2 hover:underline"
          >
            I’d rather not be included
          </button>
        </div>

        {declining && (
          <div className="mt-5 rounded-xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm text-black">
              No problem, we won’t print your name. If you’d like to tell us why, it helps; if
              not, just confirm.
            </p>
            <textarea
              value={declineNote}
              onChange={(e) => setDeclineNote(e.target.value)}
              rows={2}
              placeholder="Optional"
              className="mt-3 w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <button
              onClick={decline}
              disabled={busy}
              className="mt-3 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-100 disabled:opacity-50"
            >
              Confirm, leave me out
            </button>
          </div>
        )}
      </Shell>
    );
  }

  // ── Stage 2: the reveal + the form ──
  return (
    <Shell>
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">
        The Outlander Directory · Issue 02
      </p>
      <h1 className="mt-3 font-serif text-3xl leading-tight text-black">
        A printed index of the people who make this culture.
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-black">
        Issue 02 of Outlander Magazine will carry a Directory: a curated, printed index of the
        photographers, stylists, producers, directors and designers behind the work, filed by
        discipline, in print, on paper that outlasts a feed. Not a follower count in sight. You’ve
        been selected{r.role ? ` as ${/^[aeiou]/i.test(r.role) ? "an" : "a"} ${r.role}` : ""}, and
        we’d like to credit you exactly as you want to be credited.
      </p>

      <form onSubmit={submit} className="mt-8 space-y-5">
        <Field label="Name, exactly as it should appear in print" required>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Instagram handle">
            <div className="flex items-center rounded-lg border border-gray-300">
              <span className="pl-3 text-sm text-gray-400">@</span>
              <input
                type="text"
                value={instagram}
                onChange={(e) => setInstagram(e.target.value.replace(/^@+/, ""))}
                className="w-full rounded-lg border-0 px-2 py-2.5 text-sm outline-none"
              />
            </div>
          </Field>
          <Field label="Best email for you">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
            />
          </Field>
        </div>

        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <div className="flex items-center gap-2">
            <Lock size={13} className="text-gray-500" />
            <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-500">
              Postal address, kept private
            </h2>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-gray-600">
            Never printed, never shared. We ask for one reason: so we can send you something. Leave
            it blank if you’d rather not.
          </p>
          <div className="mt-3 grid gap-2.5">
            <input type="text" placeholder="Address line 1" value={addr.line1}
              onChange={(e) => setAddr({ ...addr, line1: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            <input type="text" placeholder="Address line 2" value={addr.line2}
              onChange={(e) => setAddr({ ...addr, line2: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            <div className="grid grid-cols-2 gap-2.5">
              <input type="text" placeholder="City" value={addr.city}
                onChange={(e) => setAddr({ ...addr, city: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              <input type="text" placeholder="State / region" value={addr.region}
                onChange={(e) => setAddr({ ...addr, region: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <input type="text" placeholder="Postcode" value={addr.postcode}
                onChange={(e) => setAddr({ ...addr, postcode: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              <input type="text" placeholder="Country" value={addr.country}
                onChange={(e) => setAddr({ ...addr, country: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
          </div>
        </div>

        {/* The active tick. Required here AND enforced server-side — the row
            records that it was made, not merely that the form was sent. */}
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-300 p-4">
          <input
            type="checkbox"
            required
            checked={agree}
            onChange={(e) => setAgree(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-black"
          />
          <span className="text-sm leading-relaxed text-black">
            I have read and agree to the terms on the previous page, including the
            confidentiality agreement, and I consent to Outlander printing the name and handle
            above in Issue 02.
          </span>
        </label>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <button
          type="submit"
          disabled={busy || !agree}
          className="inline-flex items-center gap-2 rounded-xl bg-black px-6 py-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
        >
          {busy && <Loader2 size={14} className="animate-spin" />}
          Confirm my credit for print
        </button>
      </form>
    </Shell>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
        {required && <span className="text-gray-400"> *</span>}
      </label>
      {children}
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    // Pure white, black type, and the magazine wordmark rather than the OS
    // lockup. This page is Outlander to 244 industry people, not OutlanderOS —
    // the wordmark is set live in AtGambit (the same face the printed logo is
    // set in) so it stays sharp at every size and needs no asset.
    <div className="min-h-screen bg-white px-5 py-14 text-black">
      <div className="mx-auto max-w-xl">
        <p
          className="mb-12 text-4xl tracking-tight text-black"
          style={{ fontFamily: '"AtGambit", Georgia, serif' }}
        >
          Outlander<span className="text-black">.</span>
        </p>
        <div>{children}</div>
        <p className="mt-14 text-center text-xs text-gray-400">
          Outlander Magazine Ltd · Company 13257633 · Private &amp; confidential
        </p>
      </div>
    </div>
  );
}
