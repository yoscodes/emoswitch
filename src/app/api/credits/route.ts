import { getCreditSummary, resolveRequestActor } from "@/lib/supabase/services";

export async function GET(request: Request) {
  try {
    const actor = await resolveRequestActor(request);
    const summary = await getCreditSummary(actor.userId);
    return Response.json({ summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : "クレジット取得に失敗しました";
    return Response.json({ error: message }, { status: 500 });
  }
}
