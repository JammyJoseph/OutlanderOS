import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { scanEmailsForTasks } from "@/lib/email-task-extractor";
import prisma from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const me = getCurrentUser(request);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: me.userId },
    select: { googleConnected: true },
  });

  if (!user?.googleConnected) {
    return NextResponse.json(
      { error: "Connect Google to enable email scanning" },
      { status: 400 }
    );
  }

  try {
    const result = await scanEmailsForTasks(me.userId);
    return NextResponse.json(result);
  } catch (err) {
    console.error("POST /api/deadlines/scan-email", err);
    return NextResponse.json(
      { error: "Failed to scan email", detail: String(err) },
      { status: 500 }
    );
  }
}
