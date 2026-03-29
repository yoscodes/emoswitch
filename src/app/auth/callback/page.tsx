"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { migrateCurrentLocalDataAfterLogin } from "@/lib/api-client";
import { supabase } from "@/lib/supabase/client";

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/home";

  useEffect(() => {
    let active = true;
    let completed = false;
    let timeoutId: number | undefined;
    let unsubscribe: (() => void) | undefined;

    const finishLogin = async () => {
      if (!active || completed) return;
      completed = true;
      await migrateCurrentLocalDataAfterLogin();
      router.replace(next);
    };

    void (async () => {
      try {
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            throw exchangeError;
          }
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session) {
          await finishLogin();
          return;
        }

        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, nextSession) => {
          if (nextSession) {
            void finishLogin();
          }
        });
        unsubscribe = () => subscription.unsubscribe();

        timeoutId = window.setTimeout(() => {
          if (active && !completed) {
            setError("ログインセッションを確立できませんでした。");
          }
        }, 4000);
      } catch (e) {
        if (active) {
          setError(e instanceof Error ? e.message : "ログイン処理に失敗しました");
        }
      }
    })();

    return () => {
      active = false;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      unsubscribe?.();
    };
  }, [code, next, router]);

  return (
    <div className="flex min-h-dvh items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl border bg-background p-6 text-center shadow-sm">
        <p className="text-sm font-medium">{error ? "ログインに失敗しました" : "Google ログインを完了しています..."}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {error ?? "認証後、自動で作成画面に戻ります。"}
        </p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center px-6">
          <div className="w-full max-w-md rounded-2xl border bg-background p-6 text-center shadow-sm">
            <p className="text-sm font-medium">Google ログインを完了しています...</p>
            <p className="mt-2 text-sm text-muted-foreground">認証後、自動で作成画面に戻ります。</p>
          </div>
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
