import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { financePosition } from '@/lib/finance-figures'

// The company's money position, every figure labelled with where it came from.
//
// Separate from /api/finance/overview rather than replacing it: overview serves
// the existing nine tabs and changing its shape would touch all of them. This is
// the shape the portal is moving towards, and the dashboard reads it first.
export const GET = withAuth(async () => {
  return NextResponse.json(await financePosition())
})
