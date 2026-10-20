"use client";

// New deal, as a focused flow: Client → Details → Value → Review.
//
// Same name and props as the modal it replaced, so the dashboard and pipeline
// open it unchanged. Creating a deal is still one POST /api/campaigns (job
// type, extensions, title, client); the brief date, owner, notes and value the
// flow also asks for are then saved with one PATCH, exactly as editing them on
// the deal page would.

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, Plus, Search } from "lucide-react";
import { TYPE_STYLES, type Deal } from "./deal-ui";
import { JOB_TYPE_CONFIG, type JobTypeValue } from "@/lib/deal-stages";
import { useUser } from "@/components/user-context";
import { Avatar, FlowFrame, FlowTitle, KV, Overlay, pill } from "@/components/os";

interface ClientOption {
  id: string;
  name: string;
}
interface UserOption {
  id: string;
  name: string;
}

const STEPS = ["Client", "Details", "Value", "Review"];

// The three job types, in the board's words.
const JOB_TYPES: { key: JobTypeValue; label: string; note: string }[] = [
  { key: "CREATIVE_BRIEF", label: "Commercial", note: "Bespoke content that needs a creative response. Commercial deals lock the production budget once the IO is signed." },
  { key: "SUPPLIED_ASSETS", label: "Supplied", note: "The client provides the content, so there's no creative response." },
  { key: "PRINT_AD", label: "Print", note: "Print advertising, straight to the media plan." },
];

const FIELD =
  "block h-[52px] w-full rounded-lg border border-field bg-card px-4 text-base text-foreground outline-none placeholder:text-muted-foreground focus:border-foreground focus:shadow-[0_0_0_3px_var(--focus)]";
const LABEL = "mb-2 block text-[15px] text-ink-2";

