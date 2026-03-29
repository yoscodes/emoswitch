import { z } from "zod";

import {
  createGeneration,
  createGenerationSeries,
  listGenerations,
  resetAllGenerations,
  resolveRequestActor,
} from "@/lib/supabase/services";

const createSingleGenerationSchema = z.object({
  generationMode: z.literal("single").default("single"),
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
  quickFeedback: z.enum(["hot", "cold"]).nullable().optional(),
  memoryTags: z.array(z.string()).optional(),
});

const createSeriesGenerationSchema = z.object({
  generationMode: z.literal("series"),
  title: z.string().min(1),
  draft: z.string().min(1),
  emotion: z.enum(["empathy", "toxic", "mood", "useful", "minimal"]),
  intensity: z.number().int().min(0).max(100),
  speedMode: z.enum(["flash", "pro"]).optional(),
  adviceHint: z.string().nullable().optional(),
  ghostWhisper: z.string().nullable().optional(),
  memoryTags: z.array(z.string()).optional(),
  items: z
    .array(
      z.object({
        slotKey: z.enum(["mon_problem", "wed_solution", "fri_emotion"]),
        slotLabel: z.string().min(1),
        body: z.string().min(1),
        hashtags: z.array(z.string()),
      }),
    )
    .length(3),
});

const createGenerationSchema = z.discriminatedUnion("generationMode", [
  createSingleGenerationSchema,
  createSeriesGenerationSchema,
]);

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
    const row =
      payload.generationMode === "series"
        ? await createGenerationSeries(payload, actor.userId)
        : await createGeneration(payload, actor.userId);
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

export async function DELETE(request: Request) {
  try {
    const actor = await resolveRequestActor(request);
    const result = await resetAllGenerations(actor.userId);
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "履歴の一括削除に失敗しました";
    return Response.json({ error: message }, { status: 500 });
  }
}
