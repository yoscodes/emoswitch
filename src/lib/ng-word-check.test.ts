import { describe, expect, it } from "vitest";

import { findNgWordHit, maskNgWordsInText } from "./ng-word-check";

describe("findNgWordHit", () => {
  it("ヒットした語を返す", () => {
    expect(findNgWordHit("絶対に失敗しない", ["絶対"])).toBe("絶対");
  });

  it("ヒットしなければ null", () => {
    expect(findNgWordHit("丁寧に進めます", ["絶対", "禁止"])).toBeNull();
  });
});

describe("maskNgWordsInText", () => {
  it("ヒットした語をマスクして一覧で返す", () => {
    expect(maskNgWordsInText("絶対に失敗しない成功法則", ["絶対", "成功法則"])).toEqual({
      text: "[My Tabooにより検閲]に失敗しない[My Tabooにより検閲]",
      hits: ["成功法則", "絶対"],
    });
  });

  it("正規表現の特殊文字を含む語もそのまま扱う", () => {
    expect(maskNgWordsInText("A+B を売りにする", ["A+B"])).toEqual({
      text: "[My Tabooにより検閲] を売りにする",
      hits: ["A+B"],
    });
  });
});
