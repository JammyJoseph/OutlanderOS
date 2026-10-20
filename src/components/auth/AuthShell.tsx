import type { ReactNode, Ref } from 'react'

/**
 * The frame for every signed-out screen: sign in, reset, choose a password.
 *
 * From the redesign: white page, a header with the logo (and either a quiet
 * line or a close button on the right), one 480px centred column, and a small
 * footer. No state and no client code, so it renders on the server and the
 * page appears before any JavaScript has loaded.
 */
export function AuthShell({
  children,
  right,
  footer = true,
}: {
  children: ReactNode
  /** Header, right-hand side. Defaults to the "internal" line. */
  right?: ReactNode
  footer?: boolean
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="flex min-h-[78px] items-center justify-between gap-4 border-b border-line px-5 sm:px-12">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/OutlanderOS_Logo_Ink.svg" alt="OutlanderOS" className="h-[22px] w-auto dark:hidden" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/OutlanderOS_Logo_OnColour.svg" alt="OutlanderOS" className="hidden h-[22px] w-auto dark:block" />
        {right ?? <span className="hidden text-sm text-muted-foreground sm:inline">Outlander Magazine Ltd · internal</span>}
      </header>

      <main className="flex flex-1 justify-center px-5 pb-12 pt-12 sm:pt-[72px]">
        <div className="w-full max-w-[480px]">{children}</div>
      </main>

      {footer && (
        <footer className="flex flex-wrap justify-center gap-x-6 gap-y-1 px-5 pb-8 pt-6 text-[13px] text-muted-foreground">
          <span>Private &amp; Confidential © Outlander Magazine Ltd</span>
          <span>os.outlanderdirectory.com</span>
        </footer>
      )}
    </div>
  )
}

/** A centred flow title that receives focus when its view appears, so a screen reader announces the change. */
export function AuthHeading({
  children,
  sub,
  focusRef,
  condensed,
}: {
  children: ReactNode
  sub?: ReactNode
  focusRef?: Ref<HTMLHeadingElement>
  /** ExtraCond caps — for "Check your email" style confirmations. */
  condensed?: boolean
}) {
  return (
    <div className="mb-6 flex flex-col gap-2.5 text-center">
      <h1
        ref={focusRef}
        tabIndex={-1}
        className={
          condensed
            ? 'font-stat text-[52px] font-semibold uppercase leading-[0.92] outline-none sm:text-[64px]'
            : 'text-[28px] font-semibold leading-[1.15] tracking-[-0.01em] outline-none sm:text-[34px]'
        }
      >
        {children}
      </h1>
      {sub && <p className="text-base text-muted-foreground">{sub}</p>}
    </div>
  )
}

/** The round close button in the header of a focused screen. */
export function AuthClose({ onClick, href, label = 'Close' }: { onClick?: () => void; href?: string; label?: string }) {
  const icon = (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" aria-hidden>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  )
  const cls =
    'flex size-11 items-center justify-center rounded-full text-foreground hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground'
  return href ? (
    <a href={href} aria-label={label} className={cls}>
      {icon}
    </a>
  ) : (
    <button type="button" onClick={onClick} aria-label={label} className={cls}>
      {icon}
    </button>
  )
}
