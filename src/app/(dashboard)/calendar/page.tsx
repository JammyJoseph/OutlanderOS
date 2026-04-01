"use client";

import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/ui/empty-state";
import { Calendar } from "lucide-react";

export default function CalendarPage() {
  const router = useRouter();

  return (
    <div className="flex h-full items-center justify-center">
      <EmptyState
        icon={Calendar}
        title="No calendar connected"
        description="Connect your primary Google account (q@outlandermag.com) to see upcoming meetings, shoots, and deadlines."
        actionLabel="Connect Google Calendar"
        onAction={() => router.push("/api/google/connect?label=primary")}
      />
    </div>
  );
}
