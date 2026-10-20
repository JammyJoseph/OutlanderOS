import Link from "next/link";

/**
 * The flat wordmark. Two cuts of one drawing:
 *   ink      — ink wordmark, white "OS" pill with an ink outline, for light grounds
 *   onColour — white wordmark, white pill with "OS" cut out, for navy and blue
 * The theme picks ink in light mode and onColour in dark unless told otherwise.
 */
export function Logo({
  tone = "auto",
  href = "/hub",
  className = "h-5",
  label = "OutlanderOS, all workspaces",
}: {
  tone?: "auto" | "ink" | "onColour";
  href?: string | null;
  className?: string;
  label?: string;
}) {
  const img = (src: string, extra = "") => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="OutlanderOS" className={`block w-auto ${className} ${extra}`} />
  );
  const art =
    tone === "ink" ? img("/OutlanderOS_Logo_Ink.svg")
    : tone === "onColour" ? img("/OutlanderOS_Logo_OnColour.svg")
    : (
      <>
        {img("/OutlanderOS_Logo_Ink.svg", "dark:hidden")}
        {img("/OutlanderOS_Logo_OnColour.svg", "hidden dark:block")}
      </>
    );
  if (!href) return <span className="inline-block">{art}</span>;
  return (
    <Link
      href={href}
      aria-label={label}
      className="inline-block rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground"
    >
      {art}
    </Link>
  );
}
