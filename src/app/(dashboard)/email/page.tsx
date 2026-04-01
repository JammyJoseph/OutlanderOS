"use client";

import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/ui/empty-state";
import { Mail } from "lucide-react";

export default function EmailPage() {
  const router = useRouter();

  return (
    <div className="flex h-full items-center justify-center">
      <EmptyState
        icon={Mail}
        title="No email account connected"
        description="Connect your billing Google account (billing@outlandermag.com) to view emails, invoices, and payment notifications here."
        actionLabel="Connect Billing Account"
        onAction={() => router.push("/api/google/connect?label=billing")}
      />
    </div>
  );
}
