import { z } from "zod";

import { identityPayloadSchema } from "@/lib/identity-dna-schema";
import { getGhostSettings, getIdentityProfile, requireAuthenticatedActorFromRequest, resolveRequestActor, saveGhostSettings, saveIdentityProfile } from "@/lib/supabase/services";

const ghostSettingsSchema = z.object({
  profileUrl: z.string(),
  ngWords: z.array(z.string()),
  stylePrompt: z.string().optional(),
  manualPosts: z.array(z.string()).optional(),
  personaKeywords: z.array(z.string()).optional(),
  personaSummary: z.string().optional(),
  personaEvidence: z.array(z.string()).optional(),
  personaStatus: z.enum(["empty", "draft", "approved"]).optional(),
  personaLastAnalyzedHotCount: z.number().int().min(0).optional(),
}).partial();

const ghostSettingsWithIdentitySchema = ghostSettingsSchema.merge(identityPayloadSchema.partial());

function parseAxisChoices(manualPosts: string[]) {
  const axis: Record<string, "left" | "right" | null> = {
    logic_vs_emotion: null,
    break_vs_harmony: null,
    crowd_vs_solitude: null,
    speed_vs_density: null,
    utility_vs_philosophy: null,
  };
  for (const rawLine of manualPosts) {
    const line = rawLine.trim();
    if (!line.startsWith("dna_choice|")) continue;
    const [, id, value] = line.split("|");
    if (id in axis && (value === "left" || value === "right")) {
      axis[id] = value;
    }
  }
  return axis;
}

function parseAntiPersona(manualPosts: string[]) {
  return manualPosts
    .map((line) => line.trim())
    .filter((line) => line.startsWith("anti_persona|"))
    .map((line) => line.replace("anti_persona|", "").trim())
    .filter(Boolean);
}

export async function GET(request: Request) {
  try {
    const actor = await resolveRequestActor(request);
    const settings = await getGhostSettings(actor.userId);
    return Response.json({ settings });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ペルソナ設定の取得に失敗しました";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const actor = await requireAuthenticatedActorFromRequest(request);
    const json = await request.json();
    const payload = ghostSettingsWithIdentitySchema.parse(json);
    const current = await getGhostSettings(actor.userId);
    const settings = await saveGhostSettings(
      {
        ...current,
        ...payload,
        profileUrl: payload.profileUrl ?? current.profileUrl,
        ngWords: payload.ngWords ?? current.ngWords,
        stylePrompt: payload.stylePrompt ?? current.stylePrompt,
        manualPosts: payload.manualPosts ?? current.manualPosts,
        personaKeywords: payload.personaKeywords ?? current.personaKeywords,
        personaSummary: payload.personaSummary ?? current.personaSummary,
        personaEvidence: payload.personaEvidence ?? current.personaEvidence,
        personaStatus: payload.personaStatus ?? current.personaStatus,
        personaLastAnalyzedHotCount:
          payload.personaLastAnalyzedHotCount ?? current.personaLastAnalyzedHotCount,
      },
      actor.userId,
    );
    const approvedTransition = payload.personaStatus === "approved" && current.personaStatus !== "approved";

    const nextManualPosts = payload.manualPosts ?? current.manualPosts;
    const nextPersonaKeywords = payload.personaKeywords ?? current.personaKeywords;
    const nextPersonaSummary = payload.personaSummary ?? current.personaSummary;
    const nextNgWords = payload.ngWords ?? current.ngWords;
    const derivedAxes = {
      ...parseAxisChoices(nextManualPosts),
      persona_keywords: nextPersonaKeywords,
      persona_summary: nextPersonaSummary,
    };
    const derivedTaboo = {
      anti_persona: parseAntiPersona(nextManualPosts),
      ng_words: nextNgWords,
    };
    const hasLegacyIdentityPayload =
      payload.manualPosts !== undefined ||
      payload.personaKeywords !== undefined ||
      payload.personaSummary !== undefined ||
      payload.ngWords !== undefined;

    const hasIdentityPayload =
      payload.dnaAxes !== undefined ||
      payload.myTaboo !== undefined ||
      payload.currentProphecy !== undefined ||
      payload.dnaCompleteness !== undefined;
    if (!hasIdentityPayload && !hasLegacyIdentityPayload && !approvedTransition) {
      return Response.json({ settings });
    }

    const currentIdentity = await getIdentityProfile(actor.userId);
    const identity = await saveIdentityProfile(
      {
        dnaAxes: payload.dnaAxes ?? derivedAxes ?? currentIdentity.dnaAxes,
        myTaboo: payload.myTaboo ?? derivedTaboo ?? currentIdentity.myTaboo,
        currentProphecy: payload.currentProphecy ?? currentIdentity.currentProphecy,
        dnaCompleteness: payload.dnaCompleteness ?? currentIdentity.dnaCompleteness,
        version: approvedTransition ? currentIdentity.version + 1 : currentIdentity.version,
      },
      actor.userId,
    );
    return Response.json({ settings, identity });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: error.issues[0]?.message ?? "入力が不正です" }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : "ペルソナ設定の保存に失敗しました";
    const status = message.includes("ログイン") ? 401 : 500;
    return Response.json({ error: message }, { status });
  }
}
