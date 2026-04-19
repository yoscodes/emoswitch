import { redirect } from "next/navigation";

/** @deprecated `/vault` へ移行しました */
export default function LegacyArchivePage() {
  redirect("/vault");
}
