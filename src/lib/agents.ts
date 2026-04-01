export interface Agent {
  id: string
  name: string
  role: string
  description: string
  color: string
  status: 'active' | 'thinking' | 'idle' | 'offline'
  currentTask: string | null
  capabilities: string[]
  position: { x: number; y: number; z: number }
}

export const AGENT_FLEET: Agent[] = [
  {
    id: 'operations',
    name: 'Operations',
    role: 'CEO Agent',
    description: 'The boss. Delegates tasks to all other agents. Connected to operations@outlandermag.com.',
    color: '#D4A853',
    status: 'active',
    currentTask: 'Monitoring all systems',
    capabilities: ['Task delegation', 'Email monitoring', 'Calendar management', 'Team coordination', 'Decision making'],
    position: { x: -3.5, y: 0, z: 2.5 }
  },
  {
    id: 'finance',
    name: 'Finance',
    role: 'Finance Agent',
    description: 'Monitors the 2026 Master Billing Tracker, flags overdue invoices, tracks cash flow and margins.',
    color: '#4ADE80',
    status: 'idle',
    currentTask: null,
    capabilities: ['Invoice tracking', 'Cash flow analysis', 'Revenue reporting', 'Payment reminders', 'Margin calculation'],
    position: { x: 3.5, y: 0, z: 2.5 }
  },
  {
    id: 'email',
    name: 'Email',
    role: 'Email Agent',
    description: 'Watches billing@outlandermag.com, categorizes messages, drafts follow-ups, flags action items.',
    color: '#60A5FA',
    status: 'idle',
    currentTask: null,
    capabilities: ['Email monitoring', 'Message categorization', 'Follow-up drafting', 'Attachment processing', 'Priority flagging'],
    position: { x: -3.5, y: 0, z: -0.5 }
  },
  {
    id: 'production',
    name: 'Production',
    role: 'Production Agent',
    description: 'Tracks shoot schedules, crew bookings, studio reservations, and delivery deadlines.',
    color: '#A78BFA',
    status: 'idle',
    currentTask: null,
    capabilities: ['Schedule tracking', 'Crew management', 'Call sheet generation', 'Deadline monitoring', 'Vendor coordination'],
    position: { x: 3.5, y: 0, z: -0.5 }
  },
  {
    id: 'sales',
    name: 'Sales',
    role: 'Sales Agent',
    description: 'Monitors deal pipeline, renewal windows, client relationship health, and pitch opportunities.',
    color: '#F87171',
    status: 'idle',
    currentTask: null,
    capabilities: ['Pipeline tracking', 'Renewal alerts', 'Client scoring', 'Deal analysis', 'Pitch preparation'],
    position: { x: -3.5, y: 0, z: -3.5 }
  },
  {
    id: 'content',
    name: 'Content',
    role: 'Content Agent',
    description: 'Tracks Instagram performance, manages content calendar, monitors posting schedule and engagement.',
    color: '#F472B6',
    status: 'idle',
    currentTask: null,
    capabilities: ['Instagram analytics', 'Content scheduling', 'Performance tracking', 'Trend analysis', 'Engagement monitoring'],
    position: { x: 3.5, y: 0, z: -3.5 }
  }
]

export const MOCK_ACTIVITY = [
  { id: '1', agentId: 'operations', action: 'delegated "Review Q1 invoices" to Finance', timestamp: new Date(Date.now() - 120000) },
  { id: '2', agentId: 'finance', action: 'flagged 3 overdue invoices totaling $12,400', timestamp: new Date(Date.now() - 95000) },
  { id: '3', agentId: 'email', action: 'categorized 14 new messages in billing inbox', timestamp: new Date(Date.now() - 72000) },
  { id: '4', agentId: 'operations', action: 'scheduled team standup for Thursday 10am', timestamp: new Date(Date.now() - 60000) },
  { id: '5', agentId: 'production', action: 'updated shoot schedule — Studio B booked April 3', timestamp: new Date(Date.now() - 45000) },
  { id: '6', agentId: 'sales', action: 'flagged Meridian Media renewal — 14 days remaining', timestamp: new Date(Date.now() - 30000) },
  { id: '7', agentId: 'content', action: 'posted weekly Instagram performance report', timestamp: new Date(Date.now() - 15000) },
  { id: '8', agentId: 'operations', action: 'monitoring all systems — no issues detected', timestamp: new Date(Date.now() - 5000) },
]
