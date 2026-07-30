import { BarChart3 } from "lucide-react";
import SalesReportsView from "@/components/print/SalesReportsView";

// Shopify sales reporting for the print portal. Reports what the store has
// actually done — products, regions, revenue over time — and needs no rollout
// plan to be useful.
//
// It sits next to Distribution rather than in Finance because once the next
// issue is on sale, the same figures answer rollout questions: how much of each
// cover to print, where to send it, what basket to plan for. That comparison
// layer appears on its own when the issue's SKUs start selling; until then it
// stays out of the way rather than showing empty tables.
export default function SalesReportsPage() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 border-b border-border bg-card px-6 py-3">
        <BarChart3 size={16} className="text-[#9C7C2E]" />
        <div>
          <h1 className="text-base font-semibold text-foreground">Sales reports</h1>
          <p className="text-xs text-muted-foreground">
            Everything the store has sold, consolidated
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <SalesReportsView />
      </div>
    </div>
  );
}
