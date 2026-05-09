import { resolveIdentityFieldBufferEntries, resolveRequestActor } from "@/lib/supabase/services";

export async function POST(request: Request) {
  try {
    const actor = await resolveRequestActor(request);
    const resolvedCount = await resolveIdentityFieldBufferEntries(actor.userId);
    return Response.json({ resolvedCount });
  } catch (error) {
    const message = error instanceof Error ? error.message : "還流キューの解消に失敗しました";
    return Response.json({ error: message }, { status: 500 });
  }
}

