'use client'

import { useEffect, useState } from 'react'

interface LogEntry {
  timestamp: string
  type: 'PAYMENT' | 'SIGNED' | 'OVERDUE' | 'INVOICE' | 'REMINDER' | 'SYSTEM' | 'CROSSREF'
  client: string
  message: string
  amount?: number
  expanded?: boolean
  flags?: string[]
}

interface Reminder {
  id: string
  title: string
  dueDate: string
  priority: 'high' | 'medium' | 'low'
  category: string
  done: boolean
  status?: string
  emailActivity?: boolean
}

const TYPE_COLORS: Record<LogEntry['type'], string> = {
  PAYMENT: 'text-green-400',
  SIGNED: 'text-blue-400',
  OVERDUE: 'text-red-400',
  INVOICE: 'text-amber-400',
  REMINDER: 'text-gray-400',
  SYSTEM: 'text-white',
  CROSSREF: 'text-purple-400',
}

const PRIORITY_COLORS: Record<Reminder['priority'], string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-gray-100 text-gray-600',
}

function formatTimestamp(iso: string) {
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return iso
    return d.toISOString().replace('T', ' ').slice(0, 19)
  } catch {
    return iso
  }
}

function generateLogEntries(data: any): LogEntry[] {
  const entries: LogEntry[] = []

  if (data?.xero?.invoices) {
    for (const inv of data.xero.invoices) {
      entries.push({
        timestamp: inv.dueDate || new Date().toISOString(),
        type: inv.status === 'PAID' ? 'PAYMENT' : inv.amountDue > 0 ? 'INVOICE' : 'PAYMENT',
        client: inv.contact || 'Unknown',
        message:
          inv.status === 'PAID'
            ? `Payment received — £${inv.total?.toLocaleString()}`
            : `Invoice ${inv.invoiceNumber} — £${inv.amountDue?.toLocaleString()} outstanding`,
        amount: inv.total,
      })
    }
  }

  if (data?.billingAlerts) {
    for (const alert of data.billingAlerts) {
      entries.push({
        timestamp: alert.date || new Date().toISOString(),
        type:
          alert.type === 'payment_overdue'
            ? 'OVERDUE'
            : alert.type === 'payment_confirmed'
            ? 'PAYMENT'
            : 'INVOICE',
        client: alert.client || 'Unknown',
        message: alert.subject || alert.message || '',
      })
    }
  }

  if (data?.billingTracker?.deals) {
    for (const deal of data.billingTracker.deals) {
      if (deal.signed) {
        entries.push({
          timestamp: deal.dateBooked || new Date().toISOString(),
          type: 'SIGNED',
          client: deal.client || 'Unknown',
          message: `IO ${deal.ioNumber} — ${deal.campaign} — £${deal.annualTotal}`,
        })
      }
    }
  }

  if (entries.length === 0) {
    entries.push({
      timestamp: new Date().toISOString(),
      type: 'SYSTEM',
      client: 'OutlanderOS',
      message: 'System initialised. Awaiting data connections.',
    })
  }

  return entries.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )
}

function findCrossRef(crossReference: any[], clientName: string): any | null {
  if (!crossReference?.length || !clientName) return null
  const lower = clientName.toLowerCase()
  return crossReference.find((cr: any) => {
    const crClient = (cr.client || '').toLowerCase()
    return crClient.includes(lower) || lower.includes(crClient)
  }) ?? null
}

