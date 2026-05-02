import { describe, expect, it } from "vitest";

import {
  mergeStoredPlanBodyForStorage,
  splitStoredPlanBody,
  STORED_IMMEDIATE_ACTION_MARK,
} from "./roadmap-deploy";

describe("splitStoredPlanBody", () => {
  it("区切りなしなら全文が narrative", () => {
    const body = "第一段。\n第二段。";
    expect(splitStoredPlanBody(body)).toEqual({ narrative: body, immediate: null });
  });

  it("【すぐやること】以降を immediate に分離", () => {
    const narrative = "本文だけ。";
    const immediate = "動詞で始める一行。";
    const body = `${narrative}\n\n${STORED_IMMEDIATE_ACTION_MARK}${immediate}`;
    expect(splitStoredPlanBody(body)).toEqual({ narrative, immediate });
  });

  it("区切り直後が空なら immediate は null", () => {
    const body = `本文\n\n${STORED_IMMEDIATE_ACTION_MARK}`;
    expect(splitStoredPlanBody(body)).toEqual({ narrative: "本文", immediate: null });
  });

  it("先頭に区切りがあると narrative は空", () => {
    const body = `${STORED_IMMEDIATE_ACTION_MARK}すぐやる`;
    expect(splitStoredPlanBody(body)).toEqual({ narrative: "", immediate: "すぐやる" });
  });
});

describe("mergeStoredPlanBodyForStorage + splitStoredPlanBody", () => {
  it("往復で叙述とすぐやることが復元できる", () => {
    const apiBody = "ステップの叙述。チャネルと狙い。";
    const apiImmediate = "今日中にGoogleフォームを1本作り、3人に送る。";
    const stored = mergeStoredPlanBodyForStorage(apiBody, apiImmediate);
    expect(splitStoredPlanBody(stored)).toEqual({
      narrative: apiBody,
      immediate: apiImmediate,
    });
  });

  it("immediate が空ならマークを付けず結合も空扱い", () => {
    const apiBody = "本文のみ";
    expect(mergeStoredPlanBodyForStorage(apiBody, "  ")).toBe(apiBody);
  });
});
