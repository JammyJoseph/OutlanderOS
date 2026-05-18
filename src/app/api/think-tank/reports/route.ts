import { withErrorHandling } from "@/lib/api-error"
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withAuth } from '@/lib/auth'

const GET__h = withAuth(async () => {
  const reports = await prisma.trendReport.findMany({
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(reports)
})

export const GET = withErrorHandling(GET__h as any)
