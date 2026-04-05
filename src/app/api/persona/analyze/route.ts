import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";

import { getArchiveOverview, getGhostSettings, listGenerations, listHotGenerationMemories, resolveRequestActor, saveGhostSettings } from "@/lib/supabase/services";

const personaSchema = z.object({
  keywords: z.array(z.string()).length(5),
  summary: z.string().min(40).max(220),
  evidence: z.array(z.string()).min(3).max(5),
  stylePrompt: z.string().min(10).max(220),
});

function uniqueLines(lines: Array<string | null | undefined>, limit: number): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const line of lines) {
    const normalized = line?.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    output.push(normalized);
    if (output.length >= limit) break;
  }

  return output;
}

export async function POST(request: Request) {
  try {
    const actor = await resolveRequestActor(request);
    const [settings, hotMemories, recentRows, overview] = await Promise.all([
      getGhostSettings(actor.userId),
      listHotGenerationMemories(actor.userId),
      listGenerations(actor.userId),
      getArchiveOverview(actor.userId),
    ]);

    const sourceLines = uniqueLines(
      [
        settings.profileUrl ? `登録URL: ${settings.profileUrl}` : null,
        settings.stylePrompt ? `既存の文体メモ: ${settings.stylePrompt}` : null,
        ...settings.manualPosts.map((post, index) => `手動投稿サンプル${index + 1}: ${post}`),
        ...hotMemories.flatMap((memory, index) => [
          `成功投稿${index + 1}の元素材: ${memory.draft}`,
          `成功投稿${index + 1}の採用文: ${memory.selectedText}`,
          memory.memo ? `成功投稿${index + 1}の補足: ${memory.memo}` : null,
        ]),
        ...recentRows.slice(0, 4).flatMap((row, index) => [
          `最近の素材${index + 1}: ${row.draft}`,
          row.selectedIndex != null ? `最近採用した案${index + 1}: ${row.variants[row.selectedIndex] ?? ""}` : null,
        ]),
      ],
      14,
    );

    if (sourceLines.length === 0) {
      return Response.json(
        { error: "先にペルソナURLや文体メモ、生成履歴を用意してください。" },
        { status: 400 },
      );
    }

    const { object } = await generateObject({
      model: google("gemini-1.5-flash-latest"),
      schema: personaSchema,
      system: [
        "あなたはSNS発信の文体分析に強い日本語ストラテジストです。",
        "入力された断片から、その人らしさをユーザーに説明可能な形で整理してください。",
        "keywords は5個ちょうど。各キーワードは日本語で2〜8文字程度、抽象語だけに逃げず、文体や温度感が見える言葉にする。",
        "summary は、どんな距離感・語尾・強さ・読後感を持つペルソナかを日本語で要約する。",
        "evidence は、なぜそう判断したかをユーザーが納得できる説明文にする。",
        "stylePrompt は、生成時にそのまま使えるような一文の文体メモに整える。",
        "外部サイトの中身を読んだ前提では書かない。与えられた材料から推定できることだけを書く。",
      ].join("\n"),
      prompt: `以下の材料から、このユーザーの発信ペルソナを分析してください。\n\n${sourceLines
        .map((line) => `- ${line}`)
        .join("\n")}`,
      temperature: 0.4,
    });

    const nextSettings = await saveGhostSettings(
      {
        ...settings,
        personaKeywords: object.keywords,
        personaSummary: object.summary,
        personaEvidence: object.evidence,
        personaStatus: "draft",
        personaLastAnalyzedHotCount: overview.insights.totalHot,
        stylePrompt: object.stylePrompt,
      },
      actor.userId,
    );

    return Response.json({ settings: nextSettings });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ペルソナ分析に失敗しました";
    return Response.json({ error: message }, { status: 500 });
  }
}
