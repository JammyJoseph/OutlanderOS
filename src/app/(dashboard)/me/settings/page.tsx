'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Lock, Bell, Sun, ChevronRight } from 'lucide-react'
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

      <Section icon={<Bell className="h-4 w-4" />} title="Notifications" subtitle="Choose what you'd like to be notified about (coming soon)">
        <div className="space-y-3">
          <Toggle label="Holiday request updates" defaultChecked />
          <Toggle label="Weekly digest emails" defaultChecked />
          <Toggle label="@mentions in Ask OS" />
          <Toggle label="System maintenance alerts" defaultChecked />
        </div>
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
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-900/30 text-[#ffd700]">{icon}</div>
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>}
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  )
}

function Toggle({ label, defaultChecked }: { label: string; defaultChecked?: boolean }) {
  const [on, setOn] = useState(!!defaultChecked)
  return (
    <label className="flex items-center justify-between rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/40 dark:bg-gray-800/40 p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
      <span className="text-sm text-gray-800 dark:text-gray-200">{label}</span>
      <button
        type="button"
        onClick={() => setOn((v) => !v)}
        className={`relative h-5 w-9 rounded-full transition-colors ${on ? 'bg-[#ffd700]' : 'bg-gray-300 dark:bg-gray-600'}`}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white dark:bg-gray-900 shadow transition-all ${on ? 'left-[calc(100%-1.125rem)]' : 'left-0.5'}`} />
      </button>
    </label>
  )
}
