'use client'

// Form parts for the signed-out screens, written once so the accessibility is
// right everywhere rather than re-done (or not done) on each page.
//
//   * Every field has a real <label htmlFor> and a stable id.
//   * Errors are a live region, read out the moment they appear, and the field
//     they concern is marked aria-invalid and points at them.
//   * Password fields can be shown, and notice Caps Lock — the commonest reason
//     a correct password is rejected.
//
// Sizes follow the redesign: 52px fields with a 12px radius, 44px pill
// buttons. Inputs are 16px so iOS does not zoom the page on focus.

import { useId, useState, type InputHTMLAttributes, type ReactNode } from 'react'

const FIELD =
  'block h-[52px] w-full rounded-lg border border-field bg-card px-4 text-base text-foreground ' +
  'placeholder:text-muted-foreground transition-[border-color,box-shadow] ' +
  'focus:border-foreground focus:outline-none focus:shadow-[0_0_0_3px_var(--focus)] ' +
  'aria-[invalid=true]:border-destructive'

interface AuthFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'className'> {
  label: string
  /** A sentence under the field, always visible. */
  help?: ReactNode
  /** Shown under the field and announced. Also marks the field invalid. */
  error?: string
  /**
   * Shown at the right of the label row (e.g. "Forgot password?"). It comes
   * after the input in the page's order, so Tab still goes from one field
   * straight to the next.
   */
  labelAside?: ReactNode
  id?: string
}

export function AuthField({ label, help, error, labelAside, id, type = 'text', ...input }: AuthFieldProps) {
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
    <div className="grid grid-cols-[1fr_auto] items-baseline gap-x-3">
      <label htmlFor={fieldId} className="col-start-1 row-start-1 mb-2 text-[15px] text-ink-2">
        {label}
      </label>

      <div className="relative col-span-2 row-start-2">
        <input
          {...input}
          id={fieldId}
          type={isPassword && shown ? 'text' : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={FIELD + (isPassword ? ' pr-[88px]' : '')}
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
            className="absolute right-2 top-2 h-9 rounded-full bg-surface px-3.5 text-sm font-semibold text-foreground hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
          >
            {shown ? 'Hide' : 'Show'}
            <span className="sr-only"> password</span>
          </button>
        )}
      </div>

      {labelAside && <div className="col-start-2 row-start-1 mb-2 justify-self-end">{labelAside}</div>}

      <div className="col-span-2 row-start-3 grid gap-1.5 empty:hidden">
        {isPassword && capsOn && (
          <p className="mt-2 text-sm font-semibold text-warn" aria-live="polite">
            Caps Lock is on.
          </p>
        )}
        {help && (
          <p id={helpId} className="mt-2 text-sm text-muted-foreground">
            {help}
          </p>
        )}
        {error && (
          <p id={errorId} className="mt-2 text-sm font-semibold text-destructive">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}

const ICON = 'mt-0.5 size-5 shrink-0'

/** Read out the moment it appears. One per form, above the fields. */
export function AuthAlert({ children }: { children: ReactNode }) {
  if (!children) return null
  return (
    <div role="alert" className="mb-6 flex items-start gap-3.5 rounded-xl bg-bad-bg px-5 py-4 text-[15px] font-medium text-bad">
      <svg viewBox="0 0 24 24" className={ICON} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" aria-hidden>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7.5v5.5M12 16.5h.01" />
      </svg>
      <div>{children}</div>
    </div>
  )
}

/** Good news, announced politely rather than interrupting. */
export function AuthNotice({ children }: { children: ReactNode }) {
  if (!children) return null
  return (
    <div role="status" className="mb-6 flex items-start gap-3.5 rounded-xl bg-surface px-5 py-4 text-left text-[15px] text-ink-2">
      <svg viewBox="0 0 24 24" className={`${ICON} text-brand`} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" aria-hidden>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5.5M12 7.5h.01" />
      </svg>
      <div>{children}</div>
    </div>
  )
}

/**
 * The one primary action on each screen. Stays focusable while working, and
 * says what it is doing rather than going grey and silent.
 */
export function AuthButton({
  children,
  busy,
  busyLabel,
  disabled,
}: {
  children: ReactNode
  busy?: boolean
  busyLabel: string
  disabled?: boolean
}) {
  return (
    <button
      type="submit"
      aria-disabled={busy || disabled || undefined}
      className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-primary px-6 text-[15px] font-semibold text-primary-foreground transition-[filter,opacity] hover:brightness-[0.97] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-foreground aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
    >
      <span aria-live="polite">{busy ? busyLabel : children}</span>
    </button>
  )
}

/** A text action: back links, "Forgot password?", "Send again". */
export function AuthLinkButton({
  children,
  onClick,
  className = '',
}: {
  children: ReactNode
  onClick: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-sm font-semibold text-foreground underline decoration-[1.5px] underline-offset-4 hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground ${className}`}
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
  const started = password.length > 0
  return (
    <ul
      className={`grid gap-2 rounded-lg px-4 py-3.5 text-sm ${started && rules.every((r) => r.ok) ? 'bg-ok-bg' : 'bg-surface'}`}
      aria-label="Password requirements"
    >
      {rules.map((r) => (
        <li key={r.text} className={`flex items-center gap-2.5 ${r.ok ? 'text-ok' : 'text-ink-2'}`}>
          {r.ok ? (
            <svg viewBox="0 0 24 24" className="size-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="12" cy="12" r="9" />
              <path d="m8.5 12.5 2.5 2.5 4.5-5" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="size-[18px] shrink-0 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden>
              <circle cx="12" cy="12" r="9" />
            </svg>
          )}
          <span>
            {r.text}
            <span className="sr-only">{r.ok ? ' — done' : ' — not yet'}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}
