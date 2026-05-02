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
