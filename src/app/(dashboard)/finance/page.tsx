"use client";

import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/ui/empty-state";
import { TableProperties } from "lucide-react";

export default function FinancePage() {
  const router = useRouter();

  return (
    <div className="flex h-full items-center justify-center">
      <EmptyState
        icon={TableProperties}
        title="No billing data connected"
        description="Link your 2026 Master Billing Tracker Google Sheet to see invoices, revenue breakdowns, client margins, and outstanding payments."
        actionLabel="Link Billing Spreadsheet"
        onAction={() => router.push("/settings")}
      />
    </div>
  );
}
