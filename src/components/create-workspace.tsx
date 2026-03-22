"use client";

import { useCallback, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, Check, Copy, Heart, Palette, Sparkles, Swords } from "lucide-react";

import { EmotionDial } from "@/components/emotion-dial";
import { GenerationSkeleton } from "@/components/generation-skeleton";
import { PhysicalGenerateLever } from "@/components/physical-generate-lever";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { CHAMELEON } from "@/lib/chameleon";
import type { EmotionTone } from "@/lib/emotions";
import { saveGeneration, updateGeneration } from "@/lib/generation-storage";
import { loadGhostSettings } from "@/lib/ghost-storage";
import { playSwitchClick } from "@/lib/switch-sound";
import { cn } from "@/lib/utils";

const toneOptions = [
  { id: "empathy" as const, icon: <Heart className="size-5" /> },
  { id: "toxic" as const, icon: <Swords className="size-5" /> },
  { id: "mood" as const, icon: <Palette className="size-5" /> },
  { id: "useful" as const, icon: <BookOpen className="size-5" /> },
  { id: "minimal" as const, icon: <Sparkles className="size-5" /> },
];

type TripleResponse = {
  variants: string[];
  hashtags: string[];
  adviceHint?: string;
};

export function CreateWorkspace() {
  const [draft, setDraft] = useState("");
  const [emotion, setEmotion] = useState<EmotionTone>("empathy");
  const [intensity, setIntensity] = useState(70);
  const [speedMode, setSpeedMode] = useState<"flash" | "pro">("flash");
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [variants, setVariants] = useState<string[]>([]);
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [adviceHint, setAdviceHint] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [currentId, setCurrentId] = useState<string | null>(null);

  const chameleon = CHAMELEON[emotion];

  const handleUploadAudio = async (file: File) => {
    setUploading(true);
    const formData = new FormData();
    formData.append("audio", file);
    try {
      const response = await fetch("/api/transcribe", { method: "POST", body: formData });
      const data: { text?: string; error?: string } = await response.json();
      if (!response.ok) throw new Error(data.error ?? "文字起こしエラー");
      const transcriptText = data.text ?? "";
      if (transcriptText) {
        setDraft((prev) => (prev ? `${prev}\n${transcriptText}` : transcriptText));
      }
    } finally {
      setUploading(false);
    }
  };

  const runGenerate = useCallback(async () => {
    if (!draft.trim()) return;
    setError(null);
    setLoading(true);
    setVariants([]);
    setHashtags([]);
    setAdviceHint(null);
    setSelectedIndex(null);
    setCurrentId(null);
    playSwitchClick();

    const ghost = loadGhostSettings();
    try {
      const response = await fetch("/api/generate-triple", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draft: draft.trim(),
          emotion,
          speedMode,
          intensity,
          ngWords: ghost.ngWords,
        }),
      });
      const data = (await response.json()) as TripleResponse & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "生成に失敗しました");

      setVariants(data.variants);
      setHashtags(data.hashtags);
      setAdviceHint(data.adviceHint ?? null);

      const row = saveGeneration({
        draft: draft.trim(),
        emotion,
        intensity,
        variants: data.variants,
        hashtags: data.hashtags,
        selectedIndex: null,
        likes: null,
        adviceHint: data.adviceHint ?? null,
      });
      setCurrentId(row.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラー");
    } finally {
      setLoading(false);
    }
  }, [draft, emotion, intensity, speedMode]);

  const selectVariant = (index: number) => {
    setSelectedIndex(index);
    if (currentId) {
      updateGeneration(currentId, { selectedIndex: index });
    }
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      className={cn(
        "min-h-[calc(100vh-4rem)] transition-[background] duration-700 ease-out",
        chameleon.shell,
      )}
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-8 pb-28 md:px-6">
        <header className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            <span className="font-semibold text-foreground">① 素材</span>
            <span className="mx-2">→</span>
            <span className="font-semibold text-foreground">② スイッチ</span>
            <span className="mx-2">→</span>
            <span className="font-semibold text-foreground">③ レバー</span>
            <span className="mx-2">で完成</span>
          </p>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">いまの本音を、刺さる形に変換</h1>
        </header>

        <Card className="border-0 bg-card/80 shadow-xl backdrop-blur-md">
          <CardContent className="space-y-6 p-6">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">素材（テキスト）</p>
                <Badge variant="secondary" className="text-xs">
                  Whisper 音声OK
                </Badge>
              </div>
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="例: 頑張ってるのに結果が出ない。反応も鈍くてしんどい。"
                className="min-h-[140px] resize-y text-base"
              />
              <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
                <span className="rounded-lg border bg-muted/50 px-2 py-1">音声をアップロード</span>
                <input
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleUploadAudio(file);
                  }}
                />
                {uploading ? "文字起こし中…" : "独り言をテキスト化"}
              </label>
            </div>

            <EmotionDial
              options={toneOptions}
              value={emotion}
              onChange={setEmotion}
              accentRing={chameleon.ring}
            />

            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <p className="font-medium">テンション強度</p>
                <span className={cn("tabular-nums", chameleon.accentFg)}>{intensity}%</span>
              </div>
              <Slider
                value={[intensity]}
                min={0}
                max={100}
                step={5}
                onValueChange={(value) =>
                  setIntensity(Array.isArray(value) ? (value[0] ?? 70) : value)
                }
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">モデル</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSpeedMode((p) => (p === "flash" ? "pro" : "flash"))}
              >
                Gemini 1.5 {speedMode === "flash" ? "Flash（速い）" : "Pro（深い）"}
              </Button>
            </div>

            <PhysicalGenerateLever
              disabled={!draft.trim() || uploading}
              loading={loading}
              onPull={runGenerate}
              accentClass={cn(chameleon.accent, "text-white")}
            />

            {error ? <p className="text-center text-sm text-destructive">{error}</p> : null}

            <AnimatePresence mode="wait">
              {loading ? (
                <motion.div
                  key="sk"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <GenerationSkeleton />
                </motion.div>
              ) : null}
            </AnimatePresence>

            {!loading && variants.length === 3 ? (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <p className="text-sm font-medium">3案から「これだ！」を選ぶ</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  {variants.map((text, idx) => {
                    const picked = selectedIndex === idx;
                    return (
                      <motion.button
                        key={idx}
                        type="button"
                        layout
                        onClick={() => selectVariant(idx)}
                        className={cn(
                          "rounded-2xl border-2 bg-background/90 p-4 text-left text-sm leading-relaxed shadow-sm transition-all hover:shadow-md",
                          picked ? cn("ring-2 ring-offset-2", chameleon.ring) : "border-border",
                        )}
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.99 }}
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <Badge variant="outline">案 {idx + 1}</Badge>
                          {picked ? (
                            <Check className="size-4 text-green-600" />
                          ) : null}
                        </div>
                        <p className="min-h-[4.5rem] text-foreground">{text}</p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="mt-2 h-8 px-2 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            void copyText(text);
                          }}
                        >
                          <Copy className="mr-1 size-3" />
                          コピー
                        </Button>
                      </motion.button>
                    );
                  })}
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">ハッシュタグ（提案）</p>
                  <div className="flex flex-wrap gap-2">
                    {hashtags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => void copyText(tag)}
                        className={cn(
                          "rounded-full border bg-muted/50 px-3 py-1 text-xs font-medium transition-colors hover:bg-muted",
                          chameleon.accentFg,
                        )}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                {adviceHint ? (
                  <p className="rounded-xl border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
                    💡 {adviceHint}
                  </p>
                ) : null}
              </motion.div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
