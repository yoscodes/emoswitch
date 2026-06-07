import { requireAuthenticatedActorFromRequest, resolveIdentityFieldBufferEntries } from "@/lib/supabase/services";

export async function POST(request: Request) {
  try {
    const actor = await requireAuthenticatedActorFromRequest(request);
    const resolvedCount = await resolveIdentityFieldBufferEntries(actor.userId);
    return Response.json({ resolvedCount });
  } catch (error) {
    const message = error instanceof Error ? error.message : "還流キューの解消に失敗しました";
    const status = message.includes("ログイン") ? 401 : 500;
    return Response.json({ error: message }, { status });
  }
}

