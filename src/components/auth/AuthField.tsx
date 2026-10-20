'use client'

// Form parts for the signed-out screens, written once so the accessibility is
// right everywhere rather than re-done (or not done) on each page.
//
// What the old screens got wrong, and what each part here does instead:
//
//   * Labels were not connected to their inputs. A screen reader announced
//     "edit text" with no name, and clicking a label did nothing. Every field
//     here has a real <label htmlFor> and a stable id.
//   * Errors appeared as red text nobody was told about. The alert here is a
//     live region, so it is read out the moment it appears, and the field it
//     concerns is marked aria-invalid and points at it.
//   * Password fields had no way to check what you typed, and nothing noticed
//     Caps Lock — the commonest reason a correct password is rejected.
//
// Inputs are 16px so iOS does not zoom the page when one is focused, and every
// control is at least 44px tall, comfortably above the 24px WCAG 2.2 minimum.

import { useId, useState, type InputHTMLAttributes, type ReactNode } from 'react'

const FIELD =
  'block h-12 w-full rounded-xl border-2 border-border bg-card px-4 text-base text-foreground ' +
  'placeholder:text-muted-foreground transition-colors ' +
  'focus:border-hero focus:outline-none focus-visible:ring-4 focus-visible:ring-hero/20 ' +
  'aria-[invalid=true]:border-destructive'

interface AuthFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'className'> {
  label: string
  /** A sentence under the field, always visible. */
  help?: ReactNode
  /** Shown under the field and announced. Also marks the field invalid. */
  error?: string
  id?: string
}

export function AuthField({ label, help, error, id, type = 'text', ...input }: AuthFieldProps) {
  const auto = useId()
  const fieldId = id ?? `f-${auto}`
  const helpId = help ? `${fieldId}-help` : undefined
  const errorId = error ? `${fieldId}-error` : undefined
  const isPassword = type === 'password'
  const [shown, setShown] = useState(false)
  const [capsOn, setCapsOn] = useState(false)

  const describedBy = [helpId, errorId].filter(Boolean).join(' ') || undefined

  const trackCaps = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (typeof e.getModifierState === 'function') setCapsOn(e.getModifierState('CapsLock'))
  }

  return (
    <div className="grid gap-2">
      <label htmlFor={fieldId} className="text-sm font-semibold">
        {label}
      </label>

      <div className="relative">
        <input
          {...input}
          id={fieldId}
          type={isPassword && shown ? 'text' : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={FIELD + (isPassword ? ' pr-20' : '')}
          onKeyDown={(e) => {
            if (isPassword) trackCaps(e)
            input.onKeyDown?.(e)
          }}
          onKeyUp={(e) => {
            if (isPassword) trackCaps(e)
            input.onKeyUp?.(e)
          }}
          onBlur={(e) => {
            setCapsOn(false)
            input.onBlur?.(e)
          }}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShown((v) => !v)}
            aria-pressed={shown}
            aria-controls={fieldId}
            className="absolute inset-y-1.5 right-1.5 rounded-lg px-3 text-sm font-semibold text-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
          >
            {shown ? 'Hide' : 'Show'}
            <span className="sr-only"> password</span>
          </button>
        )}
      </div>

      {isPassword && capsOn && (
        <p className="text-sm font-semibold text-foreground" aria-live="polite">
          Caps Lock is on.
        </p>
      )}
      {help && (
        <p id={helpId} className="text-sm text-muted-foreground">
          {help}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm font-semibold text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

/** Read out the moment it appears. One per form, above the fields. */
export function AuthAlert({ children }: { children: ReactNode }) {
  if (!children) return null
  return (
    <div
      role="alert"
      className="mb-6 rounded-xl border-2 border-destructive/30 bg-destructive/8 px-4 py-3 text-sm font-semibold text-destructive"
    >
      {children}
    </div>
  )
}

/** Good news, announced politely rather than interrupting. */
export function AuthNotice({ children }: { children: ReactNode }) {
  if (!children) return null
  return (
    <div role="status" className="mb-6 rounded-xl bg-hero-tint px-4 py-3 text-sm font-semibold text-hero-ink">
      {children}
    </div>
  )
}

/**
 * The one hero action on each screen. Stays focusable while working, and says
 * what it is doing rather than going grey and silent.
 */
export function AuthButton({
  children,
  busy,
  busyLabel,
}: {
  children: ReactNode
  busy?: boolean
  busyLabel: string
}) {
  return (
    <button
      type="submit"
      aria-disabled={busy || undefined}
      className="mt-2 inline-flex h-12 w-full items-center justify-center rounded-full bg-hero px-6 text-base font-semibold text-on-hero transition-[filter] hover:brightness-110 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-foreground aria-disabled:cursor-wait aria-disabled:opacity-70"
    >
      <span aria-live="polite">{busy ? busyLabel : children}</span>
    </button>
  )
}

/** A text-style action: back links, "forgot password", secondary choices. */
export function AuthLinkButton({
  children,
  onClick,
}: {
  children: ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-sm font-semibold text-foreground underline underline-offset-4 hover:text-hero-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
    >
      {children}
    </button>
  )
}

/**
 * The password rules, checked as you type. Shown before anyone fails them,
 * because a rule you only discover by breaking it is a rule that wastes a go.
 */
export function PasswordRules({
  password,
  confirm,
  min,
}: {
  password: string
  confirm?: string
  min: number
}) {
  const rules = [
    { ok: password.length >= min, text: `At least ${min} characters` },
    ...(confirm !== undefined
      ? [{ ok: password.length > 0 && password === confirm, text: 'Both passwords match' }]
      : []),
  ]
  return (
    <ul className="grid gap-1.5 text-sm" aria-label="Password requirements">
      {rules.map((r) => (
        <li key={r.text} className={`flex items-center gap-2 ${r.ok ? 'text-foreground' : 'text-muted-foreground'}`}>
          <span
            aria-hidden="true"
            className={`grid h-5 w-5 place-items-center rounded-full text-[11px] font-bold ${
              r.ok ? 'bg-hero text-on-hero' : 'border-2 border-border'
            }`}
          >
            {r.ok ? '✓' : ''}
          </span>
          <span>
            {r.text}
            <span className="sr-only">{r.ok ? ' — done' : ' — not yet'}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}
