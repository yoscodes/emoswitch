"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, Check, Copy, Ghost, Heart, Palette, Sparkles, Swords } from "lucide-react";

import { EmotionDial } from "@/components/emotion-dial";
import { GenerationSkeleton } from "@/components/generation-skeleton";
import { PhysicalGenerateLever } from "@/components/physical-generate-lever";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import {
  ensureDemoWorkspace,
  fetchCreditSummary,
  fetchGhostSettings,
  generateTriple,
  type GenerateSeriesItem,
  type GenerateSeriesResponse,
  type GenerateSingleResponse,
  fetchUserProfile,
  patchGenerationRecord,
  saveGenerationRecord,
  updateGhostSettings,
} from "@/lib/api-client";
import { CHAMELEON } from "@/lib/chameleon";
import type { EmotionTone } from "@/lib/emotions";
import { parseEmotionFromQuery, readAndClearReuseSession } from "@/lib/reuse-session";
import { SERIES_SLOT_CONFIG } from "@/lib/series";
import { playSwitchClick } from "@/lib/switch-sound";
import { cn } from "@/lib/utils";

const toneOptions = [
  { id: "empathy" as const, icon: <Heart className="size-5" /> },
  { id: "toxic" as const, icon: <Swords className="size-5" /> },
  { id: "mood" as const, icon: <Palette className="size-5" /> },
  { id: "useful" as const, icon: <BookOpen className="size-5" /> },
  { id: "minimal" as const, icon: <Sparkles className="size-5" /> },
];

type SingleResult = GenerateSingleResponse;
type SeriesResult = GenerateSeriesResponse;

