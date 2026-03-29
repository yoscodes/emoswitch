const TAG_PATTERNS: Array<{ tag: string; test: (text: string) => boolean }> = [
  {
    tag: "問いかけ始まり",
    test: (text) => /^(なんで|なぜ|どうして|どうやって|どうすれば|本当に|そもそも|あなたは)/.test(text),
  },
  {
    tag: "共感導入",
    test: (text) => /(しんどい|つらい|わかる|報われない|苦しい|疲れた|しんどくて)/.test(text),
  },
  {
    tag: "実用提案",
    test: (text) => /(コツ|方法|ポイント|だけで|すると|決める|絞る|見直す)/.test(text),
  },
  {
    tag: "本音吐露",
    test: (text) => /(正直|本音|ほんとは|実は|もう無理|限界)/.test(text),
  },
  {
    tag: "短文断定",
    test: (text) => text.length <= 32 || /。$/.test(text),
  },
  {
    tag: "余韻締め",
    test: (text) => /(かもしれない|だけ。|たい。|なる。|残る。)$/.test(text),
  },
  {
    tag: "行動喚起",
    test: (text) => /(してみて|やってみて|始めよう|試してみる|決めよう)/.test(text),
  },
  {
    tag: "静かな比喩",
    test: (text) => /(灯り|空気|温度|余白|静か|灰色|芽)/.test(text),
  },
];

export function inferMemoryTags(...parts: Array<string | null | undefined>): string[] {
  const text = parts
    .filter((part): part is string => typeof part === "string" && part.trim() !== "")
    .join(" ");

  if (text === "") return [];

  return TAG_PATTERNS.filter((pattern) => pattern.test(text))
    .map((pattern) => pattern.tag)
    .slice(0, 5);
}
