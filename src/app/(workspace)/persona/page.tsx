import { redirect } from "next/navigation";

/** @deprecated `/identity` へ移行しました */
export default function LegacyPersonaPage() {
  redirect("/identity");
}
