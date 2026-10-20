;
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
      <div className="flex flex-wrap items-center gap-2.5 px-4 pb-2 pt-6 sm:px-8 lg:px-12">
        <div>
          <h1 className="text-foreground text-[28px] font-semibold leading-[1.1] tracking-[-0.015em] sm:text-4xl">Sales reports</h1>
          <p className="mt-1.5 text-base text-muted-foreground">
            Everything the store has sold, consolidated
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-4 pb-20 pt-4 sm:px-8 lg:px-12">
        <SalesReportsView />
      </div>
    </div>
  );
}