function generateReminders(data: any): Reminder[] {
  const reminders: Reminder[] = []
  const now = new Date()
  const crossRef: any[] = data?.crossReference || []

  if (data?.xero?.invoices) {
    for (const inv of data.xero.invoices) {
      if (inv.status !== 'PAID' && inv.amountDue > 0 && inv.dueDate) {
        const due = new Date(inv.dueDate)
        const diffDays = Math.ceil((due.getTime() - now.getTime()) / 86400000)
        const cr = findCrossRef(crossRef, inv.contact)
        let status: string | undefined
        let emailActivity: boolean | undefined
        if (cr) {
          emailActivity = (cr.emailEvidence?.threadCount ?? 0) > 0
          if (cr.emailEvidence?.paymentMentioned) {
            status = 'Payment detected in email — verify in Xero'
          } else if (emailActivity) {
            status = 'In Progress'
          }
        }
        reminders.push({
          id: `xero-${inv.invoiceNumber}`,
          title: `Payment due: ${inv.contact} — £${inv.amountDue?.toLocaleString()}`,
          dueDate: inv.dueDate,
          priority: diffDays < 0 ? 'high' : diffDays < 7 ? 'medium' : 'low',
          category: 'Invoice',
          done: false,
          status,
          emailActivity,
        })
      }
    }
  }

  if (data?.billingTracker?.deals) {
    for (const deal of data.billingTracker.deals) {
      const cr = findCrossRef(crossRef, deal.client)
      const hasActivity = (cr?.emailEvidence?.threadCount ?? 0) > 0

      if (!deal.signed) {
        let status: string | undefined
        let emailActivity: boolean | undefined
        if (cr) {
          emailActivity = hasActivity
          if (cr.emailEvidence?.signedMentioned) {
            status = 'Likely Complete — verify in spreadsheet'
          } else if (hasActivity) {
            status = 'In Progress'
          }
        }
        reminders.push({
          id: `deal-${deal.ioNumber || deal.client}`,
          title: `Unsigned deal: ${deal.client} — ${deal.campaign || 'Campaign'}`,
          dueDate: deal.startDate || new Date().toISOString(),
          priority: 'medium',
          category: 'Deal',
          done: false,
          status,
          emailActivity,
        })
      }
      if (!deal.invoiceSent && deal.signed) {
        let status: string | undefined
        let emailActivity: boolean | undefined
        if (cr) {
          emailActivity = hasActivity
          if (cr.emailEvidence?.invoiceMentioned) {
            status = 'In Progress'
          } else if (hasActivity) {
            status = 'In Progress'
          }
        }
        reminders.push({
          id: `invoice-${deal.ioNumber || deal.client}`,
          title: `Invoice not sent: ${deal.client}`,
          dueDate: deal.startDate || new Date().toISOString(),
          priority: 'high',
          category: 'Invoice',
          done: false,
          status,
          emailActivity,
        })
      }
    }
  }

  // Fixed recurring reminders
  const vatMonths = [3, 6, 9, 12]
  const nextVat = vatMonths.find((m) => m > now.getMonth() + 1) || 3
  reminders.push({
    id: 'vat-quarterly',
    title: 'VAT Return due',
    dueDate: new Date(now.getFullYear(), nextVat - 1, 1).toISOString(),
    priority: 'medium',
    category: 'Tax',
    done: false,
  })

  const payrollDate = new Date(now.getFullYear(), now.getMonth(), 25)
  if (payrollDate < now) payrollDate.setMonth(payrollDate.getMonth() + 1)
  reminders.push({
    id: 'payroll-monthly',
    title: 'Monthly payroll run',
    dueDate: payrollDate.toISOString(),
    priority: now.getDate() >= 20 ? 'high' : 'low',
    category: 'Payroll',
    done: false,
  })

  return reminders.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1
    const pOrder = { high: 0, medium: 1, low: 2 }
    return pOrder[a.priority] - pOrder[b.priority]
  })
}

