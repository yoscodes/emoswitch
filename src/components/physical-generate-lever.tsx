"use client";

import { motion } from "framer-motion";
import { Zap } from "lucide-react";

import { cn } from "@/lib/utils";

type Props = {
  disabled: boolean;
  loading: boolean;
  onPull: () => void;
  accentClass: string;
};

/** 物理レバー風のメインCTA（押下で Web Audio と連動） */
export function PhysicalGenerateLever({ disabled, loading, onPull, accentClass }: Props) {
  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-xs text-muted-foreground">下のレバーを引くと生成開始</p>
      <motion.button
        type="button"
        disabled={disabled || loading}
        whileTap={disabled || loading ? undefined : { y: 4 }}
        onClick={onPull}
        className={cn(
          "group relative flex w-full max-w-md items-center justify-between overflow-hidden rounded-3xl border-2 border-black/10 px-6 py-5 text-left shadow-[0_8px_0_rgb(0,0,0,0.12)] transition-all dark:border-white/10 dark:shadow-[0_8px_0_rgb(255,255,255,0.06)]",
          "disabled:cursor-not-allowed disabled:opacity-50",
          accentClass,
        )}
      >
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/25 to-transparent opacity-60" />
        <div className="relative z-10 flex flex-col gap-1">
          <span className="text-lg font-bold tracking-tight text-white drop-shadow-sm">
            {loading ? "生成中…" : "レバーを引く"}
          </span>
          <span className="text-xs font-medium text-white/85">
            3案＋ハッシュタグを同時に用意します
          </span>
        </div>
        <div className="relative z-10 flex size-14 items-center justify-center rounded-2xl bg-white/20 text-white shadow-inner backdrop-blur-sm">
          <motion.span
            animate={loading ? { rotate: [0, 12, -12, 0] } : {}}
            transition={{ repeat: loading ? Infinity : 0, duration: 0.8 }}
          >
            <Zap className="size-7" strokeWidth={2.5} />
          </motion.span>
        </div>
      </motion.button>
    </div>
  );
}
