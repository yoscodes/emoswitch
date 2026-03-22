export type EmotionTone = "empathy" | "toxic" | "mood" | "useful" | "minimal";

export const EMOTION_LABELS: Record<EmotionTone, string> = {
  empathy: "共感",
  toxic: "毒舌",
  mood: "情緒",
  useful: "有益",
  minimal: "ミニマル",
};

export const EMOTION_PROMPTS: Record<EmotionTone, string> = {
  empathy:
    "読者の不安を受け止める。優しく寄り添いながら前向きな行動に繋がる一文にする。",
  toxic:
    "挑発的だが下品にならない。鋭く本質を突き、読者が思わず反応したくなる一文にする。",
  mood:
    "言葉の温度や余韻を大切にする。情景や空気感が伝わる、情緒的で刺さる一文にする。",
  useful:
    "読者が明日から使える学びや気づきが得られる。具体性と実利を意識した有益な一文にする。",
  minimal:
    "無駄を削ったミニマル表現。余韻を残し、強い意味を持つ短文にする。",
};