export default function ActivityPage() {
  const [logEntries, setLogEntries] = useState<LogEntry[]>([])
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [sendingBriefing, setSendingBriefing] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [blink, setBlink] = useState(true)

  useEffect(() => {
    const t = setInterval(() => setBlink((b) => !b), 600)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    fetch('/api/dashboard?crossref=true')
      .then((r) => r.json())
      .then((data) => {
        setLogEntries(generateLogEntries(data))
        setReminders(generateReminders(data))
      })
      .catch(() => {
        setLogEntries(generateLogEntries(null))
        setReminders(generateReminders(null))
      })
      .finally(() => setLoading(false))
  }, [])

  function toggleDone(id: string) {
    setReminders((prev) =>
      prev
        .map((r) => (r.id === id ? { ...r, done: !r.done } : r))
        .sort((a, b) => {
          if (a.done !== b.done) return a.done ? 1 : -1
          const pOrder = { high: 0, medium: 1, low: 2 }
          return pOrder[a.priority] - pOrder[b.priority]
        })
    )
  }

  async function sendToQuinn() {
    const active = reminders.filter((r) => !r.done).slice(0, 5)
    if (active.length === 0) {
      setToast('No active reminders to send.')
      setTimeout(() => setToast(null), 3000)
      return
    }
    const lines = active
      .map(
        (r) =>
          `• [${r.priority.toUpperCase()}] ${r.title} — due ${new Date(r.dueDate).toLocaleDateString('en-GB')}`
      )
      .join('\n')
    const message = `🔔 <b>OutlanderOS Reminders</b>\n\n${lines}\n\n— OutlanderOS`
    setSending(true)
    try {
      const res = await fetch('/api/telegram/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      })
      const data = await res.json()
      setToast(data.ok ? 'Sent to Quinn via Telegram ✓' : 'Failed to send. Check Telegram config.')
    } catch {
      setToast('Network error — could not send.')
    } finally {
      setSending(false)
      setTimeout(() => setToast(null), 4000)
    }
  }

  async function runCrossRef() {
    setScanning(true)
    setToast('Running cross-reference scan…')
    try {
      const res = await fetch('/api/dashboard?crossref=true')
      const data = await res.json()
      if (data.crossReference?.length) {
        const crossEntries: LogEntry[] = data.crossReference.map((status: any) => ({
          timestamp: new Date().toISOString(),
          type: 'CROSSREF' as const,
          client: status.client,
          message: status.flags?.length
            ? status.flags[0]
            : `No discrepancies found`,
          flags: status.flags,
        }))
        setLogEntries((prev) => [...crossEntries, ...prev])
        setReminders(generateReminders(data))
        setToast(`Cross-ref complete — ${data.crossReference.length} clients scanned`)
      } else {
        setToast('Cross-ref complete — no deals found')
      }
    } catch {
      setToast('Cross-reference scan failed')
    } finally {
      setScanning(false)
      setTimeout(() => setToast(null), 5000)
    }
  }

  async function sendBriefing() {
    setSendingBriefing(true)
    try {
      const res = await fetch('/api/briefing')
      const data = await res.json()
      setToast(data.sent ? 'Morning briefing sent to Quinn via Telegram ✓' : 'Failed to send briefing')
    } catch {
      setToast('Network error — could not send briefing')
    } finally {
      setSendingBriefing(false)
      setTimeout(() => setToast(null), 4000)
    }
  }

  return (
    <div className="flex h-full min-h-0 gap-0 overflow-hidden">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg bg-gray-900 px-4 py-3 text-sm text-white shadow-xl">
          {toast}
        </div>
      )}

      {/* LEFT: Terminal log (65%) */}
      <div className="flex h-full w-[65%] flex-col bg-gray-900 font-mono text-sm">
        {/* Terminal header */}
        <div className="flex items-center gap-2 border-b border-gray-700 px-4 py-3">
          <div className="h-3 w-3 rounded-full bg-red-500" />
          <div className="h-3 w-3 rounded-full bg-yellow-500" />
          <div className="h-3 w-3 rounded-full bg-green-500" />
          <span className="ml-4 text-xs uppercase tracking-widest text-gray-400 flex-1">
            ACTIVITY LOG
            <span className={blink ? 'opacity-100' : 'opacity-0'}>{' █'}</span>
          </span>
          <button
            onClick={runCrossRef}
            disabled={scanning || loading}
            className="rounded px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-purple-300 border border-purple-700 hover:bg-purple-900/40 disabled:opacity-40 transition-colors"
          >
            {scanning ? 'Scanning…' : 'Cross-Reference Scan'}
          </button>
        </div>

        {/* Log lines */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          {loading ? (
            <div className="text-green-400">
              {'> '}
              <span className={blink ? 'opacity-100' : 'opacity-0'}>loading data...</span>
            </div>
          ) : (
            logEntries.map((entry, i) => {
              const key = `${entry.timestamp}-${i}`
              const isExpanded = expandedId === key
              return (
                <div key={key}>
                  <button
                    className="w-full text-left hover:bg-gray-800 rounded px-1 py-0.5 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : key)}
                  >
                    <span className="text-gray-500">[{formatTimestamp(entry.timestamp)}]</span>{' '}
                    <span className={`font-bold ${TYPE_COLORS[entry.type]}`}>
                      [{entry.type}]
                    </span>{' '}
                    <span className="text-gray-300">{entry.client}</span>
                    <span className="text-gray-500"> — </span>
                    <span className="text-gray-200">{entry.message}</span>
                  </button>
                  {isExpanded && (
                    <div className="ml-4 mt-1 mb-2 rounded bg-gray-800 px-3 py-2 text-xs text-gray-300 space-y-1">
                      <div><span className="text-gray-500">timestamp:</span> {entry.timestamp}</div>
                      <div><span className="text-gray-500">type:</span> {entry.type}</div>
                      <div><span className="text-gray-500">client:</span> {entry.client}</div>
                      <div><span className="text-gray-500">message:</span> {entry.message}</div>
                      {entry.amount != null && (
                        <div><span className="text-gray-500">amount:</span> £{entry.amount.toLocaleString()}</div>
                      )}
                      {entry.flags && entry.flags.length > 1 && (
                        <div className="mt-1 space-y-0.5">
                          <span className="text-gray-500">all flags:</span>
                          {entry.flags.map((flag, fi) => (
                            <div key={fi} className="ml-2 text-purple-300">
                              {flag.includes('✓') ? '✓' : '⚠'} {flag}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* RIGHT: Reminders panel (35%) */}
      <div className="flex h-full w-[35%] flex-col border-l border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Reminders</h2>
            <p className="text-xs text-gray-500">{reminders.filter((r) => !r.done).length} active</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={sendBriefing}
              disabled={sendingBriefing}
              className="rounded-md bg-gray-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-900 disabled:opacity-60 transition-colors"
            >
              {sendingBriefing ? 'Sending…' : 'Send Briefing'}
            </button>
            <button
              onClick={sendToQuinn}
              disabled={sending}
              className="rounded-md bg-[#D4A853] px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-600 disabled:opacity-60 transition-colors"
            >
              {sending ? 'Sending…' : 'Send to Quinn'}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <p className="text-sm text-gray-400">Loading reminders…</p>
          ) : reminders.length === 0 ? (
            <p className="text-sm text-gray-400">No reminders.</p>
          ) : (
            reminders.map((r) => (
              <div
                key={r.id}
                className={`flex items-start gap-3 rounded-lg border p-3 transition-all ${
                  r.done
                    ? 'border-gray-100 bg-gray-50 opacity-50'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <input
                  type="checkbox"
                  checked={r.done}
                  onChange={() => toggleDone(r.id)}
                  className="mt-0.5 h-4 w-4 cursor-pointer accent-amber-500"
                />
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm font-medium leading-snug ${
                      r.done ? 'line-through text-gray-400' : 'text-gray-800'
                    }`}
                  >
                    {r.title}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-gray-400">
                      {new Date(r.dueDate).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${PRIORITY_COLORS[r.priority]}`}
                    >
                      {r.priority}
                    </span>
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">
                      {r.category}
                    </span>
                    {r.emailActivity === true && (
                      <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                        Activity detected
                      </span>
                    )}
                    {r.emailActivity === false && (
                      <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-600">
                        No recent contact
                      </span>
                    )}
                  </div>
                  {r.status && (
                    <p className="mt-1 text-[11px] italic text-gray-500">{r.status}</p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
