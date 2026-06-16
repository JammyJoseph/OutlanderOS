import Link from "next/link";

// Clean branded 404 for deleted/unknown routes (e.g. /editorial, /contacts).
export default function NotFound() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-white px-6 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -left-40 h-[480px] w-[480px] rounded-full bg-[#ffd700]/15 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -right-40 h-[480px] w-[480px] rounded-full bg-[#c77dff]/10 blur-3xl"
      />
      <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-gray-400">
        Outlander Magazine
      </p>
      <h1 className="mt-3 text-6xl font-extrabold tracking-tight text-gray-200">404</h1>
      <p className="mt-2 text-lg font-semibold text-gray-900">This page doesn&apos;t exist</p>
      <p className="mt-1 max-w-sm text-sm text-gray-500">
        It may have been removed in a recent clean-up. Head back to your dashboard to find what
        you need.
      </p>
      <div className="mt-6 flex items-center gap-3">
        <Link
          href="/me"
          className="rounded-xl bg-[#ffd700] px-5 py-2.5 text-sm font-semibold text-black shadow-sm transition-colors hover:bg-[#e6c200]"
        >
          Go to Dashboard
        </Link>
        <Link
          href="/hub"
          className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          Portal Hub
        </Link>
      </div>
    </div>
  );
}
