'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Calendar, Mail, Building2, ShieldCheck, User as UserIcon, Pencil, X, Check, Sun, Moon } from 'lucide-react'
import { useTheme } from '@/components/theme-context'

type Me = {
  id: string
  email: string
  name: string
  role: 'ADMIN' | 'MEMBER'
  avatarUrl: string | null
  avatar: string | null
  department: string | null
  startDate: string | null
  holidayAllowance: number
  salary: number | null
  createdAt: string
}

type TeamMember = {
  id: string
  email: string
  name: string
  role: 'ADMIN' | 'MEMBER'
  avatarUrl: string | null
  avatar: string | null
  department: string | null
  startDate: string | null
  holidayAllowance: number
  salary?: number | null
  createdAt: string
}

const INPUT_CLS =
  'w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-[#ffd700] focus:ring-2 focus:ring-amber-200/60'

function getInitials(name: string): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?'
}

function formatGBP(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '—'
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(amount)
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function avatarSrc(u: { avatar: string | null; avatarUrl: string | null }): string | null {
  return u.avatar || u.avatarUrl || null
}

export default function ProfilePage() {
  const [me, setMe] = useState<Me | null>(null)
  const [team, setTeam] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editTarget, setEditTarget] = useState<TeamMember | null>(null)

  const [form, setForm] = useState({
    name: '',
    department: '',
    avatarUrl: '',
    salary: '' as number | string,
    holidayAllowance: 25 as number,
    role: 'MEMBER' as 'ADMIN' | 'MEMBER',
  })

  useEffect(() => {
    void load()
  }, [])

  async function load() {
    setLoading(true)
    try {
      const [meJson, usersJson] = await Promise.all([
        fetch('/api/me').then((r) => (r.ok ? r.json() : { user: null })),
        fetch('/api/users').then((r) => (r.ok ? r.json() : [])),
      ])
      const meUser: Me | null = meJson?.user ?? null
      setMe(meUser)
      setTeam(Array.isArray(usersJson) ? usersJson : [])
      if (meUser) {
        setForm({
          name: meUser.name ?? '',
          department: meUser.department ?? '',
          avatarUrl: meUser.avatarUrl ?? meUser.avatar ?? '',
          salary: meUser.salary ?? '',
          holidayAllowance: meUser.holidayAllowance ?? 25,
          role: meUser.role,
        })
      }
    } finally {
      setLoading(false)
    }
  }

  async function save() {
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        department: form.department || null,
        avatarUrl: form.avatarUrl || null,
        avatar: form.avatarUrl || null,
      }
      if (me?.role === 'ADMIN') {
        payload.salary = form.salary === '' ? null : Number(form.salary)
        payload.holidayAllowance = Number(form.holidayAllowance)
        payload.role = form.role
      }
      const res = await fetch('/api/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        setEditing(false)
        await load()
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="rounded-2xl bg-white dark:bg-gray-900 p-10 text-center text-sm text-gray-400 dark:text-gray-500 shadow-sm">Loading profile…</div>
      </div>
    )
  }

  if (!me) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="rounded-2xl bg-white dark:bg-gray-900 p-10 text-center text-sm text-gray-400 dark:text-gray-500 shadow-sm">
          Could not load profile. <Link href="/login" className="text-amber-600 dark:text-amber-400 underline">Sign in</Link>
        </div>
      </div>
    )
  }

  const isAdmin = me.role === 'ADMIN'

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">My Profile</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Your details, role and team directory</p>
      </div>

      <div className="rounded-2xl bg-white dark:bg-gray-900 p-8 shadow-sm border border-gray-100 dark:border-gray-800">
        <div className="flex items-start justify-between gap-6">
          <div className="flex items-center gap-5">
            <Avatar name={me.name} src={avatarSrc(me)} size={88} />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{me.name}</h2>
                <RoleBadge role={me.role} />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
                <span className="inline-flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> {me.email}</span>
                {me.department && <span className="inline-flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" /> {me.department}</span>}
                {me.startDate && <span className="inline-flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> Since {formatDate(me.startDate)}</span>}
              </div>
            </div>
          </div>
          <button
            onClick={() => setEditing((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 dark:border-gray-700 px-3.5 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            {editing ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
            {editing ? 'Cancel' : 'Edit'}
          </button>
        </div>

        {editing ? (
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field label="Name">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={INPUT_CLS} />
            </Field>
            <Field label="Department">
              <input
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
                placeholder="e.g. Editorial"
                className={INPUT_CLS}
              />
            </Field>
            <Field label="Avatar URL" wide>
              <input
                value={form.avatarUrl}
                onChange={(e) => setForm({ ...form, avatarUrl: e.target.value })}
                placeholder="https://…"
                className={INPUT_CLS}
              />
            </Field>
            {isAdmin && (
              <>
                <Field label="Salary (£)">
                  <input
                    type="number"
                    value={form.salary}
                    onChange={(e) => setForm({ ...form, salary: e.target.value })}
                    className={INPUT_CLS}
                  />
                </Field>
                <Field label="Holiday allowance (days)">
                  <input
                    type="number"
                    value={form.holidayAllowance}
                    onChange={(e) => setForm({ ...form, holidayAllowance: Number(e.target.value) })}
                    className={INPUT_CLS}
                  />
                </Field>
                <Field label="Role">
                  <select
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value as 'ADMIN' | 'MEMBER' })}
                    className={INPUT_CLS}
                  >
                    <option value="MEMBER">Member</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </Field>
              </>
            )}
            <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
              <button
                onClick={() => setEditing(false)}
                className="rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#ffd700] px-4 py-2 text-sm font-semibold text-black hover:brightness-95 disabled:opacity-50"
              >
                <Check className="h-4 w-4" />
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-x-10 gap-y-4 sm:grid-cols-3">
            <Stat label="Email" value={me.email} icon={<Mail className="h-4 w-4" />} />
            <Stat label="Department" value={me.department || '—'} icon={<Building2 className="h-4 w-4" />} />
            <Stat label="Member since" value={formatDate(me.startDate ?? me.createdAt)} icon={<Calendar className="h-4 w-4" />} />
          </div>
        )}

        {isAdmin && !editing && (
          <div className="mt-8 rounded-xl bg-amber-50/60 dark:bg-amber-900/30 p-5 border border-amber-100/70 dark:border-amber-800">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
              <ShieldCheck className="h-3.5 w-3.5" /> Admin information
            </div>
            <div className="mt-3 grid grid-cols-1 gap-x-10 gap-y-3 sm:grid-cols-3">
              <Stat label="Salary" value={formatGBP(me.salary)} />
              <Stat label="Holiday allowance" value={`${me.holidayAllowance} days`} />
              <Stat label="Role" value={me.role} />
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 rounded-2xl bg-white dark:bg-gray-900 p-6 shadow-sm border border-gray-100 dark:border-gray-800">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-900/30 text-[#ffd700]"><Sun className="h-4 w-4" /></div>
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Appearance</h2>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Choose how OutlanderOS looks for you</p>
          </div>
        </div>
        <div className="mt-5">
          <ThemeChooser />
        </div>
      </div>

      <div className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Team directory</h2>
          <span className="text-xs text-gray-400 dark:text-gray-500">{team.length} {team.length === 1 ? 'member' : 'members'}</span>
        </div>
        <div className="mt-4 overflow-hidden rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Department</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Holiday</th>
                {isAdmin && <th className="px-5 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {team.length === 0 ? (
                <tr><td colSpan={isAdmin ? 6 : 5} className="px-5 py-8 text-center text-gray-400 dark:text-gray-500">No team members yet.</td></tr>
              ) : (
                team.map((u) => (
                  <tr key={u.id} className="border-b border-gray-50 dark:border-gray-800 last:border-0 hover:bg-gray-50/60 dark:hover:bg-gray-800/60">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={u.name} src={avatarSrc(u)} size={32} />
                        <span className="font-medium text-gray-900 dark:text-gray-100">{u.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3"><RoleBadge role={u.role} /></td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-400">{u.department || '—'}</td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-400">{u.email}</td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-400">{u.holidayAllowance} days</td>
                    {isAdmin && (
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => setEditTarget(u)}
                          className="text-xs font-medium text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-200"
                        >
                          Edit
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editTarget && isAdmin && (
        <EditUserModal
          user={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={async () => {
            setEditTarget(null)
            await load()
          }}
        />
      )}
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
                ? 'border-[#ffd700] bg-amber-50 dark:bg-amber-900/30 ring-2 ring-amber-200/60'
                : 'border-gray-200 dark:border-gray-700 bg-gray-50/40 dark:bg-gray-800/40 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${active ? 'bg-[#ffd700] text-black' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>
              {opt.icon}
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{opt.label}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{opt.desc}</div>
            </div>
            {active && <Check className="h-4 w-4 text-[#ffd700]" />}
          </button>
        )
      })}
    </div>
  )
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={wide ? 'sm:col-span-2' : ''}>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{label}</label>
      {children}
    </div>
  )
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">{value}</div>
    </div>
  )
}

function Avatar({ name, src, size }: { name: string; src: string | null; size: number }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        className="rounded-full object-cover ring-2 ring-white shadow-sm"
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <div
      className="flex items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-white font-semibold ring-2 ring-white shadow-sm"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {getInitials(name)}
    </div>
  )
}

function RoleBadge({ role }: { role: 'ADMIN' | 'MEMBER' }) {
  if (role === 'ADMIN') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-300">
        <ShieldCheck className="h-3 w-3" /> Admin
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400">
      <UserIcon className="h-3 w-3" /> Member
    </span>
  )
}

