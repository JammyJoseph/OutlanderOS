import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { getUserDrive, resolveSubfolder, moveFileToFolder } from "@/lib/google-drive";

// Best-effort: mirror a tool-side approval decision into Drive by moving the
// backing file between the "Approved" and "Assets" sub-folders. Never throws —
// a Drive hiccup must not break the approval itself.
async function syncApprovalToDrive(
  userId: string,
  driveFileId: string,
  rootFolderId: string,
  status: string
) {
  try {
    const drive = await getUserDrive(userId);
    if (!drive) return;
    const target = status === "APPROVED" ? "Approved" : "Assets";
    const targetId = await resolveSubfolder(drive, rootFolderId, target);
    await moveFileToFolder(drive, driveFileId, targetId);
  } catch (e) {
    console.error("syncApprovalToDrive", e);
  }
}

export const GET = withAuth(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  try {
    const assets = await prisma.creativeAsset.findMany({
      where: { productionId: id },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    return NextResponse.json({ assets });
  } catch (e) {
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
});

export const POST = withAuth(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  const body = await request.json();
  try {
    const asset = await prisma.creativeAsset.create({
      data: {
        productionId: id,
        type: body.type || "reference",
        title: body.title || "Untitled",
        url: body.url || null,
        description: body.description || null,
        sortOrder: body.sortOrder == null ? 0 : Number(body.sortOrder),
        approvalStatus: body.approvalStatus || "PENDING",
      },
    });
    return NextResponse.json({ asset });
  } catch (e) {
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
});

export const PUT = withAuth(async (request: NextRequest, _ctx, user) => {
  const url = new URL(request.url);
  const assetId = url.searchParams.get("assetId");
  if (!assetId) return NextResponse.json({ error: "assetId required" }, { status: 400 });
  const body = await request.json();
  try {
    const data: Record<string, unknown> = {};
    if (body.type !== undefined) data.type = body.type;
    if (body.title !== undefined) data.title = body.title;
    if (body.url !== undefined) data.url = body.url || null;
    if (body.description !== undefined) data.description = body.description || null;
    if (body.sortOrder !== undefined) data.sortOrder = Number(body.sortOrder);
    // Approval workflow (Phase 5). Stamp approvedBy/approvedAt server-side when
    // the status moves to APPROVED/DENIED; clear them when reset to PENDING.
    if (body.approvalStatus !== undefined) {
      const status = body.approvalStatus || "PENDING";
      data.approvalStatus = status;
      if (status === "APPROVED" || status === "DENIED") {
        data.approvedBy = body.approvedBy || null;
        data.approvedAt = new Date();
      } else {
        data.approvedBy = null;
        data.approvedAt = null;
      }
    }

    const asset = await prisma.creativeAsset.update({ where: { id: assetId }, data });

    // When approval status changed on a Drive-backed asset, mirror the move in
    // Drive (Approved ↔ Assets). Best-effort — does not block the response.
    if (body.approvalStatus !== undefined && asset.driveFileId) {
      const production = await prisma.production.findUnique({
        where: { id: asset.productionId },
        select: { driveFolderId: true },
      });
      if (production?.driveFolderId) {
        await syncApprovalToDrive(
          user.userId,
          asset.driveFileId,
          production.driveFolderId,
          asset.approvalStatus || "PENDING"
        );
      }
    }

    return NextResponse.json({ asset });
  } catch (e) {
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
});

export const DELETE = withAuth(async (request: NextRequest) => {
  const url = new URL(request.url);
  const assetId = url.searchParams.get("assetId");
  if (!assetId) return NextResponse.json({ error: "assetId required" }, { status: 400 });
  try {
    await prisma.creativeAsset.delete({ where: { id: assetId } });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
});
