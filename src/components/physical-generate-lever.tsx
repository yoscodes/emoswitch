"use client";

import { motion } from "framer-motion";
import { Zap } from "lucide-react";

import { cn } from "@/lib/utils";

type Props = {
  disabled: boolean;
  loading: boolean;
  onPull: () => void;
  accentClass: string;
  energy?: number;
  glowColor?: string;
  title?: string;
  subtitle?: string;
};

/** 物理レバー風のメインCTA（押下で Web Audio と連動） */
export function PhysicalGenerateLever({
  disabled,
  loading,
  onPull,
  accentClass,
  energy = 0.7,
  glowColor = "255, 255, 255",
  title = "レバーを引く",
  subtitle = "3案＋ハッシュタグを同時に用意します",
}: Props) {
  const clampedEnergy = Math.min(Math.max(energy, 0), 1);

  return (
    <div className="relative flex flex-col items-center gap-3">
      <div className="pointer-events-none absolute inset-x-0 top-3 -bottom-4 -z-10">
        <div
          className="absolute left-1/2 top-6 h-28 w-11/12 max-w-lg rounded-full blur-3xl transition-all duration-500 ease-out"
          style={{
            backgroundColor: `rgba(${glowColor}, ${0.12 + clampedEnergy * 0.22})`,
            transform: `translateX(-50%) scale(${0.9 + clampedEnergy * 0.24})`,
          }}
        />
      </div>
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
        style={{
          boxShadow: `0 8px 0 rgba(0, 0, 0, 0.12), 0 0 ${16 + clampedEnergy * 28}px rgba(${glowColor}, ${0.16 + clampedEnergy * 0.16})`,
        }}
      >
        <div
          className="pointer-events-none absolute inset-x-8 bottom-0 h-10 rounded-full blur-2xl transition-all duration-500 ease-out"
          style={{
            backgroundColor: `rgba(${glowColor}, ${0.14 + clampedEnergy * 0.12})`,
            transform: `scale(${0.92 + clampedEnergy * 0.18})`,
          }}
        />
        <div className="pointer-events-none absolute inset-0 bg-linear-to-r from-white/25 to-transparent opacity-60" />
        <div
          className="pointer-events-none absolute inset-y-0 left-0 bg-white/15 transition-all duration-500 ease-out"
          style={{ width: `${22 + clampedEnergy * 32}%` }}
        />
        <div className="relative z-10 flex flex-col gap-1">
          <span className="text-lg font-bold tracking-tight text-white drop-shadow-sm">
            {loading ? "生成中…" : title}
          </span>
          <span className="text-xs font-medium text-white/85">
            {subtitle}
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
