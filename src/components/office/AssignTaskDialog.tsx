"use client"

import { useState } from 'react'
import { X, Zap } from 'lucide-react'
import { AGENT_FLEET } from '@/lib/agents'

interface AssignTaskDialogProps {
  defaultTo?: string
  onClose: () => void
  onAssign: (task: { toAgentId: string; description: string; priority: string }) => void
}

const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent']

export function AssignTaskDialog({ defaultTo, onClose, onAssign }: AssignTaskDialogProps) {
  const [toAgentId, setToAgentId] = useState(defaultTo ?? AGENT_FLEET[1].id)
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('Medium')

  const toAgent = AGENT_FLEET.find((a) => a.id === toAgentId)

  const handleAssign = () => {
    if (!description.trim()) return
    onAssign({ toAgentId, description, priority })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-neutral-800 bg-neutral-950 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 px-5 py-4">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-[#D4A853]" />
            <h2 className="text-sm font-semibold text-white">Assign Task</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-neutral-500 hover:bg-neutral-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {/* From — always Operations */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-neutral-400">From</label>
            <div className="flex items-center gap-2 rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2">
              <div className="h-2 w-2 rounded-full bg-[#D4A853]" />
              <span className="text-sm text-white">Operations</span>
              <span className="ml-auto text-xs text-neutral-500">CEO Agent</span>
            </div>
          </div>

          {/* To */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-neutral-400">To Agent</label>
            <select
              className="w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-white outline-none focus:border-neutral-600"
              value={toAgentId}
              onChange={(e) => setToAgentId(e.target.value)}
            >
              {AGENT_FLEET.filter((a) => a.id !== 'operations').map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name} — {agent.role}
                </option>
              ))}
            </select>
            {toAgent && (
              <p className="mt-1 text-xs text-neutral-500">{toAgent.description}</p>
            )}
          </div>

          {/* Task description */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-neutral-400">
              Task Description
            </label>
            <textarea
              className="w-full resize-none rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-white outline-none placeholder:text-neutral-600 focus:border-neutral-600"
              rows={3}
              placeholder="Describe what the agent should do…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Priority */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-neutral-400">Priority</label>
            <div className="flex gap-2">
              {PRIORITIES.map((p) => (
                <button
                  key={p}
                  onClick={() => setPriority(p)}
                  className="flex-1 rounded-md border py-1.5 text-xs font-medium transition-colors"
                  style={
                    priority === p
                      ? {
                          borderColor: p === 'Urgent' ? '#F87171' : p === 'High' ? '#D4A853' : '#4ADE80',
                          backgroundColor: (p === 'Urgent' ? '#F87171' : p === 'High' ? '#D4A853' : '#4ADE80') + '22',
                          color: p === 'Urgent' ? '#F87171' : p === 'High' ? '#D4A853' : p === 'Medium' ? '#4ADE80' : '#9ca3af',
                        }
                      : { borderColor: '#262626', color: '#6b7280' }
                  }
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-neutral-800 px-5 py-4">
          <button
            onClick={onClose}
            className="rounded-md px-4 py-2 text-sm text-neutral-400 hover:bg-neutral-800 hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleAssign}
            disabled={!description.trim()}
            className="flex items-center gap-2 rounded-md bg-[#D4A853] px-4 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <Zap className="h-3.5 w-3.5" />
            Assign Task
          </button>
        </div>
      </div>
    </div>
  )
}
