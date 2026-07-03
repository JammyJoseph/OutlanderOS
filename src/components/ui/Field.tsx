import type { ReactNode } from 'react'

// A labelled form field wrapper. `wide` spans both columns in a 2-col grid.
// Shared by the profile, holiday and settings forms.
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
    <div className={wide ? 'sm:col-span-2' : ''}>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
        {label}
      </label>
      {children}
    </div>
  )
}
