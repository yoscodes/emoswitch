import { z } from "zod";

import { createGeneration, listGenerations, resolveRequestActor } from "@/lib/supabase/services";

const createGenerationSchema = z.object({
  draft: z.string().min(1),
  emotion: z.enum(["empathy", "toxic", "mood", "useful", "minimal"]),
  intensity: z.number().int().min(0).max(100),
  speedMode: z.enum(["flash", "pro"]).optional(),
  variants: z.array(z.string()).length(3),
  hashtags: z.array(z.string()).min(3).max(8),
  selectedIndex: z.number().int().min(0).max(2).nullable(),
  likes: z.number().int().min(0).nullable(),
  memo: z.string().nullable().optional(),
  adviceHint: z.string().nullable().optional(),
});

export async function GET(request: Request) {
  try {
    const actor = await resolveRequestActor(request);
    const rows = await listGenerations(actor.userId);
    return Response.json({ rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "履歴の取得に失敗しました";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const actor = await resolveRequestActor(request);
    const json = await request.json();
    const payload = createGenerationSchema.parse(json);
    const row = await createGeneration(payload, actor.userId);
    return Response.json({ row });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: error.issues[0]?.message ?? "入力が不正です" }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : "履歴の保存に失敗しました";
    const status = message.includes("クレジット") ? 400 : 500;
    return Response.json({ error: message }, { status });
  }
}
