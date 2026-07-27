'use client'

import Link from 'next/link'
import { Lock, Sun, ChevronRight } from 'lucide-react'
import { GoogleAccountSection } from './_components/GoogleAccountSection'
import { ThemeChooser } from '@/components/ui/ThemeChooser'

export default function MeSettingsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Settings</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Personal preferences</p>
      </div>

      <GoogleAccountSection />

      <Section icon={<Lock className="h-4 w-4" />} title="Change password" subtitle="Use a strong password you don't use elsewhere">
        <Link
          href="/me/change-password"
          className="flex items-center justify-between rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/40 dark:bg-gray-800/40 px-4 py-3 text-sm font-medium text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          <span>Update your password</span>
          <ChevronRight className="h-4 w-4 text-gray-400 dark:text-gray-500" />
        </Link>
      </Section>

      <Section icon={<Sun className="h-4 w-4" />} title="Appearance" subtitle="Choose how OutlanderOS looks for you">
        <ThemeChooser />
      </Section>
    </div>
  )
}

function Section({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string
  subtitle?: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="mb-6 rounded-2xl bg-white dark:bg-gray-900 p-6 shadow-sm border border-gray-100 dark:border-gray-800">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-900/30 text-[#9C7C2E] dark:text-[#C9A44A]">{icon}</div>
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>}
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  )
}
