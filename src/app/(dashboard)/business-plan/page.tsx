'use client'

import { ExternalLink, FileText } from 'lucide-react'

const GOOGLE_DOC_ID = '1T9u6Cbr-3vSbWbyGVfv1yNJakV6RK0Bo'
const GOOGLE_DOC_URL = 'https://docs.google.com/document/d/1T9u6Cbr-3vSbWbyGVfv1yNJakV6RK0Bo/edit?usp=sharing&ouid=112799059606301820333&rtpof=true&sd=true'
const EMBED_URL = `https://docs.google.com/document/d/${GOOGLE_DOC_ID}/preview`

export default function BusinessPlanPage() {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <FileText size={20} className="text-[#D4A853]" />
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Business Plan</h1>
            <p className="text-xs text-gray-500">Outlander Magazine — Strategic Plan</p>
          </div>
        </div>
        <a
          href={GOOGLE_DOC_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2 bg-[#D4A853] text-zinc-900 text-sm font-medium hover:bg-[#C49843] transition-colors"
        >
          <ExternalLink size={14} />
          Open in Google Docs
        </a>
      </div>

      {/* Embedded Document */}
      <div className="flex-1 bg-gray-50">
        <iframe
          src={EMBED_URL}
          className="w-full h-full border-0"
          title="Outlander Business Plan"
          allow="autoplay"
        />
      </div>
    </div>
  )
}
