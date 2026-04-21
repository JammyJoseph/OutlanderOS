'use client'

import { useState } from 'react'
import { Plus, X, ChevronDown, ChevronUp, Calendar, Repeat, Users } from 'lucide-react'

type FranchiseStatus = 'active' | 'planning' | 'paused'
type Frequency = 'monthly' | 'quarterly' | 'one-off'
type EventStatus = 'confirmed' | 'tentative' | 'completed'

interface FranchiseEvent {
  id: string
  title: string
  date: string
  venue?: string
  status: EventStatus
}

interface Franchise {
  id: string
  name: string
  description: string
  frequency: Frequency
  nextEventDate: string
  status: FranchiseStatus
  color: string
  team: string[]
  upcomingEvents: FranchiseEvent[]
  pastEvents: FranchiseEvent[]
}

const DEMO_FRANCHISES: Franchise[] = [
  {
    id: '1',
    name: 'Fashion Week Coverage',
    description: 'Seasonal runway reports, designer profiles, and street style from LFW, NYFW, PFW, and MFW.',
    frequency: 'quarterly',
    nextEventDate: '2026-09-12',
    status: 'active',
    color: 'bg-amber-50 border-amber-200 text-amber-700',
    team: ['Emma Rhodes', 'Tom Hughes', 'Sara Kim'],
    upcomingEvents: [
      { id: 'e1', title: 'LFW SS27 Coverage', date: '2026-09-12', venue: 'London', status: 'confirmed' },
      { id: 'e2', title: 'NYFW SS27 Coverage', date: '2026-09-08', venue: 'New York', status: 'tentative' },
    ],
    pastEvents: [
      { id: 'e3', title: 'PFW AW26 Coverage', date: '2026-03-02', venue: 'Paris', status: 'completed' },
      { id: 'e4', title: 'LFW AW26 Coverage', date: '2026-02-14', venue: 'London', status: 'completed' },
    ],
  },
  {
    id: '2',
    name: 'Artist Spotlight Series',
    description: 'In-depth profiles on emerging and established artists across music, visual art, and performance.',
    frequency: 'monthly',
    nextEventDate: '2026-05-01',
    status: 'active',
    color: 'bg-purple-50 border-purple-200 text-purple-700',
    team: ['James Liu', 'Priya Sharma'],
    upcomingEvents: [
      { id: 'e5', title: 'May Spotlight: Naomi Asante', date: '2026-05-01', status: 'confirmed' },
      { id: 'e6', title: 'June Spotlight: TBC', date: '2026-06-01', status: 'tentative' },
    ],
    pastEvents: [
      { id: 'e7', title: 'April Spotlight: Marco Rossi', date: '2026-04-01', status: 'completed' },
    ],
  },
  {
    id: '3',
    name: 'Cultural Commentary',
    description: 'Essays and opinion pieces on fashion\'s intersection with culture, politics, and society.',
    frequency: 'monthly',
    nextEventDate: '2026-05-15',
    status: 'active',
    color: 'bg-blue-50 border-blue-200 text-blue-700',
    team: ['Emma Rhodes', 'Alix Fontaine'],
    upcomingEvents: [
      { id: 'e8', title: 'Sustainability Issue Essay', date: '2026-05-15', status: 'confirmed' },
    ],
    pastEvents: [
      { id: 'e9', title: 'The New Luxury', date: '2026-04-10', status: 'completed' },
      { id: 'e10', title: 'Digital vs Physical Fashion', date: '2026-03-18', status: 'completed' },
    ],
  },
  {
    id: '4',
    name: 'Street Style',
    description: 'Real people, real fashion. Monthly street style dispatches from cities around the world.',
    frequency: 'monthly',
    nextEventDate: '2026-05-20',
    status: 'active',
    color: 'bg-green-50 border-green-200 text-green-700',
    team: ['Tom Hughes', 'Mia Johansson'],
    upcomingEvents: [
      { id: 'e11', title: 'London Spring Streets', date: '2026-05-20', venue: 'London', status: 'confirmed' },
      { id: 'e12', title: 'Tokyo Summer Streets', date: '2026-06-10', venue: 'Tokyo', status: 'tentative' },
    ],
    pastEvents: [
      { id: 'e13', title: 'Paris Winter Streets', date: '2026-01-25', venue: 'Paris', status: 'completed' },
    ],
  },
]

const STATUS_STYLES: Record<FranchiseStatus, { badge: string; label: string }> = {
  active: { badge: 'bg-emerald-100 text-emerald-700', label: 'Active' },
  planning: { badge: 'bg-amber-100 text-amber-700', label: 'Planning' },
  paused: { badge: 'bg-gray-100 text-gray-500', label: 'Paused' },
}

