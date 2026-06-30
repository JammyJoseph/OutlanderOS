// Bridges Instagram scrape results into the Contact directory: matching by
// handle, merging without clobbering manual data, and recording collaborations.

import prisma from "@/lib/prisma"
import {
  normalizeHandle,
  canonicalCategory,
  type Confidence,
  type RecentPost,
} from "@/lib/instagram-scan"

export interface CollaborationLink {
  contactId?: string
  handle: string
  count: number
  role?: string | null
  lastProject?: string | null
}

// Finds an existing directory contact whose Instagram handle matches `handle`.
// Contacts store the handle in varied forms (@x, instagram.com/x, x), so we
// fetch candidates loosely then compare normalised handles exactly.
export async function findContactByHandle(handle: string) {
  const norm = normalizeHandle(handle)
  if (!norm) return null
  const candidates = await prisma.contact.findMany({
    where: { instagram: { contains: norm, mode: "insensitive" } },
    select: {
      id: true,
      name: true,
      instagram: true,
      isRadar: true,
    },
  })
  return (
    candidates.find((c) => normalizeHandle(c.instagram) === norm) ?? null
  )
}

export interface ScannedContactInput {
  handle: string
  name?: string | null
  bio?: string | null
  category?: string | null
  location?: string | null
  website?: string | null
  followers?: number | null
  profilePic?: string | null
  recentPosts?: RecentPost[] | null
  confidence?: Confidence | null
}

// Sanitises incoming post data into [{ shortcode, imageUrl, caption? }], capped
// at 9 — these arrive from the scraper, so we don't trust their shape blindly.
function sanitizeRecentPosts(value: unknown): RecentPost[] {
  if (!Array.isArray(value)) return []
  return value
    .map((p) => {
      const v = p as { shortcode?: unknown; imageUrl?: unknown; caption?: unknown }
      return {
        shortcode: typeof v?.shortcode === "string" ? v.shortcode.slice(0, 60) : "",
        imageUrl: typeof v?.imageUrl === "string" ? v.imageUrl.slice(0, 1000) : "",
        caption: typeof v?.caption === "string" ? v.caption.slice(0, 400) : null,
      }
    })
    .filter((p) => p.shortcode && p.imageUrl)
    .slice(0, 9)
}

// True when a contact's stored name is really just their handle (e.g. "@nike"
// or "nike"), meaning we should upgrade it to the scanned full name when we have one.
function nameIsJustHandle(name: string | null, handle: string): boolean {
  if (!name) return true
  const n = normalizeHandle(name) ?? name.trim().toLowerCase()
  return n === handle.toLowerCase()
}

// Upserts a scanned profile into the directory. Creates a new contact tagged
// `source: "instagram_scan"`, or — if one already exists for the handle — fills
// in ONLY the fields that are currently empty, never overwriting manual data.
export async function upsertScannedContact(
  input: ScannedContactInput,
  userId: string
): Promise<{ contact: { id: string; name: string }; created: boolean }> {
  const norm = normalizeHandle(input.handle)
  const handle = norm ? `@${norm}` : input.handle
  const existing = norm ? await findContactByHandle(norm) : null

  const category = canonicalCategory(input.category)

  if (existing) {
    // Merge: only set fields that are blank on the existing record.
    const current = await prisma.contact.findUnique({ where: { id: existing.id } })
    if (!current) {
      return { contact: { id: existing.id, name: existing.name }, created: false }
    }
    const data: Record<string, unknown> = {}
    // Upgrade a handle-only name to the scanned full name (but never clobber a
    // real, manually-entered name).
    if (input.name && nameIsJustHandle(current.name, norm ?? "")) data.name = input.name
    if (!current.website && input.website) data.website = input.website
    if (!current.location && input.location) data.location = input.location
    if (!current.notes && input.bio) data.notes = input.bio
    if (current.followers == null && input.followers != null) data.followers = input.followers
    if (!current.profilePic && input.profilePic) data.profilePic = input.profilePic
    const posts = sanitizeRecentPosts(input.recentPosts)
    const currentPosts = Array.isArray(current.recentPosts) ? current.recentPosts : []
    // Refresh post thumbnails whenever the scan brought some back.
    if (posts.length > 0 && posts.length >= currentPosts.length) data.recentPosts = posts
    if ((!current.category || current.category === "Other") && category !== "Other")
      data.category = category
    if (!current.confidence && input.confidence) data.confidence = input.confidence
    data.scannedAt = new Date()
    // Never flip a manually-added contact's source, but tag if it had none.
    if (!current.source) data.source = "instagram_scan"

    const updated = await prisma.contact.update({
      where: { id: existing.id },
      data,
      select: { id: true, name: true },
    })
    return { contact: updated, created: false }
  }

  const created = await prisma.contact.create({
    data: {
      name: input.name?.trim() || (norm ?? "Unknown"),
      category,
      instagram: handle,
      website: input.website || null,
      location: input.location || null,
      notes: input.bio || null,
      followers: input.followers ?? null,
      profilePic: input.profilePic ?? null,
      recentPosts: sanitizeRecentPosts(input.recentPosts) as unknown as object,
      confidence: input.confidence ?? "UNVERIFIED",
      source: "instagram_scan",
      scannedAt: new Date(),
      createdBy: userId,
    },
    select: { id: true, name: true },
  })
  return { contact: created, created: true }
}

// Records that `handle` has collaborated with each of `others`, merging counts
// into the contact's `collaborations` JSON. Idempotent-ish: re-running adds the
// supplied counts (callers pass per-scan deltas).
export async function mergeCollaborations(
  contactId: string,
  additions: CollaborationLink[]
): Promise<void> {
  if (additions.length === 0) return
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: { collaborations: true },
  })
  if (!contact) return
  const existing: CollaborationLink[] = Array.isArray(contact.collaborations)
    ? (contact.collaborations as unknown as CollaborationLink[])
    : []

  const byHandle = new Map<string, CollaborationLink>()
  for (const c of existing) {
    if (c && typeof c.handle === "string") byHandle.set(c.handle, c)
  }
  for (const add of additions) {
    const key = add.handle
    const prev = byHandle.get(key)
    if (prev) {
      prev.count = (prev.count || 0) + (add.count || 0)
      if (add.role && !prev.role) prev.role = add.role
      if (add.contactId && !prev.contactId) prev.contactId = add.contactId
      if (add.lastProject) prev.lastProject = add.lastProject
    } else {
      byHandle.set(key, { ...add })
    }
  }

  const merged = [...byHandle.values()].sort((a, b) => (b.count || 0) - (a.count || 0))
  await prisma.contact.update({
    where: { id: contactId },
    data: { collaborations: merged as unknown as object },
  })
}
