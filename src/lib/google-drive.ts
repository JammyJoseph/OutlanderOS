import { google, drive_v3 } from 'googleapis'
import { Readable } from 'stream'
import { getUserGoogleTokens, createUserOAuthClient } from './google-user-auth'

// Per-user Google Drive helpers for production file management. All calls use
// the signed-in user's own OAuth tokens (see google-user-auth.ts) — there is no
// shared service account. Callers get null when the user hasn't connected
// Google (or lacks the read-write `drive` scope), and should surface a
// "Connect Google Drive" prompt in that case.

const FOLDER_MIME = 'application/vnd.google-apps.folder'

// Sub-folders created inside every production's root Drive folder. Order is the
// display order; "Assets" is where tool uploads land, "Approved" is where files
// move when approved in the tool.
export const DRIVE_SUBFOLDERS = ['Assets', 'Selects', 'Approved', 'Reference'] as const
export type DriveSubfolder = (typeof DRIVE_SUBFOLDERS)[number]

export interface DriveFolderStructure {
  rootId: string
  subfolders: Record<string, string> // name -> folderId
}

// Thrown when a production already has a Drive folder that the current user's
// token cannot reach — typically because another team member set it up in their
// own Drive and hasn't shared it. We surface this rather than silently creating
// a duplicate folder (which would clobber the shared driveFolderId).
export class DriveFolderAccessError extends Error {
  folderId: string
  constructor(folderId: string) {
    super('Drive folder is not accessible with this Google account')
    this.name = 'DriveFolderAccessError'
    this.folderId = folderId
  }
}

export interface DriveFileMeta {
  id: string
  name: string
  mimeType: string
  thumbnailLink?: string | null
  webViewLink?: string | null
  modifiedTime?: string | null
  createdTime?: string | null
  lastModifiedBy?: string | null
  parentName?: string | null
}

// Returns an authenticated Drive v3 client for the given user, or null when the
// user has not connected Google.
export async function getUserDrive(userId: string): Promise<drive_v3.Drive | null> {
  const tokens = await getUserGoogleTokens(userId)
  if (!tokens) return null
  const client = createUserOAuthClient()
  client.setCredentials({ access_token: tokens.accessToken })
  return google.drive({ version: 'v3', auth: client })
}

// Builds the root folder name: "[Client] — [Project Name]". Falls back to just
// the project when there is no client, and to "Untitled Production" when both
// are blank.
export function driveFolderName(clientName: string | null | undefined, projectTitle: string | null | undefined): string {
  const client = (clientName || '').trim()
  const project = (projectTitle || '').trim() || 'Untitled Production'
  return client ? `${client} — ${project}` : project
}

