import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth"
import { normalizeHandle } from "@/lib/instagram-scan"
import {
  upsertScannedContact,
  mergeCollaborations,
  findContactByHandle,
  type ScannedContactInput,
} from "@/lib/scan-contacts"

interface CollabPair {
  a: string
  b: string
  count: number
}

// POST /api/directory/scan-import
// Body: {
//   contacts: ScannedContactInput[],          // one or many scanned profiles
//   collaborationPairs?: { a, b, count }[],    // co-mention links to record
// }
// Merges scanned contacts into the directory (tagging source=instagram_scan,
// never clobbering manual data) and records collaboration links between any
// two contacts that both exist in the directory.
export const POST = withAuth(async (request: NextRequest, _ctx, user) => {
  let body: { contacts?: unknown; collaborationPairs?: unknown } = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const rawContacts = Array.isArray(body.contacts) ? body.contacts : []
  const inputs: ScannedContactInput[] = rawContacts
    .map((c) => c as ScannedContactInput)
    .filter((c) => c && typeof c.handle === "string" && normalizeHandle(c.handle))

  if (inputs.length === 0) {
    return NextResponse.json({ error: "No valid contacts to import." }, { status: 400 })
  }

  const imported: { id: string; name: string; handle: string; created: boolean }[] = []
  const handleToId = new Map<string, string>()

  for (const input of inputs) {
    const norm = normalizeHandle(input.handle)!
    const { contact, created } = await upsertScannedContact(input, user.userId)
    handleToId.set(norm, contact.id)
    imported.push({ id: contact.id, name: contact.name, handle: norm, created })
  }

  // Record collaborations. For each pair, both sides must resolve to a contact
  // in the directory (either just imported, or already present by handle).
  const pairs: CollabPair[] = Array.isArray(body.collaborationPairs)
    ? (body.collaborationPairs as CollabPair[]).filter(
        (p) => p && typeof p.a === "string" && typeof p.b === "string"
      )
    : []

  const resolveId = async (handle: string): Promise<string | null> => {
    const norm = normalizeHandle(handle)
    if (!norm) return null
    if (handleToId.has(norm)) return handleToId.get(norm)!
    const existing = await findContactByHandle(norm)
    if (existing) {
      handleToId.set(norm, existing.id)
      return existing.id
    }
    return null
  }

  let collaborationsRecorded = 0
  for (const p of pairs) {
    const idA = await resolveId(p.a)
    const idB = await resolveId(p.b)
    if (!idA || !idB || idA === idB) continue
    const count = Math.max(1, Number(p.count) || 1)
    await mergeCollaborations(idA, [
      { contactId: idB, handle: normalizeHandle(p.b)!, count },
    ])
    await mergeCollaborations(idB, [
      { contactId: idA, handle: normalizeHandle(p.a)!, count },
    ])
    collaborationsRecorded++
  }

  return NextResponse.json({
    ok: true,
    imported,
    created: imported.filter((i) => i.created).length,
    merged: imported.filter((i) => !i.created).length,
    collaborationsRecorded,
  })
})
