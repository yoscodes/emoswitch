import { z } from "zod";

import {
  getUserProfile,
  requireAuthenticatedUserFromRequest,
  updateUserProfile,
} from "@/lib/supabase/services";

const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(50),
  defaultEmotion: z.enum(["empathy", "toxic", "mood", "useful", "minimal"]),
  writingStyle: z.enum(["polite", "casual", "passionate"]),
  sentenceStyle: z.enum(["desumasu", "friendly"]),
});

export async function GET(request: Request) {
  try {
    const user = await requireAuthenticatedUserFromRequest(request);
    const profile = await getUserProfile(user, user.id);
    return Response.json({ profile });
  } catch (error) {
    const message = error instanceof Error ? error.message : "プロフィール取得に失敗しました";
    const status = message.includes("ログイン") ? 401 : 500;
    return Response.json({ error: message }, { status });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireAuthenticatedUserFromRequest(request);
    const json = await request.json();
    const payload = updateProfileSchema.parse(json);
    const profile = await updateUserProfile(user, payload, user.id);
    return Response.json({ profile });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: error.issues[0]?.message ?? "入力が不正です" }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : "プロフィール保存に失敗しました";
    const status = message.includes("ログイン") ? 401 : 500;
    return Response.json({ error: message }, { status });
  }
}
