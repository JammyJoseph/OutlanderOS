'use client'

import { useState } from 'react'
import { Lock, Bell, Sun, Moon, Check, AlertTriangle } from 'lucide-react'
import { GoogleAccountSection } from './_components/GoogleAccountSection'
import { useTheme } from '@/components/theme-context'

const INPUT_CLS =
  'w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#ffd700] focus:ring-2 focus:ring-amber-200/60'

export default function MeSettingsPage() {
  const [form, setForm] = useState({ current: '', next: '', confirm: '' })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  async function changePassword() {
    setMessage(null)
    if (!form.current || !form.next) {
      setMessage({ kind: 'err', text: 'Current and new password are required' })
      return
    }
    if (form.next !== form.confirm) {
      setMessage({ kind: 'err', text: 'New password and confirmation do not match' })
      return
    }
    if (form.next.length < 8) {
      setMessage({ kind: 'err', text: 'New password must be at least 8 characters' })
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/me/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: form.current, newPassword: form.next }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setMessage({ kind: 'err', text: data.error || 'Failed to change password' })
        return
      }
      setMessage({ kind: 'ok', text: 'Password updated successfully' })
      setForm({ current: '', next: '', confirm: '' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">Personal preferences</p>
      </div>

      <GoogleAccountSection />

      <Section icon={<Lock className="h-4 w-4" />} title="Change password" subtitle="Use a strong password you don't use elsewhere">
        <div className="grid grid-cols-1 gap-4">
          <Field label="Current password">
            <input type="password" className={INPUT_CLS} value={form.current}
              onChange={(e) => setForm({ ...form, current: e.target.value })} />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="New password">
              <input type="password" className={INPUT_CLS} value={form.next}
                onChange={(e) => setForm({ ...form, next: e.target.value })} />
            </Field>
            <Field label="Confirm new password">
              <input type="password" className={INPUT_CLS} value={form.confirm}
                onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
            </Field>
          </div>
        </div>
        {message && (
          <div className={`mt-3 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${
            message.kind === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
          }`}>
            {message.kind === 'ok' ? <Check className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
            {message.text}
          </div>
        )}
        <div className="mt-5 flex justify-end">
          <button onClick={changePassword} disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#ffd700] px-4 py-2 text-sm font-semibold text-black hover:brightness-95 disabled:opacity-50">
            {saving ? 'Updating…' : 'Update password'}
          </button>
        </div>
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
    <section className="mb-6 rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-[#ffd700]">{icon}</div>
        <div>
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</label>
      {children}
    </div>
  )
}

function ThemeChooser() {
  const { theme, setTheme } = useTheme()
  const options: { value: 'light' | 'dark'; label: string; icon: React.ReactNode; desc: string }[] = [
    { value: 'light', label: 'Light', icon: <Sun className="h-4 w-4" />, desc: 'Bright, default theme' },
    { value: 'dark', label: 'Dark', icon: <Moon className="h-4 w-4" />, desc: 'Low-light, high contrast' },
  ]
  return (
    <div className="grid grid-cols-2 gap-3">
      {options.map((opt) => {
        const active = theme === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => setTheme(opt.value)}
            className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-colors ${
              active
                ? 'border-[#ffd700] bg-amber-50 ring-2 ring-amber-200/60'
                : 'border-gray-200 bg-gray-50/40 hover:bg-gray-50'
            }`}
          >
            <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${active ? 'bg-[#ffd700] text-black' : 'bg-gray-200 text-gray-600'}`}>
              {opt.icon}
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-gray-900">{opt.label}</div>
              <div className="text-xs text-gray-500">{opt.desc}</div>
            </div>
            {active && <Check className="h-4 w-4 text-[#ffd700]" />}
          </button>
        )
      })}
    </div>
  )
}

function Toggle({ label, defaultChecked }: { label: string; defaultChecked?: boolean }) {
  const [on, setOn] = useState(!!defaultChecked)
  return (
    <label className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50/40 p-3 cursor-pointer hover:bg-gray-50">
      <span className="text-sm text-gray-800">{label}</span>
      <button
        type="button"
        onClick={() => setOn((v) => !v)}
        className={`relative h-5 w-9 rounded-full transition-colors ${on ? 'bg-[#ffd700]' : 'bg-gray-300'}`}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${on ? 'left-[calc(100%-1.125rem)]' : 'left-0.5'}`} />
      </button>
    </label>
  )
}
