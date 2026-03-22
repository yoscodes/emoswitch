"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Copy, Trash2, Wand2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DATA_SYNC_EVENT,
  fetchGenerations,
  patchGenerationRecord,
  removeGenerationRecord,
} from "@/lib/api-client";
import { EMOTION_LABELS } from "@/lib/emotions";
import { writeReuseSession } from "@/lib/reuse-session";
import type { GenerationRecord } from "@/lib/types";

export function ArchivePanel() {
  const [rows, setRows] = useState<GenerationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      setRows(await fetchGenerations());
    } catch (e) {
      setError(e instanceof Error ? e.message : "履歴の取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onSync = () => {
      void refresh();
    };
    window.addEventListener(DATA_SYNC_EVENT, onSync);
    return () => window.removeEventListener(DATA_SYNC_EVENT, onSync);
  }, [refresh]);

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8 pb-28 md:px-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">アーカイブ</h1>
        <p className="text-muted-foreground">
          生成した3案のうちどれを採用したか、投稿後の反応をメモして、次の一手のヒントに使います。
        </p>
      </header>

      {loading ? (
        <ul className="space-y-4">
          {[0, 1, 2].map((item) => (
            <li key={item}>
              <ArchiveRowSkeleton />
            </li>
          ))}
        </ul>
      ) : error ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            まだ記録がありません。最初の投稿をしてみましょう。
            <Link href="/home" className="px-1 font-medium text-primary underline-offset-4 hover:underline">
              作成画面
            </Link>
            で3案を生成すると、ここに溜まります。
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-4">
          {rows.map((row) => (
            <motion.li
              key={row.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <ArchiveRow
                key={`${row.id}-${row.likes ?? "n"}-${row.memo ?? ""}`}
                row={row}
                onUpdate={refresh}
              />
            </motion.li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ArchiveRow({
  row,
  onUpdate,
}: {
  row: GenerationRecord;
  onUpdate: () => Promise<void> | void;
}) {
  const router = useRouter();
  const [likesInput, setLikesInput] = useState(
    () => (row.likes != null ? String(row.likes) : ""),
  );
  const [memoInput, setMemoInput] = useState(() => row.memo ?? "");
  const [likesSaved, setLikesSaved] = useState(false);
  const [memoSaved, setMemoSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const adoptedBody =
    row.selectedIndex != null && row.variants[row.selectedIndex]
      ? row.variants[row.selectedIndex]
      : null;
  const adoptedDisplay = adoptedBody ?? "未選択";

  const handleSaveLikes = () => {
    const n = likesInput.trim() === "" ? null : Number.parseInt(likesInput, 10);
    if (likesInput.trim() !== "" && Number.isNaN(n)) return;
    void patchGenerationRecord(row.id, { likes: n })
      .then(() => {
        setLikesSaved(true);
        setTimeout(() => setLikesSaved(false), 1500);
        void onUpdate();
      })
      .catch(() => undefined);
  };

  const handleSaveMemo = () => {
    const trimmed = memoInput.trim();
    void patchGenerationRecord(row.id, { memo: trimmed === "" ? null : trimmed })
      .then(() => {
        setMemoSaved(true);
        setTimeout(() => setMemoSaved(false), 1500);
        void onUpdate();
      })
      .catch(() => undefined);
  };

  const handleReuseSettings = () => {
    writeReuseSession({
      draft: row.draft,
      emotion: row.emotion,
      intensity: row.intensity,
      speedMode: row.speedMode ?? "flash",
    });
    router.push("/home");
  };

  const handleCopyAdopted = async () => {
    if (!adoptedBody) return;
    try {
      await navigator.clipboard.writeText(adoptedBody);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const handleDelete = () => {
    if (!window.confirm("この履歴を削除しますか？この操作は取り消せません。")) return;
    void removeGenerationRecord(row.id).then(() => void onUpdate());
  };

  const adviceText = getAdviceText(row.likes);

  return (
    <Card>
      <CardHeader className="space-y-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base">{EMOTION_LABELS[row.emotion]}</CardTitle>
            <span className="text-xs text-muted-foreground">
              {new Date(row.createdAt).toLocaleString("ja-JP")}
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 text-muted-foreground hover:text-destructive"
            onClick={handleDelete}
            aria-label="この履歴を削除"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2">素材: {row.draft}</p>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="default" onClick={handleReuseSettings}>
            <Wand2 className="mr-1.5 size-3.5" />
            この設定で作成
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!adoptedBody}
            onClick={() => void handleCopyAdopted()}
          >
            <Copy className="mr-1.5 size-3.5" />
            {copied ? "コピーしました" : "採用案をコピー"}
          </Button>
        </div>
        <div>
          <p className="mb-1 font-medium text-muted-foreground">採用した案</p>
          <p className="rounded-xl border bg-muted/30 p-3 leading-relaxed">{adoptedDisplay}</p>
        </div>
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground" htmlFor={`memo-${row.id}`}>
            一言メモ（任意）
          </label>
          <Textarea
            id={`memo-${row.id}`}
            placeholder="例: ハッシュタグを変えた／夜20時に投稿…"
            value={memoInput}
            onChange={(e) => setMemoInput(e.target.value)}
            className="min-h-[72px] resize-y text-sm"
          />
          <Button type="button" size="sm" variant="secondary" onClick={handleSaveMemo}>
            {memoSaved ? "保存しました" : "メモを保存"}
          </Button>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground" htmlFor={`likes-${row.id}`}>
              いいね・反応数（任意）
            </label>
            <Input
              id={`likes-${row.id}`}
              type="number"
              min={0}
              placeholder="例: 42"
              value={likesInput}
              onChange={(e) => setLikesInput(e.target.value)}
              className="w-32"
            />
          </div>
          <Button type="button" size="sm" onClick={handleSaveLikes}>
            {likesSaved ? "保存しました" : "記録"}
          </Button>
        </div>
        <p className="rounded-lg bg-primary/5 p-3 text-xs text-muted-foreground">{adviceText}</p>
        <p className="text-xs text-muted-foreground">
          タグ: {row.hashtags.join(" ")}
        </p>
      </CardContent>
    </Card>
  );
}

function ArchiveRowSkeleton() {
  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="h-9 w-40 animate-pulse rounded bg-muted" />
        <div className="h-20 animate-pulse rounded-xl bg-muted/60" />
        <div className="h-24 animate-pulse rounded-xl bg-muted/60" />
      </CardContent>
    </Card>
  );
}

function getAdviceText(likes: number | null): string {
  if (likes == null) {
    return "投稿後にいいね数を記録すると、次の改善のヒントが出やすくなります。";
  }
  if (likes >= 80) return "かなり伸びています。この感情トーンを「マイ・ゴースト」の学習素材にすると再現しやすくなります。";
  if (likes >= 20) return "好調です。同じ素材で別スイッチの3案もストックしておくと比較に便利です。";
  if (likes >= 5) return "反応がつき始めています。有益・ミニマル案との差分をアーカイブで見返してみましょう。";
  return "まだ静かでもOK。別の感情スイッチで再生成し、採用案を変えて実験してみてください。";
}
