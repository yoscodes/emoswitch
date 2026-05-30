"use client";

import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";

import { notifyDataSync } from "@/lib/api-client";
import { supabase } from "@/lib/supabase/client";

type AuthSessionState = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  signInWithGoogle: (nextPath?: string) => Promise<void>;
  signOut: () => Promise<void>;
};

/** Supabase DB 停止・再起動などで refresh token 参照が失敗したとき */
function isRecoverableAuthBackendError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("refresh token") ||
    normalized.includes("sqlstate") ||
    normalized.includes("terminating connection") ||
    normalized.includes("failed to fetch") ||
    normalized.includes("network")
  );
}

async function clearLocalAuthSession(): Promise<void> {
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // サーバー到達不能でもローカル状態だけは落とす
  }
}

export function useAuthSession(): AuthSessionState {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    void supabase.auth.getSession().then(async ({ data, error }) => {
      if (!active) return;

      if (error) {
        if (isRecoverableAuthBackendError(error.message)) {
          console.warn("[auth] セッション復元に失敗しました。ローカルログイン状態をクリアします。", error.message);
          await clearLocalAuthSession();
        } else {
          console.error("[auth] セッション取得エラー:", error.message);
        }
        setSession(null);
        setLoading(false);
        return;
      }

      setSession(data.session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === "TOKEN_REFRESHED" || event === "SIGNED_IN" || event === "SIGNED_OUT") {
        setSession(nextSession);
        setLoading(false);
        notifyDataSync();
        return;
      }

      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = async (nextPath = "/lab") => {
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;
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
    if (error && !isRecoverableAuthBackendError(error.message)) {
      throw error;
    }
    setSession(null);
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
