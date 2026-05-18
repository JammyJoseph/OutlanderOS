import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withAuth } from '@/lib/auth'
import { sanitizeString, validateEmail } from '@/lib/validate'

export const GET = withAuth(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params
  const contact = await prisma.contact.findUnique({ where: { id } })
  if (!contact) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(contact)
})

export const PUT = withAuth(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params
  const body = await request.json()

  if (body.email && !validateEmail(body.email)) {
    return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
  }

  const contact = await prisma.contact.update({
    where: { id },
    data: {
      name: body.name !== undefined ? sanitizeString(body.name, 200) : undefined,
      email: body.email,
      phone: body.phone,
      company: body.company,
      role: body.role,
      category: body.category,
      tags: body.tags,
      instagram: body.instagram,
      website: body.website,
      notes: body.notes !== undefined ? sanitizeString(body.notes, 4000) : undefined,
      lastInteraction: body.lastInteraction ? new Date(body.lastInteraction) : undefined,
    },
  })
  return NextResponse.json(contact)
})

export const DELETE = withAuth(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params
  await prisma.contact.delete({ where: { id } })
  return NextResponse.json({ success: true })
})
