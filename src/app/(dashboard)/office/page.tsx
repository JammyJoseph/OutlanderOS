"use client"

import dynamic from 'next/dynamic'
import { Building2, Circle } from 'lucide-react'
import { GroupChat } from '@/components/office/GroupChat'
import { useAgentStore } from '@/lib/agent-store'

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
  const { agents, selectedAgentId, setSelectedAgent } = useAgentStore()

  const activeCount = agents.filter((a) => a.status === 'active').length
  const thinkingCount = agents.filter((a) => a.status === 'thinking').length
  const idleCount = agents.filter((a) => a.status === 'idle').length

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      {/* Top bar — light theme */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-5">
        <div className="flex items-center gap-3">
          <Building2 className="h-4 w-4 text-[#D4A853]" />
          <h1 className="text-sm font-semibold text-gray-900">Outlander HQ</h1>
          <span className="text-gray-300">·</span>
          <span className="text-xs text-gray-500">{agents.length} agents deployed</span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Circle className="h-2 w-2 fill-green-500 text-green-500" />
              <span className="text-xs text-gray-600">{activeCount} active</span>
            </div>
            {thinkingCount > 0 && (
              <div className="flex items-center gap-1.5">
                <Circle className="h-2 w-2 fill-[#D4A853] text-[#D4A853]" />
                <span className="text-xs text-gray-600">{thinkingCount} thinking</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Circle className="h-2 w-2 fill-gray-400 text-gray-400" />
              <span className="text-xs text-gray-600">{idleCount} idle</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main content — split layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT: 3D Scene (60%) — stays dark */}
        <div className="relative" style={{ flex: '0 0 62%' }}>
          <OfficeScene
            selectedAgentId={selectedAgentId}
            onSelectAgent={(id) => setSelectedAgent(id)}
          />

          {!selectedAgentId && (
            <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-gray-200 bg-white/80 px-4 py-1.5 backdrop-blur-sm">
              <span className="text-xs text-gray-500">Click a desk to inspect · Drag to pan · Scroll to zoom</span>
            </div>
          )}
        </div>

        {/* RIGHT: Group Chat (38%) */}
        <div className="flex-1" style={{ borderLeft: '1px solid #e5e7eb' }}>
          <GroupChat selectedAgentId={selectedAgentId} />
        </div>
      </div>
    </div>
  )
}
