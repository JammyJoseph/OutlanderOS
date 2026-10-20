// Page building blocks from the redesign's Foundations board. Every redesigned
// screen is assembled from these, and they are the template for the screens
// the design file doesn't cover: one figure or title, a row of pill actions
// under it, grey cards instead of borders, plain rows, tags only for meaning.

"use client";

import Link from "next/link";
import { useEffect, useRef, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { TAG_TONES, type TagTone } from "@/lib/design";

/* ── Layout ─────────────────────────────────────────────────────────────── */

/** Content column: max 1080px, 48px sides on desktop, 40px between sections. */
export function Page({ children, className, wide }: { children: ReactNode; className?: string; wide?: boolean }) {
  return (
    <div className={cn("px-4 pb-20 pt-6 sm:px-8 lg:px-12", className)}>
      <div className={cn("flex flex-col gap-10", wide ? "max-w-none" : "max-w-[1080px]")}>{children}</div>
    </div>
  );
}

/**
 * The top of a screen: a muted line, then either a page title or a big figure,
 * then one row of pill actions (one primary at most).
 */
export function PageHead({
  eyebrow,
  title,
  figure,
  figureNote,
  actions,
  aside,
}: {
  eyebrow?: ReactNode;
  title?: ReactNode;
  figure?: ReactNode;
  figureNote?: ReactNode;
  actions?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && <p className="mb-1.5 text-base text-muted-foreground">{eyebrow}</p>}
          {title && <h1 className="text-[28px] font-semibold leading-[1.1] tracking-[-0.015em] sm:text-4xl">{title}</h1>}
          {figure && (
            <div className="flex flex-wrap items-baseline gap-x-3">
              <span className="text-[36px] font-semibold leading-none tracking-[-0.02em] tabular-nums sm:text-[44px]">{figure}</span>
              {figureNote && <span className="text-base text-muted-foreground">{figureNote}</span>}
            </div>
          )}
        </div>
        {aside}
      </div>
      {actions && <div className="flex flex-wrap gap-2.5">{actions}</div>}
    </section>
  );
}

/** Metric cards in a row that wraps: 210px minimum each. */
export function StatGrid({ children, className, "aria-label": label }: { children: ReactNode; className?: string; "aria-label"?: string }) {
  return (
    <section aria-label={label} className={cn("grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(210px,1fr))]", className)}>
      {children}
    </section>
  );
}

