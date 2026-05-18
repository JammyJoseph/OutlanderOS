import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { runAutoPing } from "@/lib/auto-escalation";

const AUTOPING_INTERVAL_MS = 15 * 60 * 1000;

/**
 * Manually triggers a full auto-ping cycle: escalate overdue items, unlock
 * run-on tasks, flag stale work. The scheduled job (sync engine, every 15
 * min) does the same — this is for on-demand runs.
 */
export async function POST() {
  try {
    const result = await runAutoPing();

    // Record the run so /api/auto-ping/status reflects manual triggers too.
    await prisma.syncStatus.upsert({
      where: { source: "autoPing" },
      update: {
        state: "idle",
        lastSyncAt: new Date(),
        lastSuccessAt: new Date(),
      },
      create: {
        source: "autoPing",
        state: "idle",
        intervalMs: AUTOPING_INTERVAL_MS,
        lastSyncAt: new Date(),
        lastSuccessAt: new Date(),
      },
    });

    return NextResponse.json({
      ranAt: result.ranAt,
      itemsEscalated:
        result.escalation.tasksEscalated +
        result.escalation.deadlinesEscalated,
      tasksEscalated: result.escalation.tasksEscalated,
      deadlinesEscalated: result.escalation.deadlinesEscalated,
      tasksUnlocked: result.runOn.tasksUnlocked,
      staleFlagged: result.stale.staleFlagged,
      deadlinesReactivated: result.stale.deadlinesReactivated,
      notificationsCreated: result.totalNotifications,
      details: [
        ...result.escalation.details,
        ...result.runOn.details,
        ...result.stale.details,
      ],
    });
  } catch (err) {
    console.error("POST /api/auto-ping/escalate", err);
    return NextResponse.json(
      { error: "Auto-ping escalation failed" },
      { status: 500 }
    );
  }
}
