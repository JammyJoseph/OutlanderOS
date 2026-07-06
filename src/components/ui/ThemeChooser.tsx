'use client'

import { Sun, Moon, Check } from 'lucide-react'
import { useTheme } from '@/components/theme-context'

// Light / dark theme picker. Shared by the profile and settings pages.
export function ThemeChooser() {
  const { theme, setTheme } = useTheme()
  const options: { value: 'light' | 'dark'; label: string; icon: React.ReactNode; desc: string }[] = [
    { value: 'light', label: 'Light', icon: <Sun className="h-4 w-4" />, desc: 'Bright, default theme' },
    { value: 'dark', label: 'Dark', icon: <Moon className="h-4 w-4" />, desc: 'Low-light, high contrast' },
  ]
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {options.map((opt) => {
        const active = theme === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => setTheme(opt.value)}
            className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-colors ${
              active
                ? 'border-[#9C7C2E] bg-amber-50 dark:bg-amber-900/30 ring-2 ring-amber-200/60'
                : 'border-gray-200 dark:border-gray-700 bg-gray-50/40 dark:bg-gray-800/40 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${active ? 'bg-[#9C7C2E] text-black' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>
              {opt.icon}
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{opt.label}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{opt.desc}</div>
            </div>
            {active && <Check className="h-4 w-4 text-[#9C7C2E]" />}
          </button>
        )
      })}
    </div>
  )
}
