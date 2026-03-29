import { resolveRequestActor, softDeleteGenerationSeries } from "@/lib/supabase/services";

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
