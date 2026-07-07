import type { Metadata } from "next";
import prisma from "@/lib/prisma";
import { applyLegacyNotesShim } from "@/lib/call-sheet-legacy";
import { buildPublicViewData } from "../buildPublicViewData";
import { PublicCallSheetView } from "./PublicCallSheetView";

export const metadata: Metadata = {
  title: "Call Sheet — Outlander",
};

function NotAvailable() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <p className="text-sm font-extrabold tracking-[0.3em] uppercase text-gray-900 mb-6">
          Outlander
        </p>
        <h1 className="text-lg font-semibold text-gray-900 mb-2">Call sheet not available</h1>
        <p className="text-sm text-gray-500">
          This link is invalid or the call sheet is no longer published. Ask the
          production team for an updated link.
        </p>
      </div>
    </div>
  );
}

// Public, token-gated call sheet for crew and talent. No login required —
// the proxy allowlists /call-sheet/ and the unguessable token is the only key.
export default async function PublicCallSheetPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const raw = token
    ? await prisma.callSheet.findUnique({
        where: { shareToken: token },
        include: {
          production: {
            select: {
              id: true,
              title: true,
              clientName: true,
              figmaUrl: true,
              campaign: { select: { client: { select: { name: true } } } },
              prodDeliverables: {
                select: { type: true, title: true, notes: true },
                orderBy: { createdAt: "asc" },
              },
            },
          },
        },
      })
    : null;

  if (!raw || raw.status !== "PUBLISHED") return <NotAvailable />;

  const sheet = applyLegacyNotesShim(raw);
  const viewData = buildPublicViewData(sheet);

  return <PublicCallSheetView viewData={viewData} token={token} />;
}
