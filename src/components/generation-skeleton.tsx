"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

const MESSAGES = [
  "文を研磨しています…",
  "ニュアンスを3つに分けています…",
  "ハッシュタグを探しています…",
  "あなたの本音に、刃を立てています…",
];

export function GenerationSkeleton() {
  const [i, setI] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      setI((n) => (n + 1) % MESSAGES.length);
    }, 1800);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="space-y-4 py-2">
      <motion.p
        key={MESSAGES[i]}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center text-sm font-medium text-muted-foreground"
      >
        {MESSAGES[i]}
      </motion.p>
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((k) => (
          <div
            key={k}
            className="flex h-28 flex-col justify-end rounded-2xl border border-dashed bg-muted/30 p-3"
          >
            <div className="space-y-2">
              <motion.div
                className="h-3 rounded-full bg-muted"
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: k * 0.15 }}
              />
              <motion.div
                className="h-3 w-4/5 rounded-full bg-muted"
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: k * 0.15 + 0.1 }}
              />
              <motion.div
                className="h-3 w-3/5 rounded-full bg-muted"
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: k * 0.15 + 0.2 }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