export default function NewDealModal({ onClose, onCreated }: { onClose: () => void; onCreated: (deal: Deal) => void }) {
  const { user } = useUser();
  const [step, setStep] = useState(0);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [query, setQuery] = useState("");

  const [clientId, setClientId] = useState("");
  const [newClientName, setNewClientName] = useState("");
  const [title, setTitle] = useState("");
  const [jobType, setJobType] = useState<JobTypeValue>("CREATIVE_BRIEF");
  const [extensions, setExtensions] = useState<string[]>([]);
  const [briefDue, setBriefDue] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [notes, setNotes] = useState("");
  const [value, setValue] = useState("");

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/clients")
      .then((r) => r.json())
      .then((d) => setClients(Array.isArray(d) ? d : []))
      .catch(() => setClients([]));
    fetch("/api/users")
      .then((r) => r.json())
      .then((d) => setUsers(Array.isArray(d) ? d : []))
      .catch(() => setUsers([]));
  }, []);

  const owner = ownerId || user?.id || "";
  const isNewClient = clientId === "__new__";
  const clientName = isNewClient ? newClientName.trim() : clients.find((c) => c.id === clientId)?.name ?? "";
  const cfg = JOB_TYPE_CONFIG[jobType];
  const type = JOB_TYPES.find((t) => t.key === jobType)!;

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? clients.filter((c) => c.name.toLowerCase().includes(q)) : clients;
    return list.slice(0, 8);
  }, [clients, query]);

  function next() {
    setError(null);
    if (step === 0 && !clientName) return setError(isNewClient ? "Give the new client a name." : "Pick a client, or add a new one.");
    if (step === 1 && !title.trim()) return setError("Give the deal a name.");
    if (step === 2 && value.trim() && Number.isNaN(Number(value.replace(/[£,\s]/g, "")))) return setError("Enter the value as a number, like 25000.");
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }

  async function create() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobType,
          extensions: extensions.filter((e) => cfg.extensions.includes(e as never)),
          title: title.trim(),
          clientId: isNewClient ? undefined : clientId,
          clientName: isNewClient ? newClientName.trim() : undefined,
        }),
      });
      const deal = await res.json();
      if (!res.ok) {
        setError(deal.error || "Couldn't create the deal. Try again.");
        return;
      }
      // The rest of what the flow asked for, saved the way the deal page saves it.
      const extra: Record<string, unknown> = {};
      if (owner) extra.assignedToId = owner;
      if (briefDue) extra.briefDueDate = briefDue;
      if (notes.trim()) extra.notes = notes.trim();
      const amount = value.replace(/[£,\s]/g, "");
      if (amount) extra.value = amount;
      if (Object.keys(extra).length) {
        await fetch(`/api/campaigns/${deal.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(extra),
        }).catch(() => {});
      }
      onCreated(deal);
    } catch {
      setError("Couldn't create the deal. Check your connection and try again.");
    } finally {
      setCreating(false);
    }
  }

  const back = step > 0 && (
    <button type="button" onClick={() => { setError(null); setStep((s) => s - 1); }} className="mb-4 inline-flex min-h-11 items-center gap-2 font-semibold hover:text-brand">
      <ChevronLeft className="size-5" strokeWidth={1.75} /> Back
    </button>
  );
  const errorBox = error && (
    <p role="alert" className="rounded-xl bg-bad-bg px-4 py-3 text-[15px] font-medium text-bad">
      {error}
    </p>
  );
  const ownerName = users.find((u) => u.id === owner)?.name ?? user?.name ?? "—";

  return (
    <Overlay label="New deal" onClose={onClose}>
      <FlowFrame steps={STEPS} current={step} onClose={onClose}>
        {back}

        {step === 0 && (
          <div className="flex flex-col gap-6">
            <FlowTitle sub="Pick an existing client or add a new one.">Who&rsquo;s the client?</FlowTitle>
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" strokeWidth={1.75} aria-hidden />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search clients"
                aria-label="Search clients"
                className={`${FIELD} pl-12`}
              />
            </div>
            <div role="radiogroup" aria-label="Client" className="flex flex-col gap-1">
              {shown.map((c) => {
                const on = clientId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setClientId(c.id)}
                    className={`flex min-h-14 items-center gap-3.5 rounded-[14px] px-3 py-2 text-left ${on ? "bg-accent" : "hover:bg-surface"}`}
                  >
                    <Avatar name={c.name} tone={on ? "card" : "surface"} />
                    <span className="flex-1 font-semibold">{c.name}</span>
                  </button>
                );
              })}
              {shown.length === 0 && query && <p className="px-3 py-2 text-[15px] text-muted-foreground">No client called &ldquo;{query}&rdquo; yet.</p>}
              <button
                type="button"
                role="radio"
                aria-checked={isNewClient}
                onClick={() => {
                  setClientId("__new__");
                  if (!newClientName && query) setNewClientName(query);
                }}
                className={`flex min-h-14 items-center gap-3.5 rounded-[14px] px-3 py-2 text-left ${isNewClient ? "bg-accent" : "hover:bg-surface"}`}
              >
                <span className="flex size-10 items-center justify-center rounded-full bg-surface">
                  <Plus className="size-5" strokeWidth={1.75} aria-hidden />
                </span>
                <span className="flex-1 font-semibold">New client</span>
              </button>
              {isNewClient && (
                <div className="mt-2">
                  <label htmlFor="new-client" className={LABEL}>
                    Client name
                  </label>
                  <input id="new-client" autoFocus value={newClientName} onChange={(e) => setNewClientName(e.target.value)} className={FIELD} />
                </div>
              )}
            </div>
            {errorBox}
            <button type="button" onClick={next} className={`${pill("primary")} w-full`}>
              Continue
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-6">
            <FlowTitle>Tell us about the deal</FlowTitle>
            <div className="flex items-center gap-3.5 rounded-2xl bg-surface px-4 py-3.5">
              <Avatar name={clientName} size={44} tone="card" />
              <span className="flex-1">
                <span className="block font-semibold">{clientName}</span>
                <span className="block text-sm text-muted-foreground">{isNewClient ? "New client" : "Existing client"}</span>
              </span>
              <button type="button" onClick={() => setStep(0)} className="text-sm font-semibold underline decoration-[1.5px] underline-offset-4 hover:text-brand">
                Change
              </button>
            </div>
            <div>
              <label htmlFor="deal-name" className={LABEL}>
                Deal name
              </label>
              <input id="deal-name" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. SS26 launch partnership" className={FIELD} />
            </div>
            <div>
              <span className={LABEL} id="deal-type">
                Deal type
              </span>
              <div role="radiogroup" aria-labelledby="deal-type" className="flex gap-1 rounded-full bg-surface p-1">
                {JOB_TYPES.map((t) => {
                  const on = jobType === t.key;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => {
                        setJobType(t.key);
                        setExtensions([]);
                      }}
                      className={`min-h-11 flex-1 rounded-full text-[15px] ${on ? "bg-card font-semibold text-foreground shadow-[0_1px_2px_rgba(11,18,32,0.12)]" : "font-medium text-ink-2"}`}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{type.note}</p>
            </div>
            {cfg.extensions.length > 0 && (
              <fieldset>
                <legend className={LABEL}>
                  Add-ons <span className="text-muted-foreground">(optional)</span>
                </legend>
                <div className="flex flex-wrap gap-2">
                  {cfg.extensions.map((ext) => {
                    const on = extensions.includes(ext);
                    return (
                      <label key={ext} className={`inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full px-4 text-sm font-medium ${on ? "bg-foreground text-background" : "bg-surface text-ink-2"}`}>
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={on}
                          onChange={() => setExtensions((prev) => (prev.includes(ext) ? prev.filter((x) => x !== ext) : [...prev, ext]))}
                        />
                        {TYPE_STYLES[ext]?.label ?? ext}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            )}
            <div className="flex flex-wrap gap-3">
              <div className="min-w-[200px] flex-1">
                <label htmlFor="brief-due" className={LABEL}>
                  Brief due
                </label>
                <input id="brief-due" type="date" value={briefDue} onChange={(e) => setBriefDue(e.target.value)} className={FIELD} />
              </div>
              <div className="min-w-[200px] flex-1">
                <label htmlFor="owner" className={LABEL}>
                  Owner
                </label>
                <select id="owner" value={owner} onChange={(e) => setOwnerId(e.target.value)} className={FIELD}>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="notes" className={LABEL}>
                Notes for the team <span className="text-muted-foreground">(optional)</span>
              </label>
              <textarea id="notes" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} className={`${FIELD} h-auto py-3.5`} />
            </div>
            {errorBox}
            <button type="button" onClick={next} className={`${pill("primary")} w-full`}>
              Continue
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-6">
            <FlowTitle sub="The headline value. The budget split is set on the deal itself.">What&rsquo;s it worth?</FlowTitle>
            <div>
              <label htmlFor="value" className={LABEL}>
                Deal value <span className="text-muted-foreground">(optional, ex VAT)</span>
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xl font-semibold text-muted-foreground">£</span>
                <input
                  id="value"
                  inputMode="decimal"
                  autoFocus
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="0"
                  className={`${FIELD} h-16 pl-10 text-[26px] font-semibold tabular-nums`}
                />
              </div>
            </div>
            {errorBox}
            <button type="button" onClick={next} className={`${pill("primary")} w-full`}>
              Continue
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-6">
            <FlowTitle sub="Check it over, then create the deal. Everything can be changed later.">Review the deal</FlowTitle>
            <div className="rounded-2xl bg-surface px-5 py-2 [&>*+*]:border-t [&>*+*]:border-line">
              <KV k="Client" v={`${clientName}${isNewClient ? " (new)" : ""}`} />
              <KV k="Deal" v={title.trim()} />
              <KV k="Type" v={[type.label, ...extensions.map((e) => TYPE_STYLES[e]?.label ?? e)].join(" · ")} />
              <KV k="Owner" v={ownerName} />
              <KV k="Brief due" v={briefDue ? new Date(briefDue).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" }) : "—"} />
              <KV k="Value" v={value ? `£${Number(value.replace(/[£,\s]/g, "")).toLocaleString("en-GB")}` : "—"} />
            </div>
            {errorBox}
            <button type="button" onClick={create} disabled={creating} className={`${pill("primary")} w-full`}>
              {creating ? "Creating…" : "Create deal"}
            </button>
          </div>
        )}
      </FlowFrame>
    </Overlay>
  );
}
