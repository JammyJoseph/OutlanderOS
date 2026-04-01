"use client";

import { EmptyState } from "@/components/ui/empty-state";
import { Camera } from "lucide-react";

export default function InstagramPage() {
  return (
    <div className="flex h-full items-center justify-center">
      <EmptyState
        icon={Camera}
        title="Instagram not connected"
        description="Instagram analytics integration is coming soon. You'll be able to track @outlandermagazine engagement, reach, and campaign performance here."
      />
    </div>
  );
}
