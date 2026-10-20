import { cookies } from "next/headers";
import { resolveSession } from "@/lib/session";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";

const OUTLANDER_DOMAIN = "@outlandermag.com";

function Notice({ title, message }: { title: string; message: string }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <h1 className="mb-2 text-[28px] font-semibold leading-[1.1] tracking-[-0.015em] sm:text-4xl">{title}</h1>
        <p className="text-sm text-gray-500">{message}</p>
      </div>
    </div>
  );
}

// Internal deep-link resolver. Requires a valid Outlander login (JWT with an
// @outlandermag.com email); on success it redirects straight into the project.
export default async function ProductionSharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const viewer = await resolveSession((await cookies()).get("auth_token")?.value);
  const email = viewer?.email ?? "";

  if (!email) {
    redirect(`/login?next=${encodeURIComponent(`/production/share/${token}`)}`);
  }

  if (!email.toLowerCase().endsWith(OUTLANDER_DOMAIN)) {
    return (
      <Notice
        title="Access restricted"
        message="This internal link is only available to Outlander staff."
      />
    );
  }

  const link = token
    ? await prisma.productionShareLink.findUnique({ where: { token } })
    : null;

  if (!link || (link.expiresAt && link.expiresAt.getTime() < Date.now())) {
    return (
      <Notice
        title="Link not available"
        message="This internal link is invalid or has expired. Ask the project owner for a fresh link."
      />
    );
  }

  redirect(`/production/${link.productionId}`);
}
