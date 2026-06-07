/** 生成テキストに NG 語が含まれるか（大文字小文字無視・部分一致） */
export function findNgWordHit(text: string, ngWords: readonly string[]): string | null {
  const haystack = text.toLowerCase();
  for (const raw of ngWords) {
    const needle = raw.trim().toLowerCase();
    if (!needle) continue;
    if (haystack.includes(needle)) return raw.trim();
  }
  return null;
}

const TABOO_MASK = "[My Tabooにより検閲]";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** 生成テキストに含まれる NG 語を機械的にマスクし、検閲した語を返す */
export function maskNgWordsInText(
  text: string,
  ngWords: readonly string[],
): { text: string; hits: string[] } {
  const normalizedWords = [...new Set(ngWords.map((word) => word.trim()).filter(Boolean))].sort(
    (left, right) => right.length - left.length,
  );
  if (normalizedWords.length === 0 || text === "") return { text, hits: [] };

  let masked = text;
  const hits = new Set<string>();

  for (const word of normalizedWords) {
    const pattern = new RegExp(escapeRegExp(word), "gi");
    if (!pattern.test(masked)) continue;
    hits.add(word);
    masked = masked.replace(pattern, TABOO_MASK);
  }

  return { text: masked, hits: [...hits] };
}
