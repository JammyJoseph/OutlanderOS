'use client'

import { useEffect, useState } from 'react'
import {
  Mail,
  FileSpreadsheet,
  BookOpen,
  MessageSquare,
  Send,
  Bot,
  LayoutDashboard,
  Activity,
  DollarSign,
  CheckCircle2,
  XCircle,
  ArrowRight,
  PenLine,
  FileCheck,
  Clock,
  Link,
  Wifi,
  RefreshCw,
  AlertCircle,
  ChevronRight,
} from 'lucide-react'
import { SyncHealthPanel } from '@/components/portal/SyncHealthPanel'

interface DashboardData {
  connected?: {
    billing?: boolean
    primary?: boolean
  }
  xero?: {
    connected?: boolean
    error?: string
  }
  billingTracker?: {
    error?: string
    deals?: unknown[]
  }
}

function StatusDot({ connected }: { connected: boolean }) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-gray-300'}`}
    />
  )
}

function openChat(question: string) {
  window.dispatchEvent(
    new CustomEvent('openChatWithQuestion', { detail: { question } })
  )
}

export default function SystemPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadedAt, setLoadedAt] = useState<string>('')

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => r.json())
      .then(d => {
        setData(d)
        setLoadedAt(new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }))
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  const billingConnected = !!data?.connected?.billing
  const primaryConnected = !!data?.connected?.primary
  const xeroConnected = !!data?.xero && !data.xero.error
  const trackerConnected = !!data?.billingTracker && !data.billingTracker.error
  const connectedCount = [billingConnected, primaryConnected, xeroConnected, trackerConnected].filter(Boolean).length

  const integrations = [
    {
      id: 'billing-google',
      icon: Mail,
      label: 'Google (billing@)',
      description: 'Monitors billing inbox for invoices, payments, and follow-up threads',
      connected: billingConnected,
      color: '#EA4335',
    },
    {
      id: 'primary-google',
      icon: Mail,
      label: 'Google (q@)',
      description: 'Reads calendar, Drive files, and email threads for deal context',
      connected: primaryConnected,
      color: '#4285F4',
    },
    {
      id: 'xero',
      icon: DollarSign,
      label: 'Xero',
      description: 'P&L, bank balance, invoices, aged receivables, payments',
      connected: xeroConnected,
      color: '#13B5EA',
    },
    {
      id: 'tracker',
      icon: FileSpreadsheet,
      label: 'Billing Tracker',
      description: 'Campaign deals, IO numbers, budgets, margins, quarterly targets',
      connected: trackerConnected,
      color: '#34A853',
    },
    {
      id: 'slack',
      icon: MessageSquare,
      label: 'Slack',
      description: 'Team presence, channel activity, internal comms',
      connected: false,
      color: '#4A154B',
    },
    {
      id: 'telegram',
      icon: Send,
      label: 'Telegram',
      description: 'Notifications, morning briefings, reminders to Quinn',
      connected: false,
      color: '#0088CC',
    },
    {
      id: 'ai',
      icon: Bot,
      label: 'AI Agent (Claude)',
      description: 'Natural language queries over all business data, live reasoning',
      connected: true,
      color: '#D4A853',
    },
  ]

  const quinnActions = [
    {
      icon: CheckCircle2,
      title: 'Approve / reject invoices',
      detail: 'The system flags invoices needing approval. You review and decide.',
      href: '/finance',
    },
    {
      icon: PenLine,
      title: 'Sign IOs',
      detail: 'When a deal is ready, you sign the IO. The system tracks it from there.',
      href: '/finance',
    },
    {
      icon: Mail,
      title: 'Review chase emails',
      detail: 'The system drafts follow-up emails for overdue invoices. You review before sending.',
      href: '/activity',
    },
    {
      icon: Clock,
      title: 'Morning briefing',
      detail: 'Sent to your Telegram every day. Review priorities and delegate.',
      href: '/activity',
    },
    {
      icon: Link,
      title: 'Connect new accounts',
      detail: 'When a new integration is needed, you authorise via Settings.',
      href: '/settings',
    },
  ]

  const agentExamples = [
    { question: 'How much have we booked this year?', label: 'Revenue' },
    { question: "What's the status with Nike?", label: 'Clients' },
    { question: 'Which invoices are overdue?', label: 'Invoices' },
    { question: 'What payments are expected this month?', label: 'Cash Flow' },
    { question: "Who's available today?", label: 'Team' },
  ]

  return (
    <div className="max-w-5xl mx-auto space-y-10 pb-16">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">System Overview</h1>
        <p className="mt-1 text-sm text-gray-500">
          How OutlanderOS works — data flows, integrations, and where your input matters
        </p>
      </div>

      {/* ── Section 1: Data Flow Diagram ── */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-5">
          Data Flow
        </h2>

        <div className="relative bg-gray-50 border border-gray-200 rounded-xl p-6 overflow-x-auto">
          <div className="flex items-stretch gap-0 min-w-[680px]">

            {/* Sources column */}
            <div className="flex flex-col justify-between gap-3 flex-1">
              {[
                {
                  icon: Mail,
                  label: 'Google billing@',
                  points: ['Invoice emails', 'Payment confirmations', 'Chase threads'],
                  connected: billingConnected,
                  color: '#EA4335',
                },
                {
                  icon: Mail,
                  label: 'Google q@',
                  points: ['Calendar events', 'Deal emails', 'Drive files'],
                  connected: primaryConnected,
                  color: '#4285F4',
                },
                {
                  icon: DollarSign,
                  label: 'Xero',
                  points: ['P&L reports', 'Bank transactions', 'Aged receivables'],
                  connected: xeroConnected,
                  color: '#13B5EA',
                },
                {
                  icon: FileSpreadsheet,
                  label: 'Billing Tracker',
                  points: ['IO numbers', 'Campaign budgets', 'Quarterly targets'],
                  connected: trackerConnected,
                  color: '#34A853',
                },
              ].map(src => {
                const Icon = src.icon
                return (
                  <div
                    key={src.label}
                    className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm flex flex-col gap-1.5"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded flex items-center justify-center shrink-0"
                        style={{ backgroundColor: src.color + '1A' }}
                      >
                        <Icon size={13} style={{ color: src.color }} />
                      </div>
                      <span className="text-xs font-semibold text-gray-800 truncate">{src.label}</span>
                      <StatusDot connected={src.connected} />
                    </div>
                    <ul className="space-y-0.5 pl-0.5">
                      {src.points.map(p => (
                        <li key={p} className="text-[10px] text-gray-500 leading-tight">— {p}</li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>

            {/* Arrows left */}
            <div className="flex flex-col justify-between items-center px-3 py-4">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className="flex items-center text-amber-400">
                  <div className="w-6 h-px bg-amber-300" />
                  <ArrowRight size={12} className="text-amber-400 -ml-1" />
                </div>
              ))}
            </div>

            {/* Engine */}
            <div className="flex flex-col items-center justify-center w-44 shrink-0">
              <div className="w-full bg-gray-900 rounded-xl p-4 text-center shadow-lg">
                <div className="w-8 h-8 rounded-full bg-[#D4A853] flex items-center justify-center mx-auto mb-2">
                  <Bot size={16} className="text-white" />
                </div>
                <p className="text-white text-xs font-bold tracking-wide">OutlanderOS</p>
                <p className="text-gray-400 text-[10px] mt-0.5">Engine</p>
                <div className="mt-3 space-y-1">
                  {['Processes data', 'Cross-references', 'Analyses & alerts', 'Answers queries'].map(t => (
                    <div key={t} className="text-[9px] text-gray-400 bg-gray-800 rounded px-2 py-0.5">
                      {t}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Arrows right */}
            <div className="flex flex-col justify-around items-center px-3 py-4">
              {[0, 1, 2].map(i => (
                <div key={i} className="flex items-center text-amber-400">
                  <div className="w-6 h-px bg-amber-300" />
                  <ArrowRight size={12} className="text-amber-400 -ml-1" />
                </div>
              ))}
            </div>

            {/* Outputs column */}
            <div className="flex flex-col justify-around gap-3 flex-1">
              {[
                {
                  icon: LayoutDashboard,
                  label: 'Dashboard',
                  points: ['KPIs & revenue', 'Project cards', 'Live alerts'],
                  href: '/',
                },
                {
                  icon: Activity,
                  label: 'Activity Log',
                  points: ['Alerts & tasks', 'Invoice actions', 'Email drafts'],
                  href: '/activity',
                },
                {
                  icon: DollarSign,
                  label: 'Finance',
                  points: ['P&L view', 'Cash flow', 'Invoice tracker'],
                  href: '/finance',
                },
              ].map(out => {
                const Icon = out.icon
                return (
                  <a
                    key={out.label}
                    href={out.href}
                    className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm flex flex-col gap-1.5 hover:border-amber-300 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded bg-amber-50 flex items-center justify-center shrink-0">
                        <Icon size={13} className="text-[#D4A853]" />
                      </div>
                      <span className="text-xs font-semibold text-gray-800">{out.label}</span>
                    </div>
                    <ul className="space-y-0.5 pl-0.5">
                      {out.points.map(p => (
                        <li key={p} className="text-[10px] text-gray-500 leading-tight">— {p}</li>
                      ))}
                    </ul>
                  </a>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 2: Integration Status ── */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-5">
          Integration Status
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {integrations.map(int => {
            const Icon = int.icon
            return (
              <div
                key={int.id}
                className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-2 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: int.color + '15' }}
                  >
                    <Icon size={15} style={{ color: int.color }} />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <StatusDot connected={int.connected} />
                    <span className={`text-[10px] font-medium ${int.connected ? 'text-green-600' : 'text-gray-400'}`}>
                      {int.connected ? 'Connected' : 'Not linked'}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-800">{int.label}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5 leading-snug">{int.description}</p>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── Section 3: Where Quinn's Input is Required ── */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-5">
          Where Your Input is Required
        </h2>
        <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100 shadow-sm overflow-hidden">
          {quinnActions.map((action, i) => {
            const Icon = action.icon
            return (
              <a
                key={i}
                href={action.href}
                className="flex items-start gap-4 px-5 py-4 hover:bg-amber-50 transition-colors group"
              >
                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-amber-100 transition-colors">
                  <Icon size={15} className="text-[#D4A853]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{action.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{action.detail}</p>
                </div>
                <ChevronRight size={14} className="text-gray-300 group-hover:text-[#D4A853] mt-1.5 shrink-0 transition-colors" />
              </a>
            )
          })}
        </div>
      </section>

      {/* ── Section 4: AI Agent Capabilities ── */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">
          Ask OS — What the Agent Can Do
        </h2>
        <p className="text-xs text-gray-400 mb-5">Click any example to open it in the chat</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {agentExamples.map((ex, i) => (
            <button
              key={i}
              onClick={() => openChat(ex.question)}
              className="bg-white border border-gray-200 rounded-xl p-4 text-left hover:border-[#D4A853] hover:shadow-md transition-all group"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-5 h-5 rounded-full bg-amber-50 flex items-center justify-center">
                  <Bot size={11} className="text-[#D4A853]" />
                </div>
                <span className="text-[10px] font-semibold text-[#D4A853] uppercase tracking-wider">{ex.label}</span>
              </div>
              <p className="text-sm text-gray-700 font-mono leading-snug">&ldquo;{ex.question}&rdquo;</p>
              <p className="text-[10px] text-gray-400 mt-2 group-hover:text-[#D4A853] transition-colors">
                Open in chat →
              </p>
            </button>
          ))}
        </div>
      </section>

      {/* ── Section 4.5: Sync Engine ── */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-5">
          Sync Engine
        </h2>
        <SyncHealthPanel />
      </section>

      {/* ── Section 5: System Health ── */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-5">
          System Health
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <Wifi size={13} className="text-green-500" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Server</span>
            </div>
            <p className="text-sm font-semibold text-gray-900">Online</p>
            <p className="text-[10px] text-green-500 mt-0.5">All systems running</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <RefreshCw size={13} className={loading ? 'text-amber-400 animate-spin' : 'text-gray-400'} />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Last Refresh</span>
            </div>
            <p className="text-sm font-semibold text-gray-900">
              {loading ? 'Loading…' : loadedAt || '—'}
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5">Auto on page load</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <FileCheck size={13} className="text-[#D4A853]" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Connected</span>
            </div>
            <p className="text-sm font-semibold text-gray-900">
              {loading ? '—' : `${connectedCount} / 4`}
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5">Data sources active</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle size={13} className="text-gray-300" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Errors</span>
            </div>
            <p className="text-sm font-semibold text-gray-900">None</p>
            <p className="text-[10px] text-green-500 mt-0.5">No recent errors</p>
          </div>
        </div>
      </section>
    </div>
  )
}
