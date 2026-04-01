"use client"

import dynamic from 'next/dynamic'
import { useState } from 'react'
import { Building2, Circle, PanelRightClose, PanelRightOpen } from 'lucide-react'
import { AGENT_FLEET } from '@/lib/agents'
import { AgentPanel } from '@/components/office/AgentPanel'
import { TaskFeed } from '@/components/office/TaskFeed'
import { AssignTaskDialog } from '@/components/office/AssignTaskDialog'
import { cn } from '@/lib/utils'

const OfficeScene = dynamic(
  () => import('@/components/office/OfficeScene'),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-neutral-950">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-700 border-t-[#D4A853]" />
          <span className="text-xs text-neutral-500">Loading Agent Office…</span>
        </div>
      </div>
    ),
  }
)

export default function OfficePage() {
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const [panelOpen, setPanelOpen] = useState(true)
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)

  const selectedAgent = AGENT_FLEET.find((a) => a.id === selectedAgentId) ?? null

  const activeCount = AGENT_FLEET.filter((a) => a.status === 'active').length
  const thinkingCount = AGENT_FLEET.filter((a) => a.status === 'thinking').length
  const idleCount = AGENT_FLEET.filter((a) => a.status === 'idle').length

  return (
    <div className="flex h-screen flex-col bg-neutral-950">
      {/* Top bar */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-neutral-800 bg-neutral-950 px-5">
        <div className="flex items-center gap-3">
          <Building2 className="h-4 w-4 text-[#D4A853]" />
          <h1 className="text-sm font-semibold text-white">Agent Office</h1>
          <span className="text-neutral-700">·</span>
          <span className="text-xs text-neutral-500">{AGENT_FLEET.length} agents deployed</span>
        </div>

        <div className="flex items-center gap-4">
          {/* Status summary */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Circle className="h-2 w-2 fill-green-400 text-green-400" />
              <span className="text-xs text-neutral-400">{activeCount} active</span>
            </div>
            {thinkingCount > 0 && (
              <div className="flex items-center gap-1.5">
                <Circle className="h-2 w-2 fill-[#D4A853] text-[#D4A853]" />
                <span className="text-xs text-neutral-400">{thinkingCount} thinking</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Circle className="h-2 w-2 fill-neutral-600 text-neutral-600" />
              <span className="text-xs text-neutral-400">{idleCount} idle</span>
            </div>
          </div>

          {/* Agent pills */}
          <div className="flex items-center gap-1.5">
            {AGENT_FLEET.map((agent) => (
              <button
                key={agent.id}
                onClick={() => {
                  setSelectedAgentId(agent.id === selectedAgentId ? null : agent.id)
                  if (agent.id !== selectedAgentId) setPanelOpen(true)
                }}
                className={cn(
                  'rounded-full px-2.5 py-0.5 text-xs font-medium transition-all',
                  selectedAgentId === agent.id
                    ? 'opacity-100'
                    : 'opacity-50 hover:opacity-80'
                )}
                style={{
                  backgroundColor: agent.color + '22',
                  color: agent.color,
                  border: `1px solid ${selectedAgentId === agent.id ? agent.color + '88' : 'transparent'}`,
                }}
              >
                {agent.name}
              </button>
            ))}
          </div>

          {/* Panel toggle */}
          <button
            onClick={() => setPanelOpen(!panelOpen)}
            className="rounded p-1.5 text-neutral-500 transition-colors hover:bg-neutral-800 hover:text-white"
          >
            {panelOpen ? (
              <PanelRightClose className="h-4 w-4" />
            ) : (
              <PanelRightOpen className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* 3D Scene */}
        <div className="relative flex-1">
          <OfficeScene
            selectedAgentId={selectedAgentId}
            onSelectAgent={(id) => {
              setSelectedAgentId(id)
              if (id) setPanelOpen(true)
            }}
          />

          {/* Click hint */}
          {!selectedAgentId && (
            <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-neutral-800 bg-neutral-950/80 px-4 py-1.5 backdrop-blur-sm">
              <span className="text-xs text-neutral-500">Click an agent desk to inspect · Drag to orbit · Scroll to zoom</span>
            </div>
          )}
        </div>

        {/* Right panel */}
        {panelOpen && selectedAgent && (
          <AgentPanel
            agent={selectedAgent}
            onClose={() => setSelectedAgentId(null)}
            onAssignTask={() => setAssignDialogOpen(true)}
          />
        )}

        {/* Empty panel state */}
        {panelOpen && !selectedAgent && (
          <div className="flex w-72 flex-col items-center justify-center gap-3 border-l border-neutral-800 bg-neutral-950">
            <Building2 className="h-8 w-8 text-neutral-700" />
            <p className="text-center text-xs text-neutral-500 px-6">
              Click an agent desk in the 3D view to inspect their status and chat with them.
            </p>
          </div>
        )}
      </div>

      {/* Task feed */}
      <TaskFeed />

      {/* Assign task dialog */}
      {assignDialogOpen && (
        <AssignTaskDialog
          defaultTo={selectedAgent?.id !== 'operations' ? selectedAgent?.id : undefined}
          onClose={() => setAssignDialogOpen(false)}
          onAssign={(task) => {
            console.log('Task assigned:', task)
          }}
        />
      )}
    </div>
  )
}
