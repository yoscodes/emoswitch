"use client";

import { useEffect } from "react";

import { useAuthSession } from "@/lib/use-auth-session";

export function AuthSync() {
  useAuthSession();

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    void navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => {
        void registration.unregister();
      });
    });
  }, []);

  return null;
}
