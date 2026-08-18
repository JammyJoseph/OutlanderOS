import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withAuth, type AuthUser } from '@/lib/auth'
import { trackForRole, trackById } from '@/lib/production-workflows'

// Per-person production workflows. The templates live in code; this route only
// moves progress:
//
//   GET  → people + their step progress + the context the templates render with
//   POST {action:"add", name, role?, email?}      → one person, track from role
//   POST {action:"import"}                        → pull the production's crew
//                                                    and latest call sheet roster
//   POST {action:"toggle", id, stepId}            → mark a step done / undone
//   POST {action:"update", id, ...} / {action:"delete", id}

interface StepDone {
  id: string
  doneAt: string
  by: string
}

const parseSteps = (v: unknown): StepDone[] => (Array.isArray(v) ? (v as StepDone[]) : [])

export const GET = withAuth(async (
  _request: NextRequest,
  { params }: { params?: Promise<Record<string, string>> }
) => {
  const { id } = (await params)!
  try {
    const production = await prisma.production.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        clientName: true,
        shootDates: true,
        campaign: { select: { client: { select: { name: true } } } },
        lead: { select: { name: true } },
        workflows: { orderBy: { createdAt: 'asc' } },
        callSheets: {
          orderBy: { shootDate: 'desc' },
          take: 1,
          where: { status: 'PUBLISHED' },
          select: { shareToken: true, locations: true, location: true },
        },
      },
    })
    if (!production) return NextResponse.json({ error: 'Production not found' }, { status: 404 })

    const sheet = production.callSheets[0]
    const firstLocation = (() => {
      const list = sheet?.locations as { name?: string; address?: string }[] | undefined
      const l = Array.isArray(list) && list.length > 0 ? list[0] : null
      const legacy = sheet?.location as { address?: string } | null
      return l?.address || l?.name || legacy?.address || null
    })()

    const dates = (production.shootDates ?? [])
      .map((d) => new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }))
      .join(', ')

    return NextResponse.json({
      // Everything the email templates can be filled from. Assembled here so
      // the client never guesses at data it doesn't have.
      context: {
        productionTitle: production.title,
        clientName: production.clientName || production.campaign?.client?.name || null,
        shootDates: dates || null,
        producerName: production.lead?.name ?? null,
        callSheetLink: sheet?.shareToken
          ? `${process.env.NEXTAUTH_URL || ''}/call-sheet/${sheet.shareToken}`
          : null,
        unitBase: firstLocation,
      },
      people: production.workflows.map((w) => ({
        id: w.id,
        name: w.name,
        role: w.role,
        email: w.email,
        track: w.track,
        notes: w.notes,
        steps: parseSteps(w.steps),
      })),
    })
  } catch (err) {
    console.error('GET /api/productions/[id]/workflows', err)
    return NextResponse.json({ error: 'Failed to load workflows' }, { status: 500 })
  }
})

