import { z } from "zod";

import { getGhostSettings, resolveRequestActor, saveGhostSettings } from "@/lib/supabase/services";

const ghostSettingsSchema = z.object({
  profileUrl: z.string(),
  ngWords: z.array(z.string()),
});

export async function GET(request: Request) {
  try {
    const actor = await resolveRequestActor(request);
    const settings = await getGhostSettings(actor.userId);
    return Response.json({ settings });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ゴースト設定の取得に失敗しました";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const actor = await resolveRequestActor(request);
    const json = await request.json();
    const payload = ghostSettingsSchema.parse(json);
    const settings = await saveGhostSettings(payload, actor.userId);
    return Response.json({ settings });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: error.issues[0]?.message ?? "入力が不正です" }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : "ゴースト設定の保存に失敗しました";
    return Response.json({ error: message }, { status: 500 });
  }
}
