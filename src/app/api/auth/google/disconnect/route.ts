import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withAuth } from '@/lib/auth'

// Clears all Google token fields on the signed-in user's record.
export const POST = withAuth(async (_request: NextRequest, _ctx, user) => {
  await prisma.user.update({
    where: { id: user.userId },
    data: {
      googleAccessToken: null,
      googleRefreshToken: null,
      googleTokenExpiry: null,
      googleEmail: null,
      googleConnected: false,
    },
  })

  return NextResponse.json({ success: true })
})
