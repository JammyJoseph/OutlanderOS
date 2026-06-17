import { NextResponse } from "next/server";
import { withAuth, getUserTeams, isAdminInDb, canArchiveDeals } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/me/permissions — live role/team flags for the current user, used to
// gate team-restricted UI actions (e.g. archiving deals). Teams aren't baked
// into the JWT, so this reads them from the DB.
export const GET = withAuth(async (_request, _ctx, user) => {
  const [isAdmin, teams, archive] = await Promise.all([
    isAdminInDb(user),
    getUserTeams(user),
    canArchiveDeals(user),
  ]);
  return NextResponse.json({ isAdmin, teams, canArchiveDeals: archive });
});
