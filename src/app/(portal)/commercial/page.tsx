import { Kanban } from "lucide-react";

export default function CommercialPage() {
  return (
    <div className="flex min-h-full items-center justify-center px-6 py-24">
      <div className="w-full max-w-md rounded-2xl border border-dashed border-gray-200 bg-white px-8 py-14 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#D4A853]/10">
          <Kanban className="h-6 w-6 text-[#D4A853]" />
        </div>
        <h1 className="mt-4 text-xl font-semibold text-gray-900">Deal Pipeline</h1>
        <p className="mt-1 text-sm font-medium text-[#D4A853]">Coming soon</p>
        <p className="mt-3 text-sm leading-relaxed text-gray-500">
          Your native deal pipeline is being built to replace the Trello
          integration.
        </p>
      </div>
    </div>
  );
}
