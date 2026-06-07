import { requireAuthenticatedActorFromRequest, seedArchiveSampleGenerations } from "@/lib/supabase/services";

export async function POST(request: Request) {
  try {
    const actor = await requireAuthenticatedActorFromRequest(request);
    const result = await seedArchiveSampleGenerations(actor.userId);
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "サンプル履歴の追加に失敗しました";
    const status = message.includes("ログイン") ? 401 : 500;
    return Response.json({ error: message }, { status });
  }
}
