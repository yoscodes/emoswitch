import { z } from "zod";

import { getGhostSettings, resolveRequestActor, saveGhostSettings } from "@/lib/supabase/services";

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
    const actor = await resolveRequestActor(request);
    const json = await request.json();
    const payload = ghostSettingsSchema.parse(json);
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
    return Response.json({ settings });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: error.issues[0]?.message ?? "入力が不正です" }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : "ペルソナ設定の保存に失敗しました";
    return Response.json({ error: message }, { status: 500 });
  }
}