// Escapes a value for use inside a Drive query string literal (single-quoted).
function q(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

// Finds a non-trashed child folder by name under `parentId`, creating it if it
// doesn't exist. Idempotent — safe to call repeatedly.
async function ensureChildFolder(
  drive: drive_v3.Drive,
  parentId: string,
  name: string
): Promise<string> {
  const res = await drive.files.list({
    q: `name = '${q(name)}' and mimeType = '${FOLDER_MIME}' and '${q(parentId)}' in parents and trashed = false`,
    fields: 'files(id,name)',
    pageSize: 1,
    spaces: 'drive',
  })
  const existing = res.data.files?.[0]
  if (existing?.id) return existing.id

  const created = await drive.files.create({
    requestBody: { name, mimeType: FOLDER_MIME, parents: [parentId] },
    fields: 'id',
  })
  if (!created.data.id) throw new Error(`Failed to create Drive folder "${name}"`)
  return created.data.id
}

// Ensures the full production folder structure exists and returns the ids.
// When `existingRootId` is supplied and still valid, it is reused; the
// sub-folders are re-resolved (and re-created if a user deleted one), which
// keeps the structure self-healing.
export async function ensureProductionFolders(
  drive: drive_v3.Drive,
  folderName: string,
  existingRootId?: string | null
): Promise<DriveFolderStructure> {
  let rootId = existingRootId || null

  // Validate an existing root. A get() failure means this user's token can't
  // reach the folder — do NOT create a duplicate (that would overwrite the
  // shared driveFolderId); signal an access error instead. Only recreate when
  // the folder is reachable but the owner has trashed it.
  if (rootId) {
    let meta
    try {
      meta = await drive.files.get({ fileId: rootId, fields: 'id,trashed' })
    } catch {
      throw new DriveFolderAccessError(rootId)
    }
    if (meta.data.trashed) rootId = null
  }

  if (!rootId) {
    const created = await drive.files.create({
      requestBody: { name: folderName, mimeType: FOLDER_MIME },
      fields: 'id',
    })
    if (!created.data.id) throw new Error('Failed to create Drive root folder')
    rootId = created.data.id
  }

  const subfolders: Record<string, string> = {}
  for (const name of DRIVE_SUBFOLDERS) {
    subfolders[name] = await ensureChildFolder(drive, rootId, name)
  }

  return { rootId, subfolders }
}

// Lists non-trashed files (excluding sub-folders) directly under any of the
// given parent folders, newest first. Used to pull previews for the Creative
// tab, including files uploaded to Drive outside the tool.
export async function listFilesInFolders(
  drive: drive_v3.Drive,
  parents: { id: string; name: string }[]
): Promise<DriveFileMeta[]> {
  const out: DriveFileMeta[] = []
  for (const parent of parents) {
    let pageToken: string | undefined
    do {
      const res = await drive.files.list({
        q: `'${q(parent.id)}' in parents and mimeType != '${FOLDER_MIME}' and trashed = false`,
        fields:
          'nextPageToken, files(id,name,mimeType,thumbnailLink,webViewLink,modifiedTime,createdTime,lastModifyingUser(displayName))',
        orderBy: 'modifiedTime desc',
        pageSize: 100,
        spaces: 'drive',
        pageToken,
      })
      for (const f of res.data.files || []) {
        if (!f.id) continue
        out.push({
          id: f.id,
          name: f.name || 'Untitled',
          mimeType: f.mimeType || 'application/octet-stream',
          thumbnailLink: f.thumbnailLink || null,
          webViewLink: f.webViewLink || null,
          modifiedTime: f.modifiedTime || null,
          createdTime: f.createdTime || null,
          lastModifiedBy: f.lastModifyingUser?.displayName || null,
          parentName: parent.name,
        })
      }
      pageToken = res.data.nextPageToken || undefined
    } while (pageToken)
  }
  return out
}

// Uploads a file (given as a Buffer) into a Drive folder and returns its
// metadata. Used by the "Upload to Drive" flow.
export async function uploadFileToFolder(
  drive: drive_v3.Drive,
  parentId: string,
  name: string,
  mimeType: string,
  buffer: Buffer
): Promise<DriveFileMeta> {
  const res = await drive.files.create({
    requestBody: { name, parents: [parentId] },
    media: { mimeType, body: Readable.from(buffer) },
    fields: 'id,name,mimeType,thumbnailLink,webViewLink,modifiedTime,createdTime',
  })
  const f = res.data
  if (!f.id) throw new Error('Drive upload failed')
  return {
    id: f.id,
    name: f.name || name,
    mimeType: f.mimeType || mimeType,
    thumbnailLink: f.thumbnailLink || null,
    webViewLink: f.webViewLink || null,
    modifiedTime: f.modifiedTime || null,
    createdTime: f.createdTime || null,
  }
}

// Moves a file into `targetParentId`, detaching it from its current parents.
// Best-effort: used when an asset is approved (move into "Approved"). Throws on
// hard failure so callers can decide whether to swallow it.
export async function moveFileToFolder(
  drive: drive_v3.Drive,
  fileId: string,
  targetParentId: string
): Promise<void> {
  const meta = await drive.files.get({ fileId, fields: 'parents' })
  const previousParents = (meta.data.parents || []).join(',')
  await drive.files.update({
    fileId,
    addParents: targetParentId,
    removeParents: previousParents || undefined,
    fields: 'id,parents',
  })
}

// Resolves the id of a named sub-folder under a root, creating it if missing.
export async function resolveSubfolder(
  drive: drive_v3.Drive,
  rootId: string,
  name: DriveSubfolder
): Promise<string> {
  return ensureChildFolder(drive, rootId, name)
}
