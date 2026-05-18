import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { withAuth } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

function isoWeek(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

export const POST = withAuth(async (request: NextRequest) => {
  const body = await request.json().catch(() => ({}))
  const type: 'weekly' | 'monthly' | 'brand_pitch' | 'custom' = body.type || 'weekly'
  const brandId: string | undefined = body.brandId

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not configured' }, { status: 503 })
  }

  // Resolve the brand first so a brand pitch can pull brand-relevant signals.
  let brand: { name: string; category: string | null; keywords: string[]; description: string | null } | null = null
  if (type === 'brand_pitch' && brandId) {
    const b = await prisma.brandWatch.findUnique({ where: { id: brandId } })
    if (!b) return NextResponse.json({ error: 'Brand not found' }, { status: 404 })
    brand = { name: b.name, category: b.category, keywords: b.keywords, description: b.description }
  }

  // Pull signal data
  const since = new Date()
  if (type === 'monthly' || type === 'brand_pitch') since.setDate(since.getDate() - 30)
  else since.setDate(since.getDate() - 7)

  let signals: Awaited<ReturnType<typeof prisma.trendSignal.findMany>>
  if (type === 'brand_pitch' && brand) {
    // Brand pitch: prioritise signals that match the brand's keywords,
    // name, or category so the brief is grounded in relevant trends.
    const terms = [brand.name, ...(brand.keywords ?? [])]
      .map((t) => t.trim())
      .filter(Boolean)
    const orFilters: Prisma.TrendSignalWhereInput[] = terms.flatMap((t) => [
      { title: { contains: t, mode: 'insensitive' } },
      { summary: { contains: t, mode: 'insensitive' } },
      { tags: { has: t } },
    ])
    if (brand.category) {
      orFilters.push({ category: { contains: brand.category, mode: 'insensitive' } })
    }
    const relevant = orFilters.length
      ? await prisma.trendSignal.findMany({
          where: { createdAt: { gte: since }, OR: orFilters },
          orderBy: [{ relevance: 'desc' }, { createdAt: 'desc' }],
          take: 60,
        })
      : []
    if (relevant.length >= 5) {
      signals = relevant
    } else {
      // Not enough brand-specific signals — top up with recent high-relevance ones.
      const seen = new Set(relevant.map((s) => s.id))
      const topUp = await prisma.trendSignal.findMany({
        where: { createdAt: { gte: since }, id: { notIn: relevant.map((s) => s.id) } },
        orderBy: [{ relevance: 'desc' }, { createdAt: 'desc' }],
        take: 60 - relevant.length,
      })
      signals = [...relevant, ...topUp.filter((s) => !seen.has(s.id))]
    }
  } else {
    signals = await prisma.trendSignal.findMany({
      where: { createdAt: { gte: since } },
      orderBy: [{ relevance: 'desc' }, { createdAt: 'desc' }],
      take: 80,
    })
  }

  const signalContext = signals
    .map(
      (s) =>
        `- [${s.category}] ${s.title}${s.summary ? ` — ${s.summary.slice(0, 200)}` : ''}${s.sourceUrl ? ` (${s.sourceUrl})` : ''}`,
    )
    .join('\n')

  const period = type === 'monthly' ? new Date().toISOString().slice(0, 7) : isoWeek(new Date())

  let userPrompt: string
  let title: string
  if (type === 'brand_pitch' && brand) {
    title = `Brand Pitch: ${brand.name}`
    userPrompt = `Generate a brand pitch brief for ${brand.name}${brand.category ? ` (${brand.category})` : ''} based on the cultural signals below.

Brand keywords: ${brand.keywords.join(', ') || 'none'}
${brand.description ? `Brand description: ${brand.description}` : ''}

Recent cultural signals:
${signalContext || '(no signals available)'}

Write a sharp, opinionated pitch in markdown with these sections:
## Cultural Moment
## Why ${brand.name}, Why Now
## Outlander Angle
## Concept Directions (3 ideas)
## Suggested Deliverables
## Risks / Considerations

Keep it tight and editorial. Reference specific signals where useful.`
  } else if (type === 'monthly') {
    title = `Monthly Trend Report — ${period}`
    userPrompt = `Generate a monthly cultural intelligence report for Outlander Magazine covering ${period}.

Signals from the last 30 days:
${signalContext || '(no signals available)'}

Write in markdown with:
## Executive Summary
## Macro Themes (3-5)
## Movements in Fashion / Luxury
## Movements in Culture / Art / Music
## Brands to Watch
## What This Means for Outlander

Be punchy, editorial, and specific. Cite signals.`
  } else if (type === 'weekly') {
    title = `Weekly Trend Radar — ${period}`
    userPrompt = `Generate a weekly cultural intelligence digest for Outlander Magazine covering ${period}.

Signals from the last 7 days:
${signalContext || '(no signals available)'}

Write in markdown with:
## This Week's Pulse
## Top Signals
## Emerging Themes
## Worth a Pitch
## Notes

Keep it scannable and editorial.`
  } else {
    title = body.title || 'Custom Report'
    userPrompt = (typeof body.prompt === 'string' && body.prompt) || `Synthesize the following cultural signals into an editorial brief.\n\n${signalContext}`
  }

  const client = new Anthropic({ apiKey })

  let content = ''
  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 2048,
      system:
        'You are the Outlander Think Tank — a cultural intelligence engine for Outlander Magazine, a UK fashion and culture publication. Your tone is sharp, editorial, and decisive. Always write in markdown.',
      messages: [{ role: 'user', content: userPrompt }],
    })
    const block = response.content.find((b) => b.type === 'text')
    content = block && 'text' in block ? block.text : ''
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'AI generation failed' },
      { status: 502 },
    )
  }

  if (!content) {
    return NextResponse.json({ error: 'Empty response from model' }, { status: 502 })
  }

  const report = await prisma.trendReport.create({
    data: {
      title,
      type,
      content,
      period: type === 'brand_pitch' ? null : period,
      brandId: brandId || null,
      generatedBy: 'ai',
    },
  })

  return NextResponse.json(report, { status: 201 })
})
