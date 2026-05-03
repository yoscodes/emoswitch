import { describe, expect, it } from "vitest";

import {
  LEGACY_PLAN_IMMEDIATE_ACTION_MARK,
  PLAN_IMMEDIATE_ACTION_MARK,
  PLAN_IMMEDIATE_ACTION_MARK_FULLWIDTH_COLON,
} from "@/lib/plan-immediate-mark";

import { coercePlanItemBodyAndImmediate } from "./plan-item-coerce";

describe("coercePlanItemBodyAndImmediate", () => {
  it("本文にマーカーがあれば本文から外し immediate に寄せる", () => {
    const narrative = "市場向けの叙述です。";
    const tail = "今日、固定ポスト案を3本スマホメモに書く。";
    const body = `${narrative}\n\n${PLAN_IMMEDIATE_ACTION_MARK}${tail}`;
    const out = coercePlanItemBodyAndImmediate(body, "");
    expect(out.body).toBe(narrative);
    expect(out.immediateAction).toContain("固定ポスト");
  });

  it("マーカーがなければそのまま（immediate は最低10文字を満たす）", () => {
    const body = "本文だけ。";
    const act = "今日、知人1人にこの案を読み上げて感想を1つもらう。";
    const out = coercePlanItemBodyAndImmediate(body, act);
    expect(out.body).toBe(body);
    expect(out.immediateAction).toBe(act);
  });

  it("レガシー（コロンなし）マーカーでも分割できる", () => {
    const body = `叙述です。\n\n${LEGACY_PLAN_IMMEDIATE_ACTION_MARK}今日、メモに3行だけ書く。`;
    const out = coercePlanItemBodyAndImmediate(body, "");
    expect(out.body).toBe("叙述です。");
    expect(out.immediateAction).toContain("メモ");
  });

  it("全角コロンのマーカーでも分割できる", () => {
    const narrative = "叙述。";
    const tail = "今日、投稿案を1本だけ下書きに保存する。";
    const body = `${narrative}\n\n${PLAN_IMMEDIATE_ACTION_MARK_FULLWIDTH_COLON}${tail}`;
    const out = coercePlanItemBodyAndImmediate(body, "");
    expect(out.body).toBe(narrative);
    expect(out.immediateAction).toContain("下書き");
  });
});
