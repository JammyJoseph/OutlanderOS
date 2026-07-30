import { BarChart3 } from "lucide-react";
import SalesReportsView from "@/components/print/SalesReportsView";

// Shopify sales reporting for the print portal. Deliberately sits next to
// Distribution rather than in Finance: the questions it answers — how much of
// each cover to print, where to send it, what basket to plan for — are rollout
// decisions, and they're only useful read against the plan on the next tab.
export default function SalesReportsPage() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 border-b border-border bg-card px-6 py-3">
        <BarChart3 size={16} className="text-[#9C7C2E]" />
        <div>
          <h1 className="text-base font-semibold text-foreground">Sales reports</h1>
          <p className="text-xs text-muted-foreground">
            Shopify sales read back against the rollout plan
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <SalesReportsView />
      </div>
    </div>
  );
}
