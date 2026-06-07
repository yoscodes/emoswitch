import { z } from "zod";

import { requireAuthenticatedActorFromRequest, updateGenerationSeriesItem } from "@/lib/supabase/services";

const patchSchema = z.object({
  likes: z.number().int().min(0).nullable().optional(),
  memo: z.string().nullable().optional(),
  quickFeedback: z.enum(["hot", "cold"]).nullable().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireAuthenticatedActorFromRequest(request);
    const { id } = await params;
    const json = await request.json();
    const payload = patchSchema.parse(json);
    const row = await updateGenerationSeriesItem(id, payload, actor.userId);
    return Response.json({ row });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: error.issues[0]?.message ?? "入力が不正です" }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : "連載エピソードの更新に失敗しました";
    const status = message.includes("ログイン") ? 401 : 500;
    return Response.json({ error: message }, { status });
  }
}
