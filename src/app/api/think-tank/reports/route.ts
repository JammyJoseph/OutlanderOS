import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withAuth } from '@/lib/auth'

export const GET = withAuth(async () => {
  const reports = await prisma.trendReport.findMany({
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(reports)
})