/** Label, big number, one line of context. Optionally a link. */
export function Stat({
  label,
  value,
  note,
  noteTone,
  href,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  note?: ReactNode;
  noteTone?: "bad" | "warn" | "ok";
  href?: string;
  className?: string;
}) {
  const body = (
    <>
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-2.5 truncate text-2xl font-semibold leading-none tracking-[-0.01em] tabular-nums sm:text-[30px]">{value}</div>
      {note && (
        <div
          className={cn(
            "mt-2 text-sm",
            noteTone === "bad" ? "text-bad" : noteTone === "warn" ? "text-warn" : noteTone === "ok" ? "text-ok" : "text-muted-foreground",
          )}
        >
          {note}
        </div>
      )}
    </>
  );
  const cls = cn("block min-w-0 rounded-2xl bg-surface p-5 sm:p-6", className);
  return href ? (
    <Link href={href} className={cn(cls, "transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** A grey card with an optional heading row. */
export function Panel({
  title,
  action,
  children,
  className,
  bodyClassName,
  as: As = "section",
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  as?: "section" | "div";
}) {
  return (
    <As className={cn("rounded-2xl bg-surface px-6 py-6 sm:px-7", className)}>
      {(title || action) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-4">
          {title && <h2 className="text-xl font-semibold">{title}</h2>}
          {action}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </As>
  );
}

/** A section heading outside a card: "Active deals" with an action on the right. */
export function SectionHead({ title, action, className }: { title: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-4", className)}>
      <h2 className="text-xl font-semibold">{title}</h2>
      {action}
    </div>
  );
}

/** Two columns that stack: a wide main and a 300px side. */
export function Split({ main, side }: { main: ReactNode; side: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start gap-6">
      <div className="flex min-w-0 flex-[999_1_480px] flex-col gap-6">{main}</div>
      <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-6">{side}</div>
    </div>
  );
}

/* ── Content ────────────────────────────────────────────────────────────── */

/** Rows inside a card, divided by a 1px line. */
export function Rows({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("[&>*+*]:border-t [&>*+*]:border-line", className)}>{children}</div>;
}

export function Row({
  lead,
  title,
  meta,
  trail,
  href,
  onClick,
  className,
}: {
  lead?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  trail?: ReactNode;
  href?: string;
  onClick?: () => void;
  className?: string;
}) {
  const inner = (
    <>
      {lead}
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold">{title}</div>
        {meta && <div className="mt-0.5 flex min-w-0 items-center gap-2 truncate text-sm text-muted-foreground">{meta}</div>}
      </div>
      {trail}
    </>
  );
  const cls = cn("flex items-center gap-4 py-3.5", className);
  if (href)
    return (
      <Link href={href} className={cn(cls, "rounded-sm hover:[&_.truncate:first-child]:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground")}>
        {inner}
      </Link>
    );
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={cn(cls, "w-full text-left")}>
        {inner}
      </button>
    );
  return <div className={cls}>{inner}</div>;
}

/** A status tag. Colour only for meaning; "plain" is a white chip on a grey card. */
export function Tag({ tone = "neutral", children, className }: { tone?: TagTone | "plain"; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-semibold",
        tone === "plain" ? "bg-background text-ink-2" : TAG_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** A workspace marker: an 8px dot. */
export function Dot({ color, className }: { color: string; className?: string }) {
  return <span aria-hidden className={cn("inline-block size-2 shrink-0 rounded-full", className)} style={{ background: color }} />;
}

/** Initials in a circle. */
export function Avatar({ name, size = 40, tone = "surface", className }: { name?: string | null; size?: 28 | 32 | 40 | 44; tone?: "surface" | "accent" | "card"; className?: string }) {
  const initials = (name ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold",
        size <= 32 ? "text-[11px]" : "text-[13px]",
        tone === "accent" ? "bg-accent" : tone === "card" ? "bg-background" : "bg-surface",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {initials || "·"}
    </span>
  );
}

/** Filter chips. The selected one is ink. */
export function Chips<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={cn("flex flex-wrap gap-1", className)}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex min-h-9 items-center rounded-full px-3.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground",
              on ? "bg-foreground text-background" : "text-ink-2 hover:bg-surface-2",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** "See all" style link: ink, semibold, underlined. */
export function TextLink({ className, ...props }: ComponentProps<typeof Link>) {
  return (
    <Link
      {...props}
      className={cn(
        "text-sm font-semibold text-foreground underline decoration-[1.5px] underline-offset-4 hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground",
        className,
      )}
    />
  );
}

/** A label/value line inside a details card. */
export function KV({ k, v }: { k: ReactNode; v: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-6 py-3 text-[15px]">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right font-medium">{v}</span>
    </div>
  );
}

/** A plain progress bar: ink on line, red when over. */
export function Meter({ value, max, className }: { value: number; max: number; className?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const over = max > 0 && value > max;
  return (
    <div className={cn("h-1.5 overflow-hidden rounded-full bg-line", className)} role="presentation">
      <div className={cn("h-full rounded-full", over ? "bg-bad" : "bg-foreground")} style={{ width: `${over ? 100 : pct}%` }} />
    </div>
  );
}

/** Empty state inside a card. */
export function Empty({ title, children, action }: { title: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <p className="font-semibold">{title}</p>
      {children && <p className="max-w-sm text-sm text-muted-foreground">{children}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/* ── Tables ─────────────────────────────────────────────────────────────── */

/** A plain table: muted 13px headers, 1px line between rows, scrolls sideways when narrow. */
export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("-mx-1 overflow-x-auto px-1", className)}>
      <table className="w-full border-collapse text-[15px] [&_td]:border-t [&_td]:border-line [&_td]:px-3 [&_td]:py-3.5 [&_th]:px-3 [&_th]:pb-2.5 [&_th]:text-left [&_th]:text-[13px] [&_th]:font-normal [&_th]:text-muted-foreground">
        {children}
      </table>
    </div>
  );
}

/* ── Focused flows ──────────────────────────────────────────────────────── */

/**
 * Anything that creates or sends something: logo, step bar and close on top,
 * one 480px centred column.
 */
export function FlowFrame({
  steps,
  current,
  onClose,
  closeHref,
  children,
}: {
  steps?: string[];
  current?: number;
  onClose?: () => void;
  closeHref?: string;
  children: ReactNode;
}) {
  const close = (
    <span className="flex size-11 items-center justify-center rounded-full hover:bg-surface">
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" aria-hidden>
        <path d="M6 6l12 12M18 6 6 18" />
      </svg>
    </span>
  );
  return (
    <div className="min-h-dvh bg-background">
      <header className="flex items-center gap-6 border-b border-line px-4 py-4 sm:px-10">
        <div className="w-36 shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/OutlanderOS_Logo_Ink.svg" alt="OutlanderOS" className="h-5 w-auto dark:hidden" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/OutlanderOS_Logo_OnColour.svg" alt="OutlanderOS" className="hidden h-5 w-auto dark:block" />
        </div>
        <div className="flex flex-1 justify-center">
          {steps && steps.length > 1 && <StepBar steps={steps} current={current ?? 0} />}
        </div>
        <div className="flex w-36 shrink-0 justify-end">
          {closeHref ? (
            <Link href={closeHref} aria-label="Close">
              {close}
            </Link>
          ) : onClose ? (
            <button type="button" onClick={onClose} aria-label="Close">
              {close}
            </button>
          ) : null}
        </div>
      </header>
      <main className="mx-auto w-full max-w-[480px] px-4 pb-20 pt-10 sm:pt-14">{children}</main>
    </div>
  );
}

export function StepBar({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="hidden w-full max-w-[420px] grid-flow-col gap-2 sm:grid" aria-label={`Step ${current + 1} of ${steps.length}`}>
      {steps.map((s, i) => (
        <li key={s} aria-current={i === current ? "step" : undefined} className="flex flex-col gap-1.5">
          <span className={cn("text-xs", i === current ? "font-semibold text-foreground" : "text-muted-foreground")}>{s}</span>
          <span className={cn("h-[3px] rounded-full", i <= current ? "bg-foreground" : "bg-line")} />
        </li>
      ))}
    </ol>
  );
}

/** Flow heading: 34px, centred, with an optional line under it. */
export function FlowTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-8 text-center">
      <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.01em] sm:text-[34px]">{children}</h1>
      {sub && <p className="mt-2 text-[15px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

/**
 * Something finished: full navy, light blue tick, ExtraCond caps headline.
 * Only for when something is done.
 */
export function SuccessScreen({ title, children, actions }: { title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-navy text-on-navy">
      <div className="px-6 py-6 sm:px-10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/OutlanderOS_Logo_OnColour.svg" alt="OutlanderOS" className="h-5 w-auto" />
      </div>
      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-24 text-center">
        <span className="mb-8 flex size-24 items-center justify-center rounded-full bg-primary text-navy">
          <svg viewBox="0 0 24 24" className="size-9" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m5 12.5 4.5 4.5L19 7.5" />
          </svg>
        </span>
        <h1 tabIndex={-1} className="font-stat text-[56px] font-semibold uppercase leading-[0.92] text-primary outline-none sm:text-[80px]">
          {title}
        </h1>
        {children && <div className="mt-6 max-w-md text-[15px] leading-relaxed text-[#C9D6E6]">{children}</div>}
        {actions && <div className="mt-8 flex flex-wrap justify-center gap-3">{actions}</div>}
      </main>
    </div>
  );
}

/** Button-styled link classes, matching ui/button variants, for <Link>s. */
export function pill(variant: "primary" | "secondary" | "outline" | "ghost" | "danger" | "onNavy" = "secondary", size: "md" | "sm" = "md") {
  return cn(
    "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold leading-none transition-[filter,background-color] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:size-[18px] [&_svg]:shrink-0",
    size === "md" ? "min-h-11 px-5 text-[15px]" : "min-h-9 px-4 text-sm",
    variant === "primary" && "bg-primary text-primary-foreground hover:brightness-[0.97]",
    variant === "secondary" && "bg-secondary text-secondary-foreground hover:brightness-[0.97]",
    variant === "outline" && "bg-background text-foreground shadow-[inset_0_0_0_1px_var(--field)] hover:bg-surface",
    variant === "ghost" && "text-ink-2 hover:bg-surface hover:text-foreground",
    variant === "danger" && "bg-background text-bad shadow-[inset_0_0_0_1px_#E8B9B4] hover:bg-bad-bg",
    variant === "onNavy" && "bg-transparent text-on-navy shadow-[inset_0_0_0_1px_rgba(255,255,255,0.32)] hover:bg-white/10",
  );
}

/**
 * A flow or success screen opened from inside the app: covers the sidebar,
 * takes focus, and closes on Escape (unless the flow says otherwise).
 */
export function Overlay({ children, onClose, label }: { children: ReactNode; onClose?: () => void; label: string }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const h = box.current?.querySelector<HTMLElement>("h1");
    if (h) {
      if (!h.hasAttribute("tabindex")) h.setAttribute("tabindex", "-1");
      h.focus();
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && onClose) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [onClose]);
  return (
    <div ref={box} role="dialog" aria-modal="true" aria-label={label} className="fixed inset-0 z-[70] overflow-y-auto bg-background [&_h1]:outline-none">
      {children}
    </div>
  );
}
