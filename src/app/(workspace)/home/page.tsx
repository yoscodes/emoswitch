import { redirect } from "next/navigation";

/** @deprecated `/lab` へ移行しました */
export default function LegacyHomePage() {
  redirect("/lab");
}
