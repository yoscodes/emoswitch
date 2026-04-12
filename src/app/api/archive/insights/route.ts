import { getArchiveOverviewWithOptions, resolveRequestActor } from "@/lib/supabase/services";

export async function GET(request: Request) {
  try {
    const actor = await resolveRequestActor(request);
    const summaryOnly = new URL(request.url).searchParams.get("summaryOnly") === "1";
    const overview = await getArchiveOverviewWithOptions(actor.userId, {
      includeEntries: !summaryOnly,
    });
    return Response.json(overview);
  } catch (error) {
    const message = error instanceof Error ? error.message : "分析データの取得に失敗しました";
    return Response.json({ error: message }, { status: 500 });
  }
}
