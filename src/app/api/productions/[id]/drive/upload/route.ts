import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import {
  getUserDrive,
  ensureProductionFolders,
  uploadFileToFolder,
  driveFolderName,
  DriveFolderAccessError,
} from "@/lib/google-drive";

const NOT_SHARED_MESSAGE =
  "This project's Drive folder was set up by another team member in their own Drive. Ask them to share it with your Google account to upload here.";

// Pick a sensible CreativeAsset `type` from the uploaded file's MIME type.
function typeForMime(mime: string): string {
  if (mime.startsWith("image/")) return "reference";
  if (mime === "application/pdf") return "brief";
  return "other";
}

// POST /api/productions/[id]/drive/upload  (multipart/form-data, field "file")
// Uploads a file into the production's Drive "Assets" sub-folder and creates a
// matching CreativeAsset record so it shows in the approval grid. Sets up the
// Drive folder structure first if it doesn't exist yet.
export const POST = withAuth(async (
  request: NextRequest,
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

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  try {
    const clientName = production.clientName || production.campaign?.client?.name || null;
    const name = driveFolderName(clientName, production.title);
    const structure = await ensureProductionFolders(drive, name, production.driveFolderId);
    if (structure.rootId !== production.driveFolderId) {
      await prisma.production.update({ where: { id }, data: { driveFolderId: structure.rootId } });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type || "application/octet-stream";
    const uploaded = await uploadFileToFolder(
      drive,
      structure.subfolders.Assets,
      file.name || "Untitled",
      mimeType,
      buffer
    );

    // Where multiple assets already exist, append to the end of the grid.
    const last = await prisma.creativeAsset.findFirst({
      where: { productionId: id },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    const asset = await prisma.creativeAsset.create({
      data: {
        productionId: id,
        type: typeForMime(uploaded.mimeType),
        title: uploaded.name,
        url: uploaded.webViewLink || null,
        driveFileId: uploaded.id,
        driveThumbnail: uploaded.thumbnailLink || null,
        mimeType: uploaded.mimeType,
        uploadedByName: user.name || user.email || null,
        approvalStatus: "PENDING",
        sortOrder: (last?.sortOrder ?? 0) + 1,
      },
    });

    return NextResponse.json({ connected: true, asset });
  } catch (e) {
    if (e instanceof DriveFolderAccessError) {
      return NextResponse.json({ error: NOT_SHARED_MESSAGE, accessible: false }, { status: 409 });
    }
    console.error("POST /api/productions/[id]/drive/upload", e);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
});
