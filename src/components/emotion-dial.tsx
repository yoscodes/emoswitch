"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { EMOTION_LABELS, type EmotionTone } from "@/lib/emotions";
import { playDialTick } from "@/lib/switch-sound";
import { cn } from "@/lib/utils";

type ToneOption = {
  id: EmotionTone;
  icon: ReactNode;
};

type Props = {
  options: ToneOption[];
  value: EmotionTone;
  onChange: (next: EmotionTone) => void;
  accentRing: string;
};

export function EmotionDial({ options, value, onChange, accentRing }: Props) {
  return (
    <div className="relative">
      <p className="mb-3 text-center text-xs font-medium uppercase tracking-widest text-muted-foreground">
        感情ダイヤル（タップでカチッ）
      </p>
      <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
        {options.map((opt) => {
          const active = opt.id === value;
          return (
            <motion.div key={opt.id} whileTap={{ scale: 0.96 }}>
              <Button
                type="button"
                variant={active ? "default" : "outline"}
                size="lg"
                className={cn(
                  "relative h-14 min-w-[4.5rem] flex-col gap-0.5 rounded-2xl px-3 shadow-sm transition-all",
                  active && `ring-2 ring-offset-2 ring-offset-background ${accentRing}`,
                )}
                onClick={() => {
                  playDialTick();
                  onChange(opt.id);
                }}
              >
                <span className="[&>svg]:size-5">{opt.icon}</span>
                <span className="text-[10px] font-semibold leading-none sm:text-xs">
                  {EMOTION_LABELS[opt.id]}
                </span>
              </Button>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
