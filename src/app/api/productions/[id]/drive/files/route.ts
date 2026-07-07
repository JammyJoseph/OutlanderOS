import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import {
  getUserDrive,
  ensureProductionFolders,
  listFilesInFolders,
  driveFolderName,
  DRIVE_SUBFOLDERS,
  DriveFolderAccessError,
} from "@/lib/google-drive";

const NOT_SHARED_MESSAGE =
  "This project's Drive folder was set up by another team member in their own Drive. Ask them to share it with your Google account (or connect that account) to see the files here.";

// GET /api/productions/[id]/drive/files
// Lists files living in the production's Drive folder (across all sub-folders),
// including files uploaded to Drive directly. Each file is annotated with
// whether a matching CreativeAsset already exists in the tool and its approval
// status, so the UI can show what's synced vs. new.
//
// Response shapes:
//   { connected: false }                    — user hasn't connected Google Drive
//   { connected: true, folder: null }       — no Drive folder set up yet
//   { connected: true, folder: {...}, files: [...] }
export const GET = withAuth(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
  user
) => {
  const { id } = await params;

  const production = await prisma.production.findUnique({
    where: { id },
    select: { id: true, title: true, clientName: true, driveFolderId: true, campaign: { select: { client: { select: { name: true } } } } },
  });
  if (!production) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const drive = await getUserDrive(user.userId);
  if (!drive) return NextResponse.json({ connected: false }, { status: 200 });

  if (!production.driveFolderId) {
    return NextResponse.json({ connected: true, folder: null, files: [] });
  }

  try {
    const clientName = production.clientName || production.campaign?.client?.name || null;
    const name = driveFolderName(clientName, production.title);
    // Resolve (and self-heal) the sub-folders so listing survives a folder being
    // deleted in Drive.
    const structure = await ensureProductionFolders(drive, name, production.driveFolderId);

    // Persist a repaired/changed root id.
    if (structure.rootId !== production.driveFolderId) {
      await prisma.production.update({ where: { id }, data: { driveFolderId: structure.rootId } });
    }

    const parents = DRIVE_SUBFOLDERS.map((n) => ({ id: structure.subfolders[n], name: n }));
    const files = await listFilesInFolders(drive, parents);

    // Annotate with the tool's own records (approval status / whether synced).
    const assets = await prisma.creativeAsset.findMany({
      where: { productionId: id, driveFileId: { in: files.map((f) => f.id) } },
      select: { id: true, driveFileId: true, approvalStatus: true },
    });
    const byFileId = new Map(assets.map((a) => [a.driveFileId, a]));

    const annotated = files.map((f) => {
      const asset = byFileId.get(f.id);
      return {
        ...f,
        synced: !!asset,
        assetId: asset?.id ?? null,
        approvalStatus: asset?.approvalStatus ?? null,
      };
    });

    return NextResponse.json({
      connected: true,
      folder: { id: structure.rootId, name, subfolders: structure.subfolders },
      files: annotated,
    });
  } catch (e) {
    if (e instanceof DriveFolderAccessError) {
      return NextResponse.json({
        connected: true,
        folder: { id: production.driveFolderId, name: null },
        files: [],
        accessible: false,
        error: NOT_SHARED_MESSAGE,
      });
    }
    console.error("GET /api/productions/[id]/drive/files", e);
    return NextResponse.json({ error: "Failed to list Drive files" }, { status: 500 });
  }
});
