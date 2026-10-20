'use client'

import { ExternalLink } from "lucide-react"

const DOCS = [
  {
    label: 'Business Plan (Current)',
    id: '1Z9-_sra4xR2XWGNlsSkPnTVQ8cm-RFawNE7aI_V00Ps',
    url: 'https://docs.google.com/document/d/1Z9-_sra4xR2XWGNlsSkPnTVQ8cm-RFawNE7aI_V00Ps/edit?usp=sharing',
  },
  {
    label: 'Business Plan (Original)',
    id: '1T9u6Cbr-3vSbWbyGVfv1yNJakV6RK0Bo',
    url: 'https://docs.google.com/document/d/1T9u6Cbr-3vSbWbyGVfv1yNJakV6RK0Bo/edit?usp=sharing&ouid=112799059606301820333&rtpof=true&sd=true',
  },
]

import { useState } from 'react'

export default function BusinessPlanPage() {
  const [activeDoc, setActiveDoc] = useState(0)
  const doc = DOCS[activeDoc]
  const embedUrl = `https://docs.google.com/document/d/${doc.id}/preview`

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 px-4 pb-4 pt-6 sm:px-8 lg:px-12">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-[28px] font-semibold leading-[1.1] tracking-[-0.015em] sm:text-4xl">Business Plan</h1>
            <p className="mt-1.5 text-base text-muted-foreground">Outlander Magazine — Strategic Plan</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Doc switcher */}
          {DOCS.map((d, i) => (
            <button
              key={d.id}
              onClick={() => setActiveDoc(i)}
              className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
 activeDoc === i
 ? 'bg-primary text-primary-foreground '
 : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
 }`}
            >
              {d.label}
            </button>
          ))}
          <a
            href={doc.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-1.5 bg-primary text-primary-foreground text-xs font-medium hover:brightness-[0.97] transition-colors ml-2"
          >
            <ExternalLink size={12} />
            Open in Google Docs
          </a>
        </div>
      </div>

      {/* Embedded Document */}
      <div className="flex-1 bg-gray-50 dark:bg-gray-800">
        <iframe
          src={embedUrl}
          className="w-full h-full border-0"
          title={doc.label}
          allow="autoplay"
        />
      </div>
    </div>
  )
}
