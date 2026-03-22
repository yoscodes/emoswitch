import { resolveRequestActor } from "@/lib/supabase/services";

export async function GET(request: Request) {
  try {
    const actor = await resolveRequestActor(request);
    const result = { userId: actor.userId, mode: actor.mode };
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "デモ環境の初期化に失敗しました";
    return Response.json({ error: message }, { status: 500 });
  }
}
