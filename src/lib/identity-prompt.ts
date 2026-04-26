type IdentityPromptInput = {
  dnaAxes: Record<string, unknown>;
  myTaboo: Record<string, unknown>;
  currentProphecy: string;
};

const DNA_AXIS_LABELS: Record<string, string> = {
  logic_vs_emotion: "論理 vs 情緒",
  break_vs_harmony: "破壊 vs 調和",
  crowd_vs_solitude: "大衆 vs 孤独",
  speed_vs_density: "スピード vs 密度",
  utility_vs_philosophy: "実利 vs 思想",
};

function stringifyAxisValue(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (value === "left") return "left";
  if (value === "right") return "right";
  return null;
}

function normalizeTabooWords(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function containsLoose(text: string, keyword: string) {
  return text.toLowerCase().includes(keyword.toLowerCase());
}

function describeAxisTone(axisKey: string, rawValue: unknown): string | null {
  const axisValue = stringifyAxisValue(rawValue);
  if (!axisValue) return null;
  const asNumber = Number(rawValue);

  if (Number.isFinite(asNumber)) {
    if (axisKey === "logic_vs_emotion") {
      if (asNumber <= 20) return "情緒の機微を優先し、体温のある比喩で語る。";
      if (asNumber >= 81) return "論理とデータを優先し、結論ファーストで冷徹に語る。";
      return "情緒と論理の両方を使い、文脈に応じてバランスを取る。";
    }
    if (axisKey === "break_vs_harmony") {
      if (asNumber <= 20) return "関係を守る語り口で、橋渡しを重視する。";
      if (asNumber >= 81) return "既存前提を壊す切れ味を前面に出す。";
      return "対立を煽らず、必要な局面だけ鋭く切り込む。";
    }
    if (axisKey === "crowd_vs_solitude") {
      if (asNumber <= 20) return "少数派の痛みに深く寄り添って語る。";
      if (asNumber >= 81) return "市場全体に翻訳し、広く届く言葉を選ぶ。";
      return "コアな痛みを保ちつつ、外側へ翻訳して語る。";
    }
  }

  if (axisKey === "logic_vs_emotion") {
    return axisValue === "left"
      ? "論理とデータに基づいた、結論ファーストの語り口を好む。"
      : "感情の温度を優先し、余韻と共感で浸透させる語り口を好む。";
  }
  if (axisKey === "break_vs_harmony") {
    return axisValue === "left"
      ? "古い前提を壊す挑発的な切り口を採る。"
      : "対立を煽らず、調和を保った橋渡しを重視する。";
  }
  if (axisKey === "crowd_vs_solitude") {
    return axisValue === "left"
      ? "大衆課題へ翻訳して広く届く言葉にする。"
      : "孤独な当事者の痛みに鋭く刺す語り口を取る。";
  }
  if (axisKey === "speed_vs_density") {
    return axisValue === "left"
      ? "完璧さより検証速度を優先し、短く出して早く学ぶ。"
      : "スピードより密度を重視し、意味を磨いた上で出す。";
  }
  if (axisKey === "utility_vs_philosophy") {
    return axisValue === "left"
      ? "即効性のある実利を先に提示する。"
      : "実利より思想の芯を先に提示する。";
  }
  return null;
}

function pickImportantLines(lines: string[], maxLines: number, maxChars: number): string[] {
  const picked: string[] = [];
  let total = 0;
  for (const line of lines) {
    if (!line) continue;
    if (picked.length >= maxLines) break;
    if (total + line.length > maxChars) break;
    picked.push(line);
    total += line.length;
  }
  return picked;
}

export function buildIdentityPromptBlock(identity: IdentityPromptInput): string {
  const axisLines = Object.entries(DNA_AXIS_LABELS)
    .map(([key, label]) => {
      const value = stringifyAxisValue(identity.dnaAxes[key]);
      if (!value) return null;
      const tone = describeAxisTone(key, identity.dnaAxes[key]);
      return `${label}: ${value}${tone ? ` / ${tone}` : ""}`;
    })
    .filter((line): line is string => line != null);
  const keywords = normalizeTabooWords(identity.dnaAxes.persona_keywords);
  const summary = typeof identity.dnaAxes.persona_summary === "string" ? identity.dnaAxes.persona_summary.trim() : "";
  const importantAxis = pickImportantLines(axisLines, 3, 260);
  const importantKeywords = keywords.slice(0, 5);

  return [
    "あなたは以下のDNAを持つ起業家の分身です。常にこのIdentityを優先してください。",
    `称号: ${identity.currentProphecy || "平均的な起業家"}`,
    importantAxis.length > 0 ? `DNA軸（重要）:\n${importantAxis.map((line) => `- ${line}`).join("\n")}` : "DNA軸: 未設定",
    importantKeywords.length > 0 ? `Identityキーワード（重要）: ${importantKeywords.join("、")}` : "Identityキーワード: 未設定",
    summary !== "" ? `Identity要約: ${summary}` : "Identity要約: 未設定",
    "出力時は、上記DNAから外れる表現を避け、語り口の一貫性を守ること。",
  ].join("\n");
}

export function buildShredderPromptBlock(seed: string, myTaboo: Record<string, unknown>): string {
  const tabooWords = normalizeTabooWords(myTaboo.ng_words);
  const tabooPhrases = normalizeTabooWords(myTaboo.anti_persona);
  const allTaboo = [...new Set([...tabooWords, ...tabooPhrases])];
  if (allTaboo.length === 0) {
    return "SHREDDER: My Tabooは未設定。表現の甘さや二番煎じは自律的に排除すること。";
  }

  const hit = allTaboo.filter((word) => containsLoose(seed, word)).slice(0, 5);
  return [
    `SHREDDER / My Taboo: ${allTaboo.join(" / ")}`,
    hit.length > 0
      ? `入力にタブー候補が含まれる: ${hit.join("、")}。これらをあえて拒絶対象として明示し、美化や正当化を避けること。`
      : "タブーを常に監視し、近い表現も含めて拒絶線を守ること。",
    "もしタブーに触れる語句を出力する必要が生じた場合は、その語句を [SHREDDED:<語句>] 形式で置換し、同じ文内で代替表現に言い換えること。",
  ].join("\n");
}