export const POST = withAuth(async (
  request: NextRequest,
  { params }: { params?: Promise<Record<string, string>> },
  user: AuthUser
) => {
  const { id } = (await params)!
  try {
    const body = await request.json().catch(() => ({}) as Record<string, unknown>)
    const action = String(body.action ?? '')

    if (action === 'add') {
      const name = String(body.name ?? '').trim()
      if (!name) return NextResponse.json({ error: 'A name is required.' }, { status: 400 })
      const role = String(body.role ?? '').trim() || null
      const row = await prisma.productionWorkflow.create({
        data: {
          productionId: id,
          name,
          role,
          email: String(body.email ?? '').trim() || null,
          // The role picks the conversation; an explicit track wins.
          track: trackById(String(body.track ?? '') || trackForRole(role)).id,
        },
      })
      return NextResponse.json({ ok: true, id: row.id })
    }

    if (action === 'import') {
      // Pull everyone already attached to the production: the crew table and
      // the latest call sheet roster. Existing workflow rows match by name.
      const production = await prisma.production.findUnique({
        where: { id },
        select: {
          crew: { select: { role: true, contact: { select: { id: true, name: true, email: true } } } },
          callSheets: {
            orderBy: { shootDate: 'desc' },
            take: 1,
            select: { crew: true, talent: true },
          },
          workflows: { select: { name: true } },
        },
      })
      if (!production) return NextResponse.json({ error: 'Production not found' }, { status: 404 })

      const have = new Set(production.workflows.map((w) => w.name.trim().toLowerCase()))
      type Person = { name: string; role: string | null; email: string | null; contactId: string | null }
      const candidates: Person[] = []

      for (const c of production.crew) {
        candidates.push({
          name: c.contact.name,
          role: c.role || null,
          email: c.contact.email,
          contactId: c.contact.id,
        })
      }
      const sheet = production.callSheets[0]
      const rosterRows = [
        ...((sheet?.crew as { name?: string; role?: string; email?: string }[] | null) ?? []),
        ...((sheet?.talent as { name?: string; role?: string; email?: string }[] | null) ?? []),
      ]
      for (const r of rosterRows) {
        if (r?.name?.trim()) {
          candidates.push({ name: r.name.trim(), role: r.role || null, email: r.email || null, contactId: null })
        }
      }

      let created = 0
      for (const c of candidates) {
        const key = c.name.trim().toLowerCase()
        if (!key || have.has(key)) continue
        have.add(key)
        await prisma.productionWorkflow.create({
          data: {
            productionId: id,
            name: c.name.trim(),
            role: c.role,
            email: c.email,
            contactId: c.contactId,
            track: trackForRole(c.role),
          },
        })
        created++
      }
      return NextResponse.json({ ok: true, created })
    }

    if (action === 'toggle') {
      const rowId = String(body.id ?? '')
      const stepId = String(body.stepId ?? '')
      const row = await prisma.productionWorkflow.findUnique({ where: { id: rowId } })
      if (!row || row.productionId !== id) {
        return NextResponse.json({ error: 'Not found.' }, { status: 404 })
      }
      const track = trackById(row.track)
      if (!track.steps.some((st) => st.id === stepId)) {
        return NextResponse.json({ error: `Unknown step "${stepId}" for this track.` }, { status: 400 })
      }
      const steps = parseSteps(row.steps)
      const next = steps.some((st) => st.id === stepId)
        ? steps.filter((st) => st.id !== stepId)
        : [...steps, { id: stepId, doneAt: new Date().toISOString(), by: user.name || user.email }]
      await prisma.productionWorkflow.update({
        where: { id: rowId },
        data: { steps: next as unknown as object[] },
      })
      return NextResponse.json({ ok: true })
    }

    if (action === 'update') {
      const rowId = String(body.id ?? '')
      const row = await prisma.productionWorkflow.findUnique({ where: { id: rowId } })
      if (!row || row.productionId !== id) return NextResponse.json({ error: 'Not found.' }, { status: 404 })
      const data: Record<string, unknown> = {}
      if (body.name !== undefined) data.name = String(body.name).trim()
      if (body.role !== undefined) data.role = String(body.role).trim() || null
      if (body.email !== undefined) data.email = String(body.email).trim() || null
      if (body.track !== undefined) data.track = trackById(String(body.track)).id
      if (body.notes !== undefined) data.notes = String(body.notes).slice(0, 4000) || null
      await prisma.productionWorkflow.update({ where: { id: rowId }, data })
      return NextResponse.json({ ok: true })
    }

    if (action === 'delete') {
      const rowId = String(body.id ?? '')
      const row = await prisma.productionWorkflow.findUnique({ where: { id: rowId } })
      if (!row || row.productionId !== id) return NextResponse.json({ error: 'Not found.' }, { status: 404 })
      await prisma.productionWorkflow.delete({ where: { id: rowId } })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
  } catch (err) {
    console.error('POST /api/productions/[id]/workflows', err)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
})
