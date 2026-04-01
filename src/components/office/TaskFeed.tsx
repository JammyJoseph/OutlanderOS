"use client"

import { useEffect, useRef } from 'react'
import { AGENT_FLEET, MOCK_ACTIVITY } from '@/lib/agents'

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

export function TaskFeed() {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth
    }
  }, [])

  return (
    <div className="border-t border-neutral-800 bg-neutral-950 px-4 py-2">
      <div className="mb-1.5 flex items-center gap-2">
        <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
        <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Live Activity
        </span>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide"
        style={{ scrollbarWidth: 'none' }}
      >
        {MOCK_ACTIVITY.map((event) => {
          const agent = AGENT_FLEET.find((a) => a.id === event.agentId)
          if (!agent) return null

          return (
            <div
              key={event.id}
              className="flex shrink-0 items-center gap-2.5 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2"
            >
              {/* Agent dot */}
              <div
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: agent.color }}
              />

              {/* Agent name */}
              <span
                className="shrink-0 text-xs font-semibold"
                style={{ color: agent.color }}
              >
                {agent.name}
              </span>

              {/* Action */}
              <span className="whitespace-nowrap text-xs text-neutral-400">
                {event.action}
              </span>

              {/* Timestamp */}
              <span className="shrink-0 text-xs text-neutral-600">
                {formatTime(event.timestamp)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
