import { z } from "zod";

import {
  resolveRequestActor,
  softDeleteGenerationSeries,
  updateGenerationSeriesConceptBrief,
} from "@/lib/supabase/services";

const conceptBriefSchema = z.object({
  oneLiner: z.string().min(1),
  audience: z.string().min(1),
  pain: z.string().min(1),
  valueProposition: z.string().min(1),
  whyNow: z.string().min(1),
  whyMe: z.string().min(1),
  mvp: z.string().min(1),
  elevatorPitch: z.string().min(1),
});

const patchSchema = z.object({
  conceptBrief: conceptBriefSchema,
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await resolveRequestActor(request);
    const { id } = await params;
    const payload = patchSchema.parse(await request.json());
    const row = await updateGenerationSeriesConceptBrief(id, payload.conceptBrief, actor.userId);
    return Response.json({ row });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: error.issues[0]?.message ?? "入力が不正です" }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : "Concept Brief の更新に失敗しました";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await resolveRequestActor(request);
    const { id } = await params;
    await softDeleteGenerationSeries(id, actor.userId);
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "連載の削除に失敗しました";
    return Response.json({ error: message }, { status: 500 });
  }
}