function EditUserModal({
  user,
  onClose,
  onSaved,
}: {
  user: TeamMember
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    name: user.name,
    email: user.email,
    department: user.department ?? '',
    avatarUrl: user.avatarUrl ?? user.avatar ?? '',
    salary: user.salary ?? '',
    holidayAllowance: user.holidayAllowance,
    role: user.role,
    startDate: user.startDate ? user.startDate.slice(0, 10) : '',
  })
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          department: form.department || null,
          avatarUrl: form.avatarUrl || null,
          avatar: form.avatarUrl || null,
          salary: form.salary === '' ? null : Number(form.salary),
          holidayAllowance: Number(form.holidayAllowance),
          role: form.role,
          startDate: form.startDate || null,
        }),
      })
      if (res.ok) onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-gray-900 p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Edit {user.name}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Name"><input className={INPUT_CLS} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Email"><input className={INPUT_CLS} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Department"><input className={INPUT_CLS} value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></Field>
          <Field label="Start date"><input type="date" className={INPUT_CLS} value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></Field>
          <Field label="Avatar URL" wide><input className={INPUT_CLS} value={form.avatarUrl} onChange={(e) => setForm({ ...form, avatarUrl: e.target.value })} /></Field>
          <Field label="Salary (£)"><input type="number" className={INPUT_CLS} value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })} /></Field>
          <Field label="Holiday allowance"><input type="number" className={INPUT_CLS} value={form.holidayAllowance} onChange={(e) => setForm({ ...form, holidayAllowance: Number(e.target.value) })} /></Field>
          <Field label="Role" wide>
            <select className={INPUT_CLS} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as 'ADMIN' | 'MEMBER' })}>
              <option value="MEMBER">Member</option>
              <option value="ADMIN">Admin</option>
            </select>
          </Field>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">Cancel</button>
          <button onClick={save} disabled={saving} className="rounded-xl bg-[#ffd700] px-4 py-2 text-sm font-semibold text-black hover:brightness-95 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
