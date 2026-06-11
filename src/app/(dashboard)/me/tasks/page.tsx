import { redirect } from "next/navigation";

// Tasks live on the dashboard now — the ACTION/TRACK panel is the task view.
export default function MyTasksPage() {
  redirect("/me");
}
