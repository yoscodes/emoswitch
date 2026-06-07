import OpenAI from "openai";

import { requireAuthenticatedActorFromRequest } from "@/lib/supabase/services";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await requireAuthenticatedActorFromRequest(request);

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "OPENAI_API_KEY が未設定です" }, { status: 500 });
    }

    const openai = new OpenAI({ apiKey });
    const formData = await request.formData();
    const audio = formData.get("audio");

    if (!(audio instanceof File)) {
      return Response.json({ error: "音声ファイルが見つかりません" }, { status: 400 });
    }

    const transcript = await openai.audio.transcriptions.create({
      file: audio,
      model: "whisper-1",
      language: "ja",
      temperature: 0,
    });

    return Response.json({ text: transcript.text });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "音声文字起こしに失敗しました";
    const status = message.includes("ログイン") ? 401 : 500;
    return Response.json({ error: message }, { status });
  }
}
