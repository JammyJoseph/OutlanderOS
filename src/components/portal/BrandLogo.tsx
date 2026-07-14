import Link from "next/link";

/**
 * Header wordmark. Two SVGs swapped by theme rather than one recoloured file:
 * the artwork is flat-filled, so CSS can't retint it.
 */
export function BrandLogo({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/me"
      className={`shrink-0 hover:opacity-70 transition-opacity ${className}`}
      aria-label="OutlanderOS — my dashboard"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/OutlanderOS_Logo_Light.svg"
        alt="OutlanderOS"
        className="h-6 w-auto block dark:hidden"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/OutlanderOS_Logo_Dark.svg"
        alt="OutlanderOS"
        className="h-6 w-auto hidden dark:block"
      />
    </Link>
  );
}
