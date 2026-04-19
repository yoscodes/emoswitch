const DNA_CHOICE_PREFIX = "dna_choice";

type CoreDnaId = "logic_vs_emotion" | "break_vs_harmony" | "crowd_vs_solitude";

function parseCoreDnaChoices(manualPosts: string[] | undefined): Record<CoreDnaId, "left" | "right" | null> {
  const choices: Record<CoreDnaId, "left" | "right" | null> = {
    logic_vs_emotion: null,
    break_vs_harmony: null,
    crowd_vs_solitude: null,
  };
  if (!manualPosts) return choices;
  for (const line of manualPosts) {
    if (!line.startsWith(`${DNA_CHOICE_PREFIX}|`)) continue;
    const [, id, side] = line.split("|");
    if (id === "logic_vs_emotion" || id === "break_vs_harmony" || id === "crowd_vs_solitude") {
      if (side === "left" || side === "right") {
        choices[id] = side;
      }
    }
  }
  return choices;
}

/** Identity ページの「Detected Identity」と同じロジック（固定3軸のみ使用）。 */
export function getDetectedIdentityLabel(manualPosts: string[] | undefined): string {
  const dnaChoices = parseCoreDnaChoices(manualPosts);
  const unresolvedCount = Object.values(dnaChoices).filter((value) => value == null).length;

  if (unresolvedCount > 0) {
    return "平均的な起業家";
  }

  const logicEmotion = dnaChoices.logic_vs_emotion;
  const breakHarmony = dnaChoices.break_vs_harmony;
  const crowdSolitude = dnaChoices.crowd_vs_solitude;

  const tone =
    logicEmotion === "left" ? "論理的な" : logicEmotion === "right" ? "情緒的な" : "均整の取れた";
  const posture =
    breakHarmony === "left" ? "異端児" : breakHarmony === "right" ? "調律者" : "探究者";
  const audience =
    crowdSolitude === "left" ? "市場翻訳型" : crowdSolitude === "right" ? "少数派特化型" : "中間型";

  return `${tone}${posture} / ${audience}`;
}
