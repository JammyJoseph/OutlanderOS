import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { getUserDrive, ensureProductionFolders, driveFolderName, DriveFolderAccessError } from "@/lib/google-drive";

const NOT_SHARED_MESSAGE =
  "This project's Drive folder was set up by another team member in their own Drive. Ask them to share it with your Google account (or connect that account) to manage files here.";

// POST /api/productions/[id]/drive/setup
// Creates (or repairs) the production's Google Drive folder structure —
// "[Client] — [Project]" with Assets / Selects / Approved / Reference
// sub-folders — using the signed-in user's Drive, and stores the root folder id
// on the Production. Idempotent: re-running reuses the stored folder and
// re-creates any sub-folder that was deleted in Drive.
export const POST = withAuth(async (
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

  try {
    const clientName = production.clientName || production.campaign?.client?.name || null;
    const name = driveFolderName(clientName, production.title);
    const structure = await ensureProductionFolders(drive, name, production.driveFolderId);

    if (structure.rootId !== production.driveFolderId) {
      await prisma.production.update({
        where: { id },
        data: { driveFolderId: structure.rootId },
      });
    }

    return NextResponse.json({
      connected: true,
      folderId: structure.rootId,
      subfolders: structure.subfolders,
      folderName: name,
    });
  } catch (e) {
    if (e instanceof DriveFolderAccessError) {
      return NextResponse.json({ error: NOT_SHARED_MESSAGE, accessible: false }, { status: 409 });
    }
    console.error("POST /api/productions/[id]/drive/setup", e);
    return NextResponse.json({ error: "Failed to set up Drive folder" }, { status: 500 });
  }
});
