import { PenTool } from "lucide-react";

export default function EditorialPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
        <PenTool className="h-8 w-8 text-gray-400" />
      </div>
      <div>
        <h1 className="text-xl font-bold text-gray-900">Coming Soon — Editorial</h1>
        <p className="mt-2 text-sm text-gray-500">
          Content pipeline, writers, and editorial calendar will live here.
        </p>
      </div>
      <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
        In development
      </span>
    </div>
  );
}
