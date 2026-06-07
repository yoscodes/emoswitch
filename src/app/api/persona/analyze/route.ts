import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";

import {
  formatAiGatewayErrorForClient,
  getAiGatewayErrorHttpStatus,
  withGeminiQuotaAwareRetry,
} from "@/lib/ai-quota-retry";
import { dnaAxesSchema } from "@/lib/identity-dna-schema";
import { getArchiveOverview, getGhostSettings, getIdentityProfile, listGenerations, listHotGenerationMemories, requireAuthenticatedActorFromRequest, saveGhostSettings, saveIdentityProfile } from "@/lib/supabase/services";

const ANTI_PERSONA_PREFIX = "anti_persona";

const ANTI_PERSONA_LABELS = {
  my_aesthetic: "My Taboo（私の美学）",
  avoid_phrases: "使いたくない言葉",
  hated_success_patterns: "やりたくない戦い方",
  intolerable_injustice: "変えたい現状",
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
  const antiPersona: string[] = [];
  const legacyLines: string[] = [];

  for (const rawLine of manualPosts) {
    const line = rawLine.trim();
    if (!line) continue;

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

  return { antiPersona, legacyLines };
}

function calculateDnaCompleteness(params: {
  keywordCount: number;
  hasSummary: boolean;
  manualPostCount: number;
  status: "empty" | "draft" | "approved";
}) {
  let score = Math.min(36, params.keywordCount * 5) + (params.hasSummary ? 14 : 0) + Math.min(32, params.manualPostCount * 4);
  if (params.status === "approved") score = Math.max(score, 78);
  else if (params.status === "draft") score = Math.max(score, 52);
  return Math.min(100, score);
}

export async function POST(request: Request) {
  try {
    const actor = await requireAuthenticatedActorFromRequest(request);
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

    if (sourceLines.length === 0 && controls.antiPersona.length === 0) {
      return Response.json(
        { error: "/lab の行動ログ、または Anti-Persona を先に用意してください。" },
        { status: 400 },
      );
    }

    const { object } = await withGeminiQuotaAwareRetry(() =>
      generateObject({
        model: google("gemini-2.5-flash"),
        schema: personaSchema,
        maxRetries: 0,
        system: [
          "あなたは起業家の思想・強み・価値観を整理する日本語ストラテジストです。",
          "入力された断片から、その人がどんな事業を育てやすいかをユーザーに説明可能な形で整理してください。",
          "keywords は5個ちょうど。次の5軸を1つずつ表すこと: 問題意識 / 強み / 価値観 / 顧客への向き合い方 / 発信スタンス。",
          "各キーワードは日本語で2〜10文字程度、抽象語だけに逃げず、本人らしさが伝わる言葉にする。",
          "summary は、その人がどんな思想で事業の種を選び、どんな市場への向き合い方をしそうかを日本語で要約する。",
          "evidence は、なぜそう判断したかをユーザーが納得できる説明文にする。",
          "stylePrompt は、生成時にそのまま使える『起業家スタンスメモ』として一文に整える。",
          "Anti-Persona は『こうはなりたくない』『こうは語りたくない』という境界線として扱い、summary と stylePrompt に必ず反映する。",
          "Auto-Growing Identity なので、最近の /lab の種メモ・採用文・検証メモ・反応ログから、その人の Being を逆算する。",
          "外部サイトの中身を読んだ前提では書かない。与えられた材料から推定できることだけを書く。",
        ].join("\n"),
        prompt: [
          "以下の材料から、このユーザーの起業家としてのアイデンティティ（Identity）を分析してください。",
          "",
          controls.antiPersona.length > 0
            ? `Anti-Persona:\n${controls.antiPersona.map((line) => `- ${line}`).join("\n")}`
            : "Anti-Persona: 指定なし",
          "",
          sourceLines.length > 0 ? `行動ログ / 反応ログ:\n${sourceLines.map((line) => `- ${line}`).join("\n")}` : "行動ログ / 反応ログ: なし",
        ].join("\n"),
        temperature: 0.4,
      }),
    );

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

    const nextAxes = dnaAxesSchema.parse({
      logic_vs_emotion: null,
      break_vs_harmony: null,
      crowd_vs_solitude: null,
      speed_vs_density: null,
      utility_vs_philosophy: null,
      persona_keywords: object.keywords,
      persona_summary: object.summary,
    });
    const currentIdentity = await getIdentityProfile(actor.userId);
    const nextIdentity = await saveIdentityProfile(
      {
        ...currentIdentity,
        dnaAxes: nextAxes,
        myTaboo: {
          anti_persona: controls.antiPersona,
          ng_words: settings.ngWords,
        },
        currentProphecy: object.stylePrompt || object.summary,
        dnaCompleteness: calculateDnaCompleteness({
          keywordCount: object.keywords.length,
          hasSummary: object.summary.trim().length > 0,
          manualPostCount: settings.manualPosts.length,
          status: "draft",
        }),
        version: currentIdentity.version,
      },
      actor.userId,
    );

    return Response.json({ settings: nextSettings, identity: nextIdentity });
  } catch (error) {
    const message = formatAiGatewayErrorForClient(error);
    const status = getAiGatewayErrorHttpStatus(error);
    if (message.includes("ログイン")) {
      return Response.json({ error: message }, { status: 401 });
    }
    return Response.json({ error: message }, { status: status === 429 ? 429 : 500 });
  }
}
