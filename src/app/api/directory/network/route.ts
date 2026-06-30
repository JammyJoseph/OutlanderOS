import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { withAuth } from "@/lib/auth"
import type { CollaborationLink } from "@/lib/scan-contacts"

// GET /api/directory/network
// Returns every contact that has at least one recorded collaboration, with the
// linked contacts' names resolved where possible — the data behind the Network tab.
export const GET = withAuth(async () => {
  const contacts = await prisma.contact.findMany({
    where: { isRadar: false },
    select: {
      id: true,
      name: true,
      category: true,
      instagram: true,
      confidence: true,
      source: true,
      collaborations: true,
    },
    orderBy: { name: "asc" },
  })

  const nameById = new Map(contacts.map((c) => [c.id, c.name]))

  const nodes = contacts
    .map((c) => {
      const links: CollaborationLink[] = Array.isArray(c.collaborations)
        ? (c.collaborations as unknown as CollaborationLink[])
        : []
      const collaborations = links
        .filter((l) => l && typeof l.handle === "string")
        .map((l) => ({
          handle: l.handle,
          count: l.count || 0,
          role: l.role ?? null,
          contactId: l.contactId ?? null,
          contactName: l.contactId ? nameById.get(l.contactId) ?? null : null,
        }))
        .sort((a, b) => b.count - a.count)
      return {
        id: c.id,
        name: c.name,
        category: c.category,
        instagram: c.instagram,
        confidence: c.confidence,
        source: c.source,
        collaborations,
      }
    })
    .filter((n) => n.collaborations.length > 0)
    .sort((a, b) => b.collaborations.length - a.collaborations.length)

  return NextResponse.json({ nodes, total: nodes.length })
})
