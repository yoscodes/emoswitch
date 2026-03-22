import { z } from "zod";

import { resolveRequestActor, softDeleteGeneration, updateGeneration } from "@/lib/supabase/services";

const patchSchema = z.object({
  selectedIndex: z.number().int().min(0).max(2).nullable().optional(),
  likes: z.number().int().min(0).nullable().optional(),
  memo: z.string().nullable().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await resolveRequestActor(request);
    const { id } = await params;
    const json = await request.json();
    const payload = patchSchema.parse(json);
    const row = await updateGeneration(id, payload, actor.userId);
    return Response.json({ row });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: error.issues[0]?.message ?? "入力が不正です" }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : "履歴の更新に失敗しました";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await resolveRequestActor(_request);
    const { id } = await params;
    await softDeleteGeneration(id, actor.userId);
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "履歴の削除に失敗しました";
    return Response.json({ error: message }, { status: 500 });
  }
}
