import { redirect } from "next/navigation";

/** App entry: subject list (localStorage-backed workspaces). */
export default function HomePage() {
  redirect("/subjects");
}