export function CreateWorkspace() {
  const router = useRouter();
  const hasAppliedInitialOverridesRef = useRef(false);
  const [draft, setDraft] = useState("");
  const [generationMode, setGenerationMode] = useState<"single" | "series">("single");
  const [emotion, setEmotion] = useState<EmotionTone>("empathy");
  const [intensity, setIntensity] = useState(70);
  const [speedMode, setSpeedMode] = useState<"flash" | "pro">("flash");
  const [stylePrompt, setStylePrompt] = useState("");
  const [savedStylePrompt, setSavedStylePrompt] = useState("");
  const [ghostProfileUrl, setGhostProfileUrl] = useState("");
  const [ghostNgWords, setGhostNgWords] = useState<string[]>([]);
  const [ghostLoaded, setGhostLoaded] = useState(false);
  const [styleOpen, setStyleOpen] = useState(false);
  const [styleSaving, setStyleSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [variants, setVariants] = useState<string[]>([]);
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [seriesTitle, setSeriesTitle] = useState("");
  const [seriesItems, setSeriesItems] = useState<GenerateSeriesItem[]>([]);
  const [adviceHint, setAdviceHint] = useState<string | null>(null);
  const [ghostWhisper, setGhostWhisper] = useState<string | null>(null);
  const [memoryTags, setMemoryTags] = useState<string[]>([]);
  const [resultMode, setResultMode] = useState<"single" | "series">("single");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [currentId, setCurrentId] = useState<string | null>(null);

  const chameleon = CHAMELEON[emotion];

  useEffect(() => {
    if (hasAppliedInitialOverridesRef.current) return;

    const fromSession = readAndClearReuseSession();
    if (fromSession) {
      hasAppliedInitialOverridesRef.current = true;
      setDraft(fromSession.draft);
      setEmotion(fromSession.emotion);
      setIntensity(fromSession.intensity);
      setSpeedMode(fromSession.speedMode);
      router.replace("/home", { scroll: false });
      return;
    }
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const qEmotion = parseEmotionFromQuery(sp.get("emotion"));
    const qIntensity = sp.get("intensity");
    const qSpeed = sp.get("speed");
    const qDraft = sp.get("draft");
    let changed = false;
    if (qEmotion) {
      setEmotion(qEmotion);
      changed = true;
    }
    if (qIntensity != null && qIntensity !== "") {
      const n = Number.parseInt(qIntensity, 10);
      if (!Number.isNaN(n) && n >= 0 && n <= 100) {
        setIntensity(n);
        changed = true;
      }
    }
    if (qSpeed === "flash" || qSpeed === "pro") {
      setSpeedMode(qSpeed);
      changed = true;
    }
    if (qDraft != null && qDraft !== "") {
      try {
        setDraft(decodeURIComponent(qDraft));
        changed = true;
      } catch {
        /* ignore */
      }
    }
    if (changed) {
      hasAppliedInitialOverridesRef.current = true;
      router.replace("/home", { scroll: false });
      return;
    }

    void ensureDemoWorkspace()
      .then(() => fetchUserProfile())
      .then((profile) => {
        setEmotion(profile.defaultEmotion);
      })
      .catch(() => undefined);
  }, [router]);

  useEffect(() => {
    void ensureDemoWorkspace();
  }, []);

  useEffect(() => {
    void ensureDemoWorkspace()
      .then(() => fetchGhostSettings())
      .then((ghost) => {
        setGhostProfileUrl(ghost.profileUrl);
        setGhostNgWords(ghost.ngWords);
        setStylePrompt(ghost.stylePrompt);
        setSavedStylePrompt(ghost.stylePrompt);
        setStyleOpen(ghost.stylePrompt.trim() !== "");
        setGhostLoaded(true);
      })
      .catch(() => undefined);
  }, []);

  const persistStylePrompt = useCallback(async () => {
    if (!ghostLoaded) return;

    const trimmedStylePrompt = stylePrompt.trim();
    if (trimmedStylePrompt === savedStylePrompt.trim()) return;

    setStyleSaving(true);
    try {
      const savedGhost = await updateGhostSettings({
        profileUrl: ghostProfileUrl,
        ngWords: ghostNgWords,
        stylePrompt: trimmedStylePrompt,
      });
      setGhostProfileUrl(savedGhost.profileUrl);
      setGhostNgWords(savedGhost.ngWords);
      setStylePrompt(savedGhost.stylePrompt);
      setSavedStylePrompt(savedGhost.stylePrompt);
    } catch (e) {
      setError(e instanceof Error ? e.message : "文体指定の保存に失敗しました");
    } finally {
      setStyleSaving(false);
    }
  }, [ghostLoaded, ghostNgWords, ghostProfileUrl, savedStylePrompt, stylePrompt]);

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
    setSeriesTitle("");
    setSeriesItems([]);
    setAdviceHint(null);
    setGhostWhisper(null);
    setMemoryTags([]);
    setResultMode(generationMode);
    setSelectedIndex(null);
    setCurrentId(null);
    playSwitchClick();

    try {
      await ensureDemoWorkspace();
      const [ghost, credit] = await Promise.all([fetchGhostSettings(), fetchCreditSummary()]);
      if (credit.remaining <= 0) {
        throw new Error("クレジットが残っていません。");
      }

      const data = await generateTriple({
        draft: draft.trim(),
        generationMode,
        emotion,
        speedMode,
        intensity,
        ngWords: ghost.ngWords,
        stylePrompt: stylePrompt.trim(),
      });

      if ("seriesTitle" in data) {
        const seriesData = data as SeriesResult;
        setSeriesTitle(seriesData.seriesTitle);
        setSeriesItems(seriesData.items);
        setAdviceHint(seriesData.adviceHint ?? null);
        setGhostWhisper(seriesData.ghostWhisper ?? null);
        setMemoryTags(seriesData.memoryTags ?? []);

        await saveGenerationRecord({
          generationMode: "series",
          title: seriesData.seriesTitle,
          draft: draft.trim(),
          emotion,
          intensity,
          speedMode,
          adviceHint: seriesData.adviceHint ?? null,
          ghostWhisper: seriesData.ghostWhisper ?? null,
          quickFeedback: null,
          memoryTags: seriesData.memoryTags ?? [],
          items: seriesData.items,
        });
      } else {
        const singleData = data as SingleResult;
        setVariants(singleData.variants);
        setHashtags(singleData.hashtags);
        setAdviceHint(singleData.adviceHint ?? null);
        setGhostWhisper(singleData.ghostWhisper ?? null);
        setMemoryTags(singleData.memoryTags ?? []);

        const row = await saveGenerationRecord({
          generationMode: "single",
          draft: draft.trim(),
          emotion,
          intensity,
          speedMode,
          variants: singleData.variants,
          hashtags: singleData.hashtags,
          selectedIndex: null,
          likes: null,
          memo: null,
          adviceHint: singleData.adviceHint ?? null,
          quickFeedback: null,
          memoryTags: singleData.memoryTags ?? [],
        });

        if (row.generationMode === "single") {
          setCurrentId(row.id);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラー");
    } finally {
      setLoading(false);
    }
  }, [draft, emotion, generationMode, intensity, speedMode, stylePrompt]);

  const selectVariant = (index: number) => {
    setSelectedIndex(index);
    if (currentId) {
      void patchGenerationRecord(currentId, { selectedIndex: index }).catch(() => undefined);
    }
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  };

  const copySeriesBundle = async () => {
    const bundle = seriesItems
      .map((item, index) => {
        const slot = SERIES_SLOT_CONFIG[index];
        const hashtagsLine = item.hashtags.length > 0 ? `\n${item.hashtags.join(" ")}` : "";
        return slot ? `${slot.day}: ${slot.title}（${slot.subtitle}）\n${item.body}${hashtagsLine}` : item.body;
      })
      .join("\n\n");
    await copyText(bundle);
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

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">感情スイッチ</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-expanded={styleOpen}
                  onClick={() => {
                    if (styleOpen) {
                      void persistStylePrompt();
                    }
                    setStyleOpen((open) => !open);
                  }}
                >
                  文体
                </Button>
              </div>
              <EmotionDial
                options={toneOptions}
                value={emotion}
                onChange={setEmotion}
                accentRing={chameleon.ring}
              />
              <AnimatePresence initial={false}>
                {styleOpen ? (
                  <motion.div
                    initial={{ opacity: 0, height: 0, y: -6 }}
                    animate={{ opacity: 1, height: "auto", y: 0 }}
                    exit={{ opacity: 0, height: 0, y: -6 }}
                    className="overflow-hidden"
                  >
                    <div className="rounded-2xl border bg-background/70 p-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium">ひとこと文体指定</p>
                          <span className="text-xs text-muted-foreground">
                            {styleSaving
                              ? "保存中..."
                              : stylePrompt.trim() === savedStylePrompt.trim()
                                ? "保存済み"
                                : "このまま生成に反映"}
                          </span>
                        </div>
                        <Textarea
                          value={stylePrompt}
                          onChange={(e) => setStylePrompt(e.target.value)}
                          onBlur={() => void persistStylePrompt()}
                          placeholder={
                            "例: 深夜の独り言風 / やさしいけれど甘すぎない / 語尾は「〜かも」を少し混ぜる"
                          }
                          className="min-h-24 text-sm"
                        />
                        <p className="text-xs text-muted-foreground">
                          感情ダイヤルが「どう感じるか」なら、文体は「誰として話すか」です。
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>

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

            <div className="rounded-2xl border bg-background/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium">生成モード</p>
                  <p className="text-xs text-muted-foreground">
                    連載モードなら、1回のレバー操作で月・水・金の3本をまとめて出します。
                  </p>
                </div>
                <div className="inline-flex rounded-xl border bg-muted/30 p-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={generationMode === "single" ? "default" : "ghost"}
                    onClick={() => setGenerationMode("single")}
                    className="rounded-lg"
                  >
                    単発モード
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={generationMode === "series" ? "default" : "ghost"}
                    onClick={() => setGenerationMode("series")}
                    className="rounded-lg"
                  >
                    連載モード
                  </Button>
                </div>
              </div>
              {generationMode === "series" ? (
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {SERIES_SLOT_CONFIG.map((slot) => (
                    <span key={slot.day} className="rounded-full border bg-background/80 px-3 py-1.5">
                      {slot.day}: {slot.title}（{slot.subtitle}）
                    </span>
                  ))}
                </div>
              ) : null}
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

            {!loading &&
            ((resultMode === "single" && variants.length === 3) || (resultMode === "series" && seriesItems.length === 3)) ? (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-medium">
                    {resultMode === "series"
                      ? "1週間分の構成案をまとめて生成"
                      : "3案から「これだ！」を選ぶ"}
                  </p>
                  {resultMode === "series" ? (
                    <Button type="button" size="sm" variant="outline" onClick={() => void copySeriesBundle()}>
                      <Copy className="mr-1 size-3" />
                      1週間分をコピー
                    </Button>
                  ) : null}
                </div>
                {ghostWhisper ? (
                  <div className="rounded-2xl border border-violet-200/70 bg-violet-50/70 p-3 text-sm text-violet-950 shadow-sm dark:border-violet-800/60 dark:bg-violet-950/30 dark:text-violet-100">
                    <div className="flex items-start gap-3">
                      <div className="rounded-full bg-violet-500/10 p-2 text-violet-600 dark:text-violet-300">
                        <Ghost className="size-4" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-wide text-violet-700/80 dark:text-violet-300/80">
                          ゴーストのささやき
                        </p>
                        <p className="leading-relaxed">{ghostWhisper}</p>
                      </div>
                    </div>
                  </div>
                ) : null}
                {memoryTags.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {memoryTags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="rounded-full">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                ) : null}
                {resultMode === "series" ? (
                  <div className="rounded-2xl border bg-muted/20 p-4">
                    <p className="text-sm font-medium text-muted-foreground">連載タイトル</p>
                    <p className="mt-1 text-lg font-semibold text-foreground">{seriesTitle}</p>
                  </div>
                ) : null}
                <div className="grid gap-3 sm:grid-cols-3">
                  {(resultMode === "series" ? seriesItems.map((item) => item.body) : variants).map((text, idx) => {
                    const picked = selectedIndex === idx;
                    const slot = SERIES_SLOT_CONFIG[idx];
                    const label =
                      resultMode === "series" && slot
                        ? `${slot.day} | ${slot.title}（${slot.subtitle}）`
                        : `案 ${idx + 1}`;

                    return resultMode === "series" ? (
                      <motion.div
                        key={idx}
                        layout
                        className="rounded-2xl border bg-background/90 p-4 text-left text-sm leading-relaxed shadow-sm transition-all hover:shadow-md"
                        whileHover={{ y: -2 }}
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <Badge variant="outline">{label}</Badge>
                        </div>
                        <p className="min-h-18 text-foreground">{text}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {(seriesItems[idx]?.hashtags ?? []).map((tag) => (
                            <Badge key={`${label}-${tag}`} variant="outline" className="rounded-full text-[11px]">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="mt-2 h-8 px-2 text-xs"
                          onClick={() => void copyText(text)}
                        >
                          <Copy className="mr-1 size-3" />
                          コピー
                        </Button>
                      </motion.div>
                    ) : (
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
                          <Badge variant="outline">{label}</Badge>
                          {picked ? (
                            <Check className="size-4 text-green-600" />
                          ) : null}
                        </div>
                        <p className="min-h-18 text-foreground">{text}</p>
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

                {resultMode === "single" ? (
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
                ) : null}

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
