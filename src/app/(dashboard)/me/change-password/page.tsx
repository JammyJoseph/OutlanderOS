import type { Metadata } from "next";
import { cookies } from "next/headers";
import { AuthShell } from "@/components/auth/AuthShell";
import ChangePasswordForm from "./ChangePasswordForm";

export const metadata: Metadata = { title: "Change password · Outlander OS" };

// Two different situations share this screen, and it used to treat both as the
// first one:
//
//   forced     a new starter, or somebody an admin has just given a temporary
//              password. The proxy holds them here until they choose their
//              own, so it is shown full-screen with nowhere else to click.
//   voluntary  an existing member changing their password from Settings. It
//              sits inside the app like any other page.
//
// The old page greeted both with "Welcome to OutlanderOS, set your new password
// to get started", which is wrong for anyone who has been here a year.
export default async function ChangePasswordPage() {
  const forced = (await cookies()).get("must_change_pw")?.value === "1";

  if (forced) {
    return (
      <AuthShell>
        <ChangePasswordForm forced />
      </AuthShell>
    );
  }
  return (
    <div className="px-6 py-10 sm:px-10">
      <div className="w-full max-w-[400px]">
        <ChangePasswordForm forced={false} />
      </div>
    </div>
  );
}
