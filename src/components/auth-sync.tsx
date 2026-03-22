"use client";

import { useAuthSession } from "@/lib/use-auth-session";

export function AuthSync() {
  useAuthSession();
  return null;
}