const FREQ_LABELS: Record<Frequency, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  'one-off': 'One-off',
}

const EVENT_STATUS_STYLES: Record<EventStatus, string> = {
  confirmed: 'bg-emerald-100 text-emerald-700',
  tentative: 'bg-amber-100 text-amber-700',
  completed: 'bg-gray-100 text-gray-500',
}

const EMPTY_FORM = { name: '', description: '', frequency: 'monthly' as Frequency }

export default function EditorialPage() {
  const [franchises, setFranchises] = useState<Franchise[]>(DEMO_FRANCHISES)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)

  function handleCreate() {
    if (!form.name.trim()) return
    const newFranchise: Franchise = {
      id: String(Date.now()),
      name: form.name,
      description: form.description,
      frequency: form.frequency,
      nextEventDate: '',
      status: 'planning',
      color: 'bg-gray-50 border-gray-200 text-gray-700',
      team: [],
      upcomingEvents: [],
      pastEvents: [],
    }
    setFranchises(prev => [newFranchise, ...prev])
    setShowModal(false)
    setForm(EMPTY_FORM)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Editorial Franchises</h1>
          <p className="text-xs text-gray-500">Recurring series, events, and content programmes</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 rounded-lg bg-[#D4A853] px-3 py-2 text-xs font-semibold text-white hover:bg-[#C49843] transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Create Franchise
        </button>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {franchises.map(franchise => (
            <FranchiseCard
              key={franchise.id}
              franchise={franchise}
              expanded={expandedId === franchise.id}
              onToggle={() => setExpandedId(expandedId === franchise.id ? null : franchise.id)}
            />
          ))}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Create Franchise</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Franchise Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Summer Style Guide"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                  placeholder="What is this franchise about?"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300 resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Frequency</label>
                <select
                  value={form.frequency}
                  onChange={e => setForm(f => ({ ...f, frequency: e.target.value as Frequency }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300"
                >
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="one-off">One-off</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-gray-100">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!form.name.trim()}
                className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-40 transition-colors"
              >
                Create Franchise
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function FranchiseCard({ franchise, expanded, onToggle }: { franchise: Franchise; expanded: boolean; onToggle: () => void }) {
  const statusStyle = STATUS_STYLES[franchise.status]
  const nextDate = franchise.nextEventDate
    ? new Date(franchise.nextEventDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : null

  return (
    <div className={`rounded-xl border bg-white overflow-hidden hover:shadow-md transition-shadow`}>
      <div className="p-5 cursor-pointer" onClick={onToggle}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-gray-900 text-sm truncate">{franchise.name}</h3>
              <span className={`flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusStyle.badge}`}>
                {statusStyle.label}
              </span>
            </div>
            <p className="text-xs text-gray-500 line-clamp-2">{franchise.description}</p>
          </div>
          {expanded ? <ChevronUp size={16} className="text-gray-400 flex-shrink-0 mt-0.5" /> : <ChevronDown size={16} className="text-gray-400 flex-shrink-0 mt-0.5" />}
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <Repeat size={11} className="text-gray-400" />
            {FREQ_LABELS[franchise.frequency]}
          </span>
          {nextDate && (
            <span className="flex items-center gap-1.5">
              <Calendar size={11} className="text-gray-400" />
              Next: {nextDate}
            </span>
          )}
          {franchise.team.length > 0 && (
            <span className="flex items-center gap-1.5">
              <Users size={11} className="text-gray-400" />
              {franchise.team.length} team member{franchise.team.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50 p-5 space-y-4">
          {franchise.team.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Team</p>
              <div className="flex flex-wrap gap-1.5">
                {franchise.team.map(member => (
                  <span key={member} className="text-xs bg-white border border-gray-200 text-gray-700 px-2 py-0.5 rounded-full">
                    {member}
                  </span>
                ))}
              </div>
            </div>
          )}

          {franchise.upcomingEvents.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Upcoming</p>
              <div className="space-y-1.5">
                {franchise.upcomingEvents.map(event => (
                  <EventRow key={event.id} event={event} />
                ))}
              </div>
            </div>
          )}

          {franchise.pastEvents.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Past Events</p>
              <div className="space-y-1.5">
                {franchise.pastEvents.map(event => (
                  <EventRow key={event.id} event={event} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function EventRow({ event }: { event: FranchiseEvent }) {
  const dateStr = new Date(event.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-white border border-gray-100 px-3 py-2">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-800 truncate">{event.title}</p>
        <p className="text-[10px] text-gray-400">{dateStr}{event.venue ? ` · ${event.venue}` : ''}</p>
      </div>
      <span className={`flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${EVENT_STATUS_STYLES[event.status]}`}>
        {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
      </span>
    </div>
  )
}
