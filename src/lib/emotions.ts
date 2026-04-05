export type EmotionTone = "empathy" | "toxic" | "mood" | "useful" | "minimal";

export const EMOTION_LABELS: Record<EmotionTone, string> = {
  empathy: "共感導入",
  toxic: "問題提起",
  mood: "世界観",
  useful: "論点整理",
  minimal: "核心ひと言",
};

export const EMOTION_PROMPTS: Record<EmotionTone, string> = {
  empathy:
    "相手の痛みや迷いを受け止め、課題を自分ごととして感じてもらう入口をつくる。",
  toxic:
    "既存の常識や市場のズレを鋭く突き、問題意識が強く伝わる表現にする。",
  mood:
    "思想や未来像が伝わるように、世界観や温度感で共鳴を生む表現にする。",
  useful:
    "論点を整理し、相手が納得できるように因果や学びを明快に伝える。",
  minimal:
    "余計な装飾を削り、事業の核だけを短く強く残す。",
};
