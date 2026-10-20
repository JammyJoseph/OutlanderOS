import type { ReactNode } from 'react'

// A labelled form field wrapper. `wide` spans both columns in a 2-col grid.
// Shared by the profile, holiday and settings forms.
//
// The input sits inside the <label>, so the label names it for screen readers
// and clicking the label focuses it — the old version rendered the two side by
// side with nothing connecting them.
export function Field({
  label,
  wide,
  children,
}: {
  label: string
  wide?: boolean
  children: ReactNode
}) {
  return (
    <label className={`block ${wide ? 'sm:col-span-2' : ''}`}>
      <span className="mb-2 block text-[15px] text-ink-2">{label}</span>
      {children}
    </label>
  )
}
