import { resolveRequestActor, seedArchiveSampleGenerations } from "@/lib/supabase/services";

export async function POST(request: Request) {
  try {
    const actor = await resolveRequestActor(request);
    const result = await seedArchiveSampleGenerations(actor.userId);
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "サンプル履歴の追加に失敗しました";
    return Response.json({ error: message }, { status: 500 });
  }
}
