import { cookies } from "next/headers";
import { redirect } from "next/navigation";

// The dashboard is the homepage — send people straight there (or to login).
export default async function RootPage() {
  const cookieStore = await cookies();
  redirect(cookieStore.has("auth_token") ? "/me" : "/login");
}
