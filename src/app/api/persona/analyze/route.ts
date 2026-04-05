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
        settings.stylePrompt ? `既存の起業家スタンスメモ: ${settings.stylePrompt}` : null,
        ...settings.manualPosts.map((post, index) => `手動投稿サンプル${index + 1}: ${post}`),
        ...hotMemories.flatMap((memory, index) => [
          `反応が良かった発信${index + 1}の元素材: ${memory.draft}`,
          `反応が良かった発信${index + 1}の採用文: ${memory.selectedText}`,
          memory.memo ? `反応が良かった発信${index + 1}の補足: ${memory.memo}` : null,
        ]),
        ...recentRows.slice(0, 4).flatMap((row, index) => [
          `最近の種メモ${index + 1}: ${row.draft}`,
          row.selectedIndex != null ? `最近採用した発信案${index + 1}: ${row.variants[row.selectedIndex] ?? ""}` : null,
        ]),
      ],
      14,
    );

    if (sourceLines.length === 0) {
      return Response.json(
        { error: "先にプロフィールURL、手動投稿、または発信履歴を用意してください。" },
        { status: 400 },
      );
    }

    const { object } = await generateObject({
      model: google("gemini-1.5-flash-latest"),
      schema: personaSchema,
      system: [
        "あなたは起業家の思想・強み・価値観を整理する日本語ストラテジストです。",
        "入力された断片から、その人がどんな事業を育てやすいかをユーザーに説明可能な形で整理してください。",
        "keywords は5個ちょうど。次の5軸を1つずつ表すこと: 問題意識 / 強み / 価値観 / 顧客への向き合い方 / 発信スタンス。",
        "各キーワードは日本語で2〜10文字程度、抽象語だけに逃げず、本人らしさが伝わる言葉にする。",
        "summary は、その人がどんな思想で事業の種を選び、どんな市場への向き合い方をしそうかを日本語で要約する。",
        "evidence は、なぜそう判断したかをユーザーが納得できる説明文にする。",
        "stylePrompt は、生成時にそのまま使える『起業家スタンスメモ』として一文に整える。",
        "外部サイトの中身を読んだ前提では書かない。与えられた材料から推定できることだけを書く。",
      ].join("\n"),
      prompt: `以下の材料から、このユーザーの起業家ペルソナを分析してください。\n\n${sourceLines
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
