"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EMOTION_LABELS } from "@/lib/emotions";
import { listGenerations, updateGeneration } from "@/lib/generation-storage";
import type { GenerationRecord } from "@/lib/types";

export function ArchivePanel() {
  const [rows, setRows] = useState<GenerationRecord[]>([]);

  const refresh = () => setRows(listGenerations());

  useEffect(() => {
    refresh();
  }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8 pb-28 md:px-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">アーカイブ</h1>
        <p className="text-muted-foreground">
          生成した3案のうちどれを採用したか、投稿後の反応をメモして、次の一手のヒントに使います。
        </p>
      </header>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            まだ履歴がありません。
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
              <ArchiveRow row={row} onUpdate={refresh} />
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
  onUpdate: () => void;
}) {
  const [likesInput, setLikesInput] = useState(row.likes != null ? String(row.likes) : "");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setLikesInput(row.likes != null ? String(row.likes) : "");
  }, [row.id, row.likes]);

  const adopted =
    row.selectedIndex != null && row.variants[row.selectedIndex]
      ? row.variants[row.selectedIndex]
      : "未選択";

  const handleSaveLikes = () => {
    const n = likesInput.trim() === "" ? null : Number.parseInt(likesInput, 10);
    if (likesInput.trim() !== "" && Number.isNaN(n)) return;
    updateGeneration(row.id, { likes: n });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
    onUpdate();
  };

  const adviceText = getAdviceText(row.likes);

  return (
    <Card>
      <CardHeader className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base">{EMOTION_LABELS[row.emotion]}</CardTitle>
          <span className="text-xs text-muted-foreground">
            {new Date(row.createdAt).toLocaleString("ja-JP")}
          </span>
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2">素材: {row.draft}</p>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div>
          <p className="mb-1 font-medium text-muted-foreground">採用した案</p>
          <p className="rounded-xl border bg-muted/30 p-3 leading-relaxed">{adopted}</p>
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
            {saved ? "保存しました" : "記録"}
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

function getAdviceText(likes: number | null): string {
  if (likes == null) {
    return "投稿後にいいね数を記録すると、次の改善のヒントが出やすくなります。";
  }
  if (likes >= 80) return "かなり伸びています。この感情トーンを「マイ・ゴースト」の学習素材にすると再現しやすくなります。";
  if (likes >= 20) return "好調です。同じ素材で別スイッチの3案もストックしておくと比較に便利です。";
  if (likes >= 5) return "反応がつき始めています。有益・ミニマル案との差分をアーカイブで見返してみましょう。";
  return "まだ静かでもOK。別の感情スイッチで再生成し、採用案を変えて実験してみてください。";
}
