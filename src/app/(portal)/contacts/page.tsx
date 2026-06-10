'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Search, Plus, Upload, Mail, Phone, Globe, AtSign, Building2, Tag, X, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'

type Contact = {
  id: string
  name: string
  email?: string
  phone?: string
  company?: string
  role?: string
  category: string
  tags: string[]
  instagram?: string
  website?: string
  notes?: string
  lastInteraction?: string
  createdAt: string
}

const CATEGORIES = [
  { value: 'all', label: 'All' },
  { value: 'brand', label: 'Brands' },
  { value: 'press', label: 'Press' },
  { value: 'influencer', label: 'Influencers' },
  { value: 'photographer', label: 'Photographers' },
  { value: 'stylist', label: 'Stylists' },
  { value: 'model', label: 'Models' },
  { value: 'venue', label: 'Venues' },
  { value: 'supplier', label: 'Suppliers' },
  { value: 'crew', label: 'Crew' },
]

const CATEGORY_COLORS: Record<string, string> = {
  brand: 'bg-blue-100 text-blue-700',
  press: 'bg-purple-100 text-purple-700',
  influencer: 'bg-pink-100 text-pink-700',
  photographer: 'bg-amber-100 text-amber-700',
  stylist: 'bg-green-100 text-green-700',
  model: 'bg-rose-100 text-rose-700',
  venue: 'bg-teal-100 text-teal-700',
  supplier: 'bg-orange-100 text-orange-700',
  crew: 'bg-gray-100 text-gray-700',
}

const FROM_FILTER_MAP: Record<string, string[]> = {
  commercial: ['brand'],
  production: ['photographer', 'stylist', 'crew'],
  print: ['press', 'supplier'],
}

const EMPTY_FORM = {
  name: '', email: '', phone: '', company: '', role: '',
  category: 'brand', tags: '', instagram: '', website: '', notes: '',
}

