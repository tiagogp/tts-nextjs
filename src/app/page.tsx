import { redirect } from "next/navigation";

// The marketing landing now lives in the separate `apps/landing` workspace.
// The desktop app opens straight into the workspace.
export default function Home() {
  redirect("/app");
}
