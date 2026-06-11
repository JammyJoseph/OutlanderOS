"use client";

import { ActionTrackPanel } from "@/components/tasks/ActionTrackPanel";

// Production tasks use the shared ACTION/TRACK system — tasks created here
// are linked to this production and surface on assignees' dashboards.
export default function TasksTab({ productionId }: { productionId: string }) {
  return <ActionTrackPanel productionId={productionId} />;
}
