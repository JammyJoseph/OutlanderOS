import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET() {
  const reports = await prisma.trendReport.findMany({
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(reports)
}
