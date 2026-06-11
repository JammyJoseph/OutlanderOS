import prisma from "@/lib/prisma";
import type { AuthUser } from "@/lib/auth";

// Archiving replaces deletion across the platform. Archiving a deal cascades
// to its linked Production; the CampaignBudget is kept for historical finance
// records. Tasks stay in the database — list queries hide them while the
// parent deal/production is archived.

export async function archiveCampaign(id: string, user: AuthUser) {
  const deal = await prisma.campaign.findUnique({
    where: { id },
    select: { id: true, title: true, archived: true, production: { select: { id: true, title: true, archived: true } } },
  });
  if (!deal) return null;

  const now = new Date();
  if (deal.production && !deal.production.archived) {
    await prisma.production.update({
      where: { id: deal.production.id },
      data: { archived: true, archivedAt: now },
    });
  }

  const campaign = await prisma.campaign.update({
    where: { id },
    data: { archived: true, archivedAt: now },
    include: {
      client: { select: { id: true, name: true } },
      production: { select: { id: true, status: true, archived: true } },
    },
  });

  await prisma.dealActivity.create({
    data: {
      campaignId: id,
      type: "field_update",
      message: `"${deal.title}" archived${deal.production ? ` along with production "${deal.production.title}"` : ""}`,
      meta: { archived: true, productionId: deal.production?.id ?? null },
      userId: user.userId,
      userName: user.name,
    },
  });

  return campaign;
}

export async function unarchiveCampaign(id: string, user: AuthUser) {
  const deal = await prisma.campaign.findUnique({
    where: { id },
    select: { id: true, title: true, production: { select: { id: true, title: true, archived: true } } },
  });
  if (!deal) return null;

  if (deal.production?.archived) {
    await prisma.production.update({
      where: { id: deal.production.id },
      data: { archived: false, archivedAt: null },
    });
  }

  const campaign = await prisma.campaign.update({
    where: { id },
    data: { archived: false, archivedAt: null },
    include: {
      client: { select: { id: true, name: true } },
      production: { select: { id: true, status: true, archived: true } },
    },
  });

  await prisma.dealActivity.create({
    data: {
      campaignId: id,
      type: "field_update",
      message: `"${deal.title}" unarchived${deal.production ? ` along with production "${deal.production.title}"` : ""}`,
      meta: { archived: false, productionId: deal.production?.id ?? null },
      userId: user.userId,
      userName: user.name,
    },
  });

  return campaign;
}
