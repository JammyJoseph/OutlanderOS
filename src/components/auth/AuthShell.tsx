import type { ReactNode, Ref } from 'react'

/**
 * The frame for every signed-out screen: sign in, reset, choose a password.
 *
 * Two halves. The hero block carries the brand at full strength, which is the
 * one place the hero colour is used that big; the other half is a plain paper
 * column holding a single form and nothing else. On a phone the hero becomes a
 * short band across the top, so the form is never pushed below the fold.
 *
 * Deliberately has no state and no client code, so it renders on the server
 * and the brand appears before any JavaScript has loaded.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    // grid-rows-[auto_1fr]: without it a phone's spare height is shared between
    // the two rows and the blue band grows with the screen.
    <div className="grid min-h-dvh grid-rows-[auto_1fr] bg-background text-foreground lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:grid-rows-1">
      <aside className="flex flex-col justify-between gap-10 bg-hero px-6 py-7 text-on-hero sm:px-10 lg:px-14 lg:py-12">
        {/* The on-colour logo: a flat white "OS" pill with the letters cut out, so
            they show the hero colour behind. The dark-background logo's grey
            metallic pill turned to mud on a coloured block. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/OutlanderOS_Logo_OnColour.svg" alt="Outlander OS" className="h-6 w-auto self-start lg:h-7" />
        <div className="hidden max-w-[17ch] lg:block">
          <p className="font-heading text-[clamp(2.75rem,4.6vw,4.5rem)] font-normal italic leading-[1.02] tracking-[-0.015em]">
            Jobs, money and people, in one place.
          </p>
          <p className="mt-6 font-stat text-sm font-bold uppercase tracking-[0.14em] text-on-hero/80">
            Outlander Magazine
          </p>
        </div>
      </aside>

      <main className="flex items-start justify-center px-6 py-10 sm:px-10 lg:items-center lg:py-16">
        <div className="w-full max-w-[400px]">{children}</div>
      </main>
    </div>
  )
}

/** A heading that receives focus when its view appears, so a screen reader announces the change. */
export function AuthHeading({
  children,
  sub,
  focusRef,
}: {
  children: ReactNode
  sub?: ReactNode
  focusRef?: Ref<HTMLHeadingElement>
}) {
  return (
    <div className="mb-8">
      <h1
        ref={focusRef}
        tabIndex={-1}
        className="font-heading text-[2.5rem] font-semibold leading-[1.05] tracking-[-0.01em] outline-none"
      >
        {children}
      </h1>
      {sub && <p className="mt-3 text-base leading-relaxed text-muted-foreground">{sub}</p>}
    </div>
  )
}
