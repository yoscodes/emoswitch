import { z } from "zod";

import { migrateLocalData, resolveRequestActor } from "@/lib/supabase/services";

const generationSchema = z.object({
  id: z.string().uuid(),
  createdAt: z.string(),
  draft: z.string(),
  emotion: z.enum(["empathy", "toxic", "mood", "useful", "minimal"]),
  intensity: z.number().int().min(0).max(100),
  speedMode: z.enum(["flash", "pro"]).optional(),
  variants: z.array(z.string()),
  hashtags: z.array(z.string()),
  selectedIndex: z.number().int().min(0).max(2).nullable(),
  likes: z.number().int().min(0).nullable(),
  memo: z.string().nullable().optional(),
  adviceHint: z.string().nullable().optional(),
});

const payloadSchema = z.object({
  generations: z.array(generationSchema),
  ghostSettings: z.object({
    profileUrl: z.string(),
    ngWords: z.array(z.string()),
  }),
});

export async function POST(request: Request) {
  try {
    const actor = await resolveRequestActor(request);
    const json = await request.json();
    const payload = payloadSchema.parse(json);
    const result = await migrateLocalData(payload, actor.userId);
    return Response.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: error.issues[0]?.message ?? "入力が不正です" }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : "データ移行に失敗しました";
    return Response.json({ error: message }, { status: 500 });
  }
}
