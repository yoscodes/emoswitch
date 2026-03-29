import { getArchiveOverview, resolveRequestActor } from "@/lib/supabase/services";

export async function GET(request: Request) {
  try {
    const actor = await resolveRequestActor(request);
    const overview = await getArchiveOverview(actor.userId);
    return Response.json(overview);
  } catch (error) {
    const message = error instanceof Error ? error.message : "分析データの取得に失敗しました";
    return Response.json({ error: message }, { status: 500 });
  }
}
