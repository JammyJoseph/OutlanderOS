"use client";

import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/ui/empty-state";
import { TrendingUp } from "lucide-react";

export default function CashflowPage() {
  const router = useRouter();

  return (
    <div className="flex h-full items-center justify-center">
      <EmptyState
        icon={TrendingUp}
        title="No billing data connected"
        description="Connect your billing tracker spreadsheet to see cash flow projections, revenue vs expenses, and payment forecasts."
        actionLabel="Link Billing Data"
        onAction={() => router.push("/settings")}
      />
    </div>
  );
}
