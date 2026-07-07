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
  "This project's Drive folder was set up by another team member in their own Drive. Ask them to share it with your Google account to sync here.";

function typeForMime(mime: string): string {
  if (mime.startsWith("image/")) return "reference";
  if (mime === "application/pdf") return "brief";
  return "other";
}

// POST /api/productions/[id]/drive/sync
// Reconciles the production's Drive folder with CreativeAsset records:
//  - files in Drive with no matching asset get a new CreativeAsset (so files
//    uploaded directly to Drive appear in the approval grid)
//  - existing assets get their thumbnail / title / mimeType refreshed
//  - a file living in the "Approved" sub-folder is reflected as APPROVED in the
//    tool (Drive → tool direction of the approval sync)
// Returns a summary { created, updated } plus the current file list.
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
      await prisma.production.update({ where: { id }, data: { driveFolderId: structure.rootId } });
    }

    const parents = DRIVE_SUBFOLDERS.map((n) => ({ id: structure.subfolders[n], name: n }));
    const files = await listFilesInFolders(drive, parents);

    const existing = await prisma.creativeAsset.findMany({
      where: { productionId: id, driveFileId: { in: files.map((f) => f.id) } },
      select: { id: true, driveFileId: true, approvalStatus: true, sortOrder: true },
    });
    const byFileId = new Map(existing.map((a) => [a.driveFileId, a]));

    let created = 0;
    let updated = 0;
    let sortCursor =
      (await prisma.creativeAsset.findFirst({
        where: { productionId: id },
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true },
      }))?.sortOrder ?? 0;

    for (const f of files) {
      const inApproved = f.parentName === "Approved";
      const match = byFileId.get(f.id);
      if (match) {
        await prisma.creativeAsset.update({
          where: { id: match.id },
          data: {
            title: f.name,
            url: f.webViewLink || null,
            driveThumbnail: f.thumbnailLink || null,
            mimeType: f.mimeType,
            // Reflect a file that lives in "Approved" as approved in the tool,
            // without ever downgrading an existing approval decision.
            ...(inApproved && match.approvalStatus !== "APPROVED"
              ? { approvalStatus: "APPROVED", approvedBy: user.userId, approvedAt: new Date() }
              : {}),
          },
        });
        updated++;
      } else {
        sortCursor++;
        await prisma.creativeAsset.create({
          data: {
            productionId: id,
            type: typeForMime(f.mimeType),
            title: f.name,
            url: f.webViewLink || null,
            driveFileId: f.id,
            driveThumbnail: f.thumbnailLink || null,
            mimeType: f.mimeType,
            uploadedByName: f.lastModifiedBy || null,
            approvalStatus: inApproved ? "APPROVED" : "PENDING",
            approvedBy: inApproved ? user.userId : null,
            approvedAt: inApproved ? new Date() : null,
            sortOrder: sortCursor,
          },
        });
        created++;
      }
    }

    return NextResponse.json({ connected: true, created, updated, total: files.length });
  } catch (e) {
    if (e instanceof DriveFolderAccessError) {
      return NextResponse.json({ error: NOT_SHARED_MESSAGE, accessible: false }, { status: 409 });
    }
    console.error("POST /api/productions/[id]/drive/sync", e);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
});
