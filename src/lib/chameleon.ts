import type { EmotionTone } from "@/lib/emotions";

/** カメレオンUI: 背景グラデーション + アクセント（ライト/ダーク両対応） */
export const CHAMELEON: Record<
  EmotionTone,
  {
    /** メイン画面ラッパー用（Tailwind 全文） */
    shell: string;
    accent: string;
    accentFg: string;
    ring: string;
  }
> = {
  empathy: {
    shell:
      "bg-gradient-to-br from-pink-200/90 via-rose-100/70 to-background dark:from-pink-950/50 dark:via-rose-950/40 dark:to-background",
    accent: "bg-pink-500",
    accentFg: "text-pink-700 dark:text-pink-200",
    ring: "ring-pink-400/50",
  },
  toxic: {
    shell:
      "bg-gradient-to-br from-red-200/90 via-orange-100/70 to-background dark:from-red-950/55 dark:via-orange-950/35 dark:to-background",
    accent: "bg-red-600",
    accentFg: "text-red-700 dark:text-red-300",
    ring: "ring-red-500/50",
  },
  mood: {
    shell:
      "bg-gradient-to-br from-violet-300/80 via-indigo-200/70 to-background dark:from-violet-950/55 dark:via-indigo-950/45 dark:to-background",
    accent: "bg-violet-600",
    accentFg: "text-violet-700 dark:text-violet-200",
    ring: "ring-violet-500/50",
  },
  useful: {
    shell:
      "bg-gradient-to-br from-cyan-200/85 via-sky-100/70 to-background dark:from-cyan-950/45 dark:via-sky-950/40 dark:to-background",
    accent: "bg-cyan-600",
    accentFg: "text-cyan-800 dark:text-cyan-200",
    ring: "ring-cyan-500/50",
  },
  minimal: {
    shell:
      "bg-gradient-to-br from-zinc-200/80 via-stone-100/60 to-background dark:from-zinc-900/70 dark:via-stone-900/50 dark:to-background",
    accent: "bg-zinc-700",
    accentFg: "text-zinc-800 dark:text-zinc-200",
    ring: "ring-zinc-500/40",
  },
};
