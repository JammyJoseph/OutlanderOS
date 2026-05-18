import { NextResponse } from "next/server";
import { runCampaignSync } from "@/lib/campaign-sync";
import prisma from "@/lib/prisma";
import { withAuth, withAdmin } from "@/lib/auth";

export const POST = withAdmin(async () => {
  try {
    const report = await runCampaignSync();
    return NextResponse.json(report);
  } catch (err) {
    console.error("Engine sync failed:", err);
    return NextResponse.json(
      { error: "Sync failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
});

export const GET = withAuth(async () => {
  try {
    // Return summary of the most recent sync run
    const lastLog = await prisma.intelligenceLog.findFirst({
      orderBy: { createdAt: "desc" },
      select: { runId: true, createdAt: true },
    });

    if (!lastLog) {
      return NextResponse.json({ lastRun: null, stats: null });
    }

    const runLogs = await prisma.intelligenceLog.findMany({
      where: { runId: lastLog.runId },
    });

    const stats = {
      runId: lastLog.runId,
      completedAt: lastLog.createdAt,
      campaignsAnalyzed: runLogs.length,
      updatesApplied: runLogs.filter((l) =>
        ["status_update", "io_signed", "value_update"].includes(l.type)
      ).length,
      flagsRaised: runLogs.filter((l) => l.type === "flag").length,
      errors: runLogs.filter((l) => l.type === "error").length,
    };

    return NextResponse.json({ lastRun: lastLog.createdAt, stats });
  } catch (err) {
    console.error("Engine sync GET failed:", err);
    return NextResponse.json({ error: "Failed to fetch sync status" }, { status: 500 });
  }
});
