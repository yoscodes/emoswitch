import { redirect } from "next/navigation";

export default function IdentityGhostLegacyRedirect() {
  redirect("/settings/ghost");
}
