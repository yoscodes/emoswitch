"use client";

import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";

import { notifyDataSync } from "@/lib/api-client";
import { supabase } from "@/lib/supabase/client";

type AuthSessionState = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

export function useAuthSession(): AuthSessionState {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
      notifyDataSync();
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = async () => {
    const redirectTo = `${window.location.origin}/auth/callback`;
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });

    if (error) {
      throw error;
    }

    if (data.url) {
      window.location.assign(data.url);
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }
    notifyDataSync();
  };

  return {
    loading,
    session,
    user: session?.user ?? null,
    signInWithGoogle,
    signOut,
  };
}
