import { z } from "zod";

import {
  appendIdentityFieldBufferEntry,
  listIdentityFieldBufferSeriesSummary,
  requireAuthenticatedActorFromRequest,
  resolveRequestActor,
} from "@/lib/supabase/services";

const appendSchema = z.object({
  seriesId: z.string().min(1),
  itemId: z.string().min(1),
  quickFeedback: z.enum(["hot", "cold"]).nullable(),
  likes: z.number().int().min(0).nullable(),
  memo: z.string().nullable(),
});

export async function GET(request: Request) {
  try {
    const actor = await resolveRequestActor(request);
    const rows = await listIdentityFieldBufferSeriesSummary(actor.userId);
    return Response.json({ rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "還流状況の取得に失敗しました";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireAuthenticatedActorFromRequest(request);
    const json = await request.json();
    const payload = appendSchema.parse(json);
    await appendIdentityFieldBufferEntry(payload, actor.userId);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: error.issues[0]?.message ?? "入力が不正です" }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "還流キューへの追加に失敗しました";
    const status = message.includes("ログイン") ? 401 : 500;
    return Response.json({ error: message }, { status });
  }
}

