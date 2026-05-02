import { describe, expect, it } from "vitest";

import { findNgWordHit } from "./ng-word-check";

describe("findNgWordHit", () => {
  it("ヒットした語を返す", () => {
    expect(findNgWordHit("絶対に失敗しない", ["絶対"])).toBe("絶対");
  });

  it("ヒットしなければ null", () => {
    expect(findNgWordHit("丁寧に進めます", ["絶対", "禁止"])).toBeNull();
  });
});