function ContactsPageInner() {
  const searchParams = useSearchParams()
  const fromParam = searchParams.get('from') || ''
  const categoryParam = searchParams.get('category') || ''

  const getInitialCategories = (): string[] => {
    if (fromParam && FROM_FILTER_MAP[fromParam]) return FROM_FILTER_MAP[fromParam]
    if (categoryParam && categoryParam !== 'all') return [categoryParam]
    return []
  }

  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeCategories, setActiveCategories] = useState<string[]>(getInitialCategories)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const fetchContacts = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (activeCategories.length === 1) params.set('category', activeCategories[0])
    else if (activeCategories.length > 1) params.set('categories', activeCategories.join(','))
    const res = await fetch(`/api/contacts?${params}`)
    const data = await res.json()
    setContacts(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [search, activeCategories])

  useEffect(() => {
    const t = setTimeout(fetchContacts, 300)
    return () => clearTimeout(t)
  }, [fetchContacts])

  function toggleCategory(value: string) {
    if (value === 'all') {
      setActiveCategories([])
      return
    }
    setActiveCategories(prev =>
      prev.includes(value) ? prev.filter(c => c !== value) : [...prev, value]
    )
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Name is required'); return }
    setSaving(true)
    setError('')
    const res = await fetch('/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
        createdBy: 'system',
      }),
    })
    if (res.ok) {
      setShowModal(false)
      setForm(EMPTY_FORM)
      fetchContacts()
    } else {
      const d = await res.json()
      setError(d.error || 'Failed to save')
    }
    setSaving(false)
  }

  function handleCsvImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const text = ev.target?.result as string
      const lines = text.split('\n').filter(Boolean)
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
      for (const line of lines.slice(1)) {
        const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
        const row: Record<string, string> = {}
        headers.forEach((h, i) => { row[h] = vals[i] || '' })
        if (!row.name) continue
        await fetch('/api/contacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: row.name, email: row.email, phone: row.phone,
            company: row.company, role: row.role,
            category: row.category || 'brand',
            tags: row.tags ? row.tags.split(';').map(t => t.trim()) : [],
            instagram: row.instagram, website: row.website, notes: row.notes,
            createdBy: 'system',
          }),
        })
      }
      fetchContacts()
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const contextLabel = fromParam
    ? { commercial: 'Commercial contacts', production: 'Production crew', print: 'Print contacts' }[fromParam]
    : null

  return (
    <div className="flex flex-col h-full min-h-screen bg-gray-50">
      <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-[#E5E7EB] px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900"><span className="h-2 w-2 rounded-full bg-[#2C3E50]" />Contacts Blackbook</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {contextLabel && <span className="mr-2 text-[#2C3E50] font-medium">{contextLabel} ·</span>}
              {contacts.length} contact{contacts.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              <Upload size={14} />
              Import CSV
              <input type="file" accept=".csv" className="hidden" onChange={handleCsvImport} />
            </label>
            <button
              onClick={() => { setShowModal(true); setError('') }}
              className="flex items-center gap-2 px-4 py-2 bg-[#2C3E50] text-white text-sm rounded-lg hover:bg-[#1F2D3A] transition-colors"
            >
              <Plus size={14} />
              Add Contact
            </button>
          </div>
        </div>

        <div className="relative mb-3">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, company, or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2C3E50]/30"
          />
        </div>

        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => toggleCategory('all')}
            className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${activeCategories.length === 0 ? 'bg-[#2C3E50] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            All
          </button>
          {CATEGORIES.slice(1).map(cat => (
            <button
              key={cat.value}
              onClick={() => toggleCategory(cat.value)}
              className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${activeCategories.includes(cat.value) ? 'bg-[#2C3E50] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400 text-sm">Loading…</div>
        ) : contacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <p className="text-sm">No contacts found</p>
            <p className="text-xs mt-1">Add your first contact or import a CSV</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {contacts.map(contact => (
              <ContactCard
                key={contact.id}
                contact={contact}
                expanded={expandedId === contact.id}
                onToggle={() => setExpandedId(expandedId === contact.id ? null : contact.id)}
              />
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Add Contact</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-3">
              {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Name *" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} />
                <Field label="Company" value={form.company} onChange={v => setForm(f => ({ ...f, company: v }))} />
                <Field label="Role / Title" value={form.role} onChange={v => setForm(f => ({ ...f, role: v }))} />
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2C3E50]/30">
                    {CATEGORIES.slice(1).map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <Field label="Email" value={form.email} type="email" onChange={v => setForm(f => ({ ...f, email: v }))} />
                <Field label="Phone" value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} />
                <Field label="Instagram" value={form.instagram} onChange={v => setForm(f => ({ ...f, instagram: v }))} placeholder="@handle" />
                <Field label="Website" value={form.website} onChange={v => setForm(f => ({ ...f, website: v }))} />
              </div>
              <Field label="Tags (comma-separated)" value={form.tags} onChange={v => setForm(f => ({ ...f, tags: v }))} placeholder="fashion, luxury, tech" />
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2C3E50]/30 resize-none" />
              </div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-gray-100">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm bg-[#2C3E50] text-white rounded-lg hover:bg-[#1F2D3A] disabled:opacity-50 transition-colors">
                {saving ? 'Saving…' : 'Save Contact'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ContactsPage() {
  return (
    <Suspense fallback={<div className="flex h-full items-center justify-center"><Loader2 className="h-4 w-4 animate-spin text-gray-400" /></div>}>
      <ContactsPageInner />
    </Suspense>
  )
}

function Field({ label, value, onChange, type = 'text', placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2C3E50]/30" />
    </div>
  )
}

function ContactCard({ contact, expanded, onToggle }: { contact: Contact; expanded: boolean; onToggle: () => void }) {
  const colorClass = CATEGORY_COLORS[contact.category] || 'bg-gray-100 text-gray-700'
  const initials = contact.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer" onClick={onToggle}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-[#2C3E50]/10 border border-[#2C3E50]/15 flex items-center justify-center flex-shrink-0 text-sm font-semibold text-[#2C3E50]">{initials}</div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 text-sm truncate">{contact.name}</p>
            {contact.role && <p className="text-xs text-gray-500 truncate">{contact.role}</p>}
            {contact.company && (
              <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5 truncate">
                <Building2 size={10} />{contact.company}
              </p>
            )}
          </div>
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${colorClass} flex-shrink-0`}>{contact.category}</span>
        </div>

        {contact.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {contact.tags.slice(0, 3).map(tag => (
              <span key={tag} className="flex items-center gap-0.5 text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                <Tag size={8} />{tag}
              </span>
            ))}
            {contact.tags.length > 3 && <span className="text-[10px] text-gray-400">+{contact.tags.length - 3}</span>}
          </div>
        )}

        <div className="flex items-center justify-between mt-2">
          {contact.lastInteraction ? (
            <p className="text-[10px] text-gray-400">Last: {new Date(contact.lastInteraction).toLocaleDateString()}</p>
          ) : <span />}
          {expanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 p-4 bg-gray-50 space-y-2" onClick={e => e.stopPropagation()}>
          {contact.email && (
            <a href={`mailto:${contact.email}`} className="flex items-center gap-2 text-xs text-gray-600 hover:text-gray-900">
              <Mail size={12} className="text-gray-400" />{contact.email}
            </a>
          )}
          {contact.phone && (
            <a href={`tel:${contact.phone}`} className="flex items-center gap-2 text-xs text-gray-600 hover:text-gray-900">
              <Phone size={12} className="text-gray-400" />{contact.phone}
            </a>
          )}
          {contact.instagram && (
            <p className="flex items-center gap-2 text-xs text-gray-600">
              <AtSign size={12} className="text-gray-400" />{contact.instagram}
            </p>
          )}
          {contact.website && (
            <a href={contact.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-gray-600 hover:text-gray-900">
              <Globe size={12} className="text-gray-400" />{contact.website}
            </a>
          )}
          {contact.notes && <p className="text-xs text-gray-500 italic pt-1 border-t border-gray-200">{contact.notes}</p>}
        </div>
      )}
    </div>
  )
}
