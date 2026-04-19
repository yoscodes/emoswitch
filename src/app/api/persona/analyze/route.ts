import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";

import { getArchiveOverview, getGhostSettings, listGenerations, listHotGenerationMemories, resolveRequestActor, saveGhostSettings } from "@/lib/supabase/services";

const DNA_CHOICE_PREFIX = "dna_choice";
const ANTI_PERSONA_PREFIX = "anti_persona";

const DNA_QUESTION_MAP = {
  logic_vs_emotion: {
    prompt: "論理 vs 情緒",
    leftLabel: "論理で切る",
    rightLabel: "情緒で触れる",
  },
  break_vs_harmony: {
    prompt: "破壊 vs 調和",
    leftLabel: "古い前提を壊す",
    rightLabel: "関係を崩さず動かす",
  },
  crowd_vs_solitude: {
    prompt: "大衆 vs 孤独",
    leftLabel: "大衆の課題に開く",
    rightLabel: "孤独な違和感を掘る",
  },
  speed_vs_density: {
    prompt: "スピード vs 密度",
    leftLabel: "まず速く試す",
    rightLabel: "密度高く磨く",
  },
  utility_vs_philosophy: {
    prompt: "実利 vs 思想",
    leftLabel: "役に立つを先に出す",
    rightLabel: "思想から世界観を作る",
  },
  efficiency_vs_emotion: {
    prompt: "事業を前に進めるときの反応軸",
    leftLabel: "効率を重視する",
    rightLabel: "情緒を重視する",
  },
  destroyer_vs_guardian: {
    prompt: "市場で取りたい役割",
    leftLabel: "破壊者でありたい",
    rightLabel: "守護者でありたい",
  },
  proof_vs_instinct: {
    prompt: "意思決定の起点",
    leftLabel: "証拠で進めたい",
    rightLabel: "直感で切り込みたい",
  },
  sharp_vs_gentle: {
    prompt: "市場への語り口",
    leftLabel: "鋭く切り込みたい",
    rightLabel: "やわらかく伝えたい",
  },
  minority_vs_majority: {
    prompt: "立ち位置",
    leftLabel: "少数派の違和感に立つ",
    rightLabel: "多数派の課題を拾う",
  },
} as const;

const ANTI_PERSONA_LABELS = {
  avoid_phrases: "絶対に避ける言い回し",
  hated_success_patterns: "嫌いな成功法則",
  intolerable_injustice: "許せない不条理",
} as const;

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

function parsePersonaControls(manualPosts: string[]) {
  const dnaChoices: string[] = [];
  const antiPersona: string[] = [];
  const legacyLines: string[] = [];

  for (const rawLine of manualPosts) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith(`${DNA_CHOICE_PREFIX}|`)) {
      const [, id, value] = line.split("|");
      const meta = DNA_QUESTION_MAP[id as keyof typeof DNA_QUESTION_MAP];
      if (meta && (value === "left" || value === "right")) {
        dnaChoices.push(`${meta.prompt}: ${value === "left" ? meta.leftLabel : meta.rightLabel}`);
        continue;
      }
    }

    if (line.startsWith(`${ANTI_PERSONA_PREFIX}|`)) {
      const [, id, ...rest] = line.split("|");
      const label = ANTI_PERSONA_LABELS[id as keyof typeof ANTI_PERSONA_LABELS];
      const value = rest.join("|").trim();
      if (label && value) {
        antiPersona.push(`${label}: ${value}`);
        continue;
      }
    }

    legacyLines.push(line);
  }

  return { dnaChoices, antiPersona, legacyLines };
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
    const controls = parsePersonaControls(settings.manualPosts);

    const sourceLines = uniqueLines(
      [
        ...controls.legacyLines.map((line, index) => `既存メモ${index + 1}: ${line}`),
        settings.stylePrompt ? `既存の起業家スタンスメモ: ${settings.stylePrompt}` : null,
        overview.insights.bestPatternSummary ? `Archive 洞察: ${overview.insights.bestPatternSummary}` : null,
        ...hotMemories.flatMap((memory, index) => [
          `反応が良かった発信${index + 1}の元素材: ${memory.draft}`,
          `反応が良かった発信${index + 1}の採用文: ${memory.selectedText}`,
          memory.memo ? `反応が良かった発信${index + 1}の補足: ${memory.memo}` : null,
        ]),
        ...recentRows.slice(0, 4).flatMap((row, index) => [
          `最近の種メモ${index + 1}: ${row.draft}`,
          row.selectedIndex != null ? `最近採用した発信案${index + 1}: ${row.variants[row.selectedIndex] ?? ""}` : null,
          row.memo ? `最近の検証メモ${index + 1}: ${row.memo}` : null,
        ]),
      ],
      16,
    );

    if (sourceLines.length === 0 && controls.dnaChoices.length === 0 && controls.antiPersona.length === 0) {
      return Response.json(
        { error: "/lab の行動ログ、二択DNA、または Anti-Persona を先に用意してください。" },
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
        "二択DNAは、その人の価値観の土台として強く反映する。",
        "Anti-Persona は『こうはなりたくない』『こうは語りたくない』という境界線として扱い、summary と stylePrompt に必ず反映する。",
        "Auto-Growing Identity なので、最近の /lab の種メモ・採用文・検証メモ・反応ログから、その人の Being を逆算する。",
        "外部サイトの中身を読んだ前提では書かない。与えられた材料から推定できることだけを書く。",
      ].join("\n"),
      prompt: [
        "以下の材料から、このユーザーの起業家としてのアイデンティティ（Identity）を分析してください。",
        "",
        controls.dnaChoices.length > 0 ? `二択DNA:\n${controls.dnaChoices.map((line) => `- ${line}`).join("\n")}` : "二択DNA: 指定なし",
        "",
        controls.antiPersona.length > 0
          ? `Anti-Persona:\n${controls.antiPersona.map((line) => `- ${line}`).join("\n")}`
          : "Anti-Persona: 指定なし",
        "",
        sourceLines.length > 0 ? `行動ログ / 反応ログ:\n${sourceLines.map((line) => `- ${line}`).join("\n")}` : "行動ログ / 反応ログ: なし",
      ].join("\n"),
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
    const message = error instanceof Error ? error.message : "Identity の分析に失敗しました";
    return Response.json({ error: message }, { status: 500 });
  }
}
