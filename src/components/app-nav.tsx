"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Archive, Fingerprint, Home, Zap } from "lucide-react";
import { motion } from "framer-motion"; // アニメーション用

import { AuthActions } from "@/components/auth-actions";
import { CreditStatus } from "@/components/credit-status";
import { cn } from "@/lib/utils";

const links = [
  { href: "/lab", label: "種", icon: Home },
  { href: "/vault", label: "反応", icon: Archive },
  { href: "/identity", label: "Identity", icon: Fingerprint },
] as const;

export function AppNav() {
  const pathname = usePathname();

  // 本来はContextなどで現在のモード色を取得しますが、
  // ここでは例としてCSS変数 --mode-color を参照するようにします。
  // (デフォルトは共感のピンク: #ff4b91 などを想定)

  return (
    <nav 
      className={cn(
        "fixed z-50 transition-all duration-500 ease-in-out",
        // モバイル: フローティングドック風
        "bottom-4 left-4 right-4 rounded-2xl border border-border/30 bg-background/45 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]",
        // デスクトップ: 上部固定のクリスタルヘッダー
        "md:bottom-auto md:top-0 md:left-0 md:right-0 md:rounded-none md:border-b md:border-border/25 md:border-t-0 md:bg-linear-to-b md:from-violet-100/35 md:via-fuchsia-50/15 md:to-background/95 dark:md:from-violet-950/30 dark:md:via-fuchsia-950/10 dark:md:to-background/90"
      )}
      style={{
        // 選択中の色を影やボーダーに反映（CSS変数を活用）
        boxShadow: "0 -4px 20px -10px var(--mode-color, rgba(255,255,255,0.1))",
        borderColor: "var(--mode-color, rgba(255,255,255,0.1))",
      }}
    >
      {/* 動的な発光ライン（デスクトップのみ）
          現在のモードの色に合わせてヘッダー下部が光る
      */}
      <div 
        className="absolute bottom-0 left-0 hidden h-px w-full bg-linear-to-r from-transparent via-(--mode-color,transparent) to-transparent opacity-50 md:block" 
      />

      <div className="mx-auto flex w-full max-w-[1800px] items-center justify-between gap-2 px-4 py-2 md:grid md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:px-6 md:py-3">
        
        {/* ロゴ部分：Zapアイコンを光らせる */}
        <Link
          href="/"
          className="group flex items-center gap-2 shrink-0 text-sm font-bold tracking-tighter md:col-start-1 md:text-lg"
        >
          <div className="rounded-lg bg-primary/10 p-1 transition-colors group-hover:bg-primary/20">
            <Zap className="size-4 text-(--mode-color,white) fill-(--mode-color,transparent)" />
          </div>
          <span className="bg-linear-to-r from-foreground to-foreground/60 bg-clip-text text-transparent">
            Identity DNA
          </span>
        </Link>
        <div className="flex items-center gap-2 md:hidden">
          <CreditStatus compact />
          <AuthActions compact />
        </div>

        {/* ナビゲーション */}
        <ul className="flex flex-1 justify-around md:col-start-2 md:row-start-1 md:flex-none md:justify-center md:gap-2 relative">
          {links.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <li key={href} className="relative">
                <Link
                  href={href}
                  className={cn(
                    "relative flex flex-col items-center gap-1 px-3 py-1.5 text-[10px] font-medium transition-colors md:flex-row md:gap-2 md:px-4 md:py-2 md:text-sm z-10",
                    active
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className={cn("size-5 md:size-4", active && "animate-pulse")} />
                  <span className="md:inline">{label}</span>

                  {/* 磁石のようなアクティブインジケーター */}
                  {active && (
                    <motion.div
                      layoutId="nav-pill"
                      className="absolute inset-0 -z-10 rounded-xl border border-violet-400/25 bg-violet-500/12 shadow-[0_0_24px_-12px_rgba(124,58,237,0.45)] dark:border-violet-500/30 dark:bg-violet-500/14"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* クレジット表示 */}
        <div className="hidden items-center gap-3 md:col-start-3 md:flex md:justify-end">
          <CreditStatus />
          <AuthActions />
        </div>
      </div>
    </nav>
  );
}