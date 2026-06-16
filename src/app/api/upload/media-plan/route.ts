import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "media-plans");

// POST /api/upload/media-plan
// Accepts a PDF media plan (multipart form: `file`, `campaignId`), stores it
// under public/uploads/media-plans/, saves the path to the campaign, and
// returns the public path.
export const POST = withAuth(async (request: NextRequest, _ctx, user) => {
  try {
    const form = await request.formData();
    const file = form.get("file");
    const campaignId = String(form.get("campaignId") || "");

    if (!campaignId) {
      return NextResponse.json({ error: "Missing campaignId" }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "Only PDF files are accepted" }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File too large — max 10MB" }, { status: 400 });
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { id: true, title: true },
    });
    if (!campaign) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    await mkdir(UPLOAD_DIR, { recursive: true });
    const stamp = Date.now();
    const fileName = `${campaignId}-${stamp}.pdf`;
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(UPLOAD_DIR, fileName), buffer);

    const filePath = `/uploads/media-plans/${fileName}`;
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { mediaPlanFile: filePath },
    });

    await prisma.dealActivity.create({
      data: {
        campaignId,
        type: "budget_update",
        message: `Media plan PDF uploaded for "${campaign.title}"`,
        userId: user.userId,
        userName: user.name,
      },
    });

    return NextResponse.json({ filePath });
  } catch (err) {
    console.error("POST /api/upload/media-plan", err);
    return NextResponse.json({ error: "Failed to upload media plan" }, { status: 500 });
  }
});
