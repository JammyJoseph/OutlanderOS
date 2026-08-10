import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withAuth, type AuthUser } from '@/lib/auth'
import { isSmartTipId } from '@/lib/smart-tips'

// Smart-tip dismissals for the signed-in user. GET returns the ids they've
// dismissed; POST marks one dismissed. Stored on the User row so "got it"
// follows them across browsers and devices.

export const GET = withAuth(async (_request: NextRequest, _ctx, user: AuthUser) => {
  try {
    const row = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { seenTips: true },
    })
    const dismissed = Array.isArray(row?.seenTips) ? (row.seenTips as string[]) : []
    return NextResponse.json({ dismissed })
  } catch (err) {
    console.error('GET /api/me/tips', err)
    // Failing open (no dismissals) means at worst a tip re-appears. Failing the
    // page over a tips lookup would be backwards.
    return NextResponse.json({ dismissed: [] })
  }
})

export const POST = withAuth(async (request: NextRequest, _ctx, user: AuthUser) => {
  try {
    const body = await request.json().catch(() => ({}) as Record<string, unknown>)
    const id = String(body.id ?? '')
    // Validated against the registry so a typo'd id fails loudly here rather
    // than silently accumulating junk on the user row.
    if (!isSmartTipId(id)) {
      return NextResponse.json({ error: `Unknown tip id "${id}".` }, { status: 400 })
    }

    const row = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { seenTips: true },
    })
    const dismissed = Array.isArray(row?.seenTips) ? (row.seenTips as string[]) : []
    if (!dismissed.includes(id)) {
      await prisma.user.update({
        where: { id: user.userId },
        data: { seenTips: [...dismissed, id] },
      })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('POST /api/me/tips', err)
    return NextResponse.json({ error: 'Could not save that.' }, { status: 500 })
  }
})
