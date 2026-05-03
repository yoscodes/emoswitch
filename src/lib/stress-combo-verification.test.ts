import { describe, expect, it } from "vitest";

import { LAB_MANUAL_EDGE_REVIEW_PRIORITY } from "@/lib/lab-manual-edge-review";
import {
  buildComboPolarityTieBreakLine,
  buildUsagePurposeStrategyComboDirective,
  COMBO_BODIES,
  STRESS_COMBO_VERIFICATION_TARGETS,
} from "@/lib/usage-purpose-strategy-combo";

/**
 * 実 LLM のストレステストは Lab で手動実施する。
 * ここでは「対極組み合わせでプロンプトが薄まらない」ことの下限として、
 * COMBO 本文と板挟み解消行が両立しているかだけを固定する。
 */
describe("stress combo verification (prompt contract)", () => {
  for (const { purpose, goal } of STRESS_COMBO_VERIFICATION_TARGETS) {
    it(`COMBO + 板挟みが揃う: ${purpose} × ${goal}`, () => {
      const combo = buildUsagePurposeStrategyComboDirective(purpose, goal);
      const tie = buildComboPolarityTieBreakLine(purpose, goal);
      const body = COMBO_BODIES[purpose][goal];

      expect(combo.length).toBeGreaterThan(80);
      expect(body.length).toBeGreaterThan(40);
      expect(tie).toBeTruthy();
      expect(tie).toContain("板挟み");

      if (purpose === "communication" && goal === "logic") {
        expect(body).toMatch(/短文|コピー|論理|CTA|チャネル|配信|フック/);
      }
      if (purpose === "refinement" && goal === "empathy") {
        expect(body).toMatch(/共感|感情|解像度|痛み/);
        expect(body).toMatch(/仮説|検証|STEP|アクションプラン/);
      }
    });
  }
});

describe("Lab manual edge review cue", () => {
  it("板挟み目視の優先ペアが定義されている", () => {
    expect(LAB_MANUAL_EDGE_REVIEW_PRIORITY.length).toBe(2);
    expect(LAB_MANUAL_EDGE_REVIEW_PRIORITY.map((e) => e.id)).toEqual([
      "communication-logic",
      "refinement-empathy",
    ]);
  });
});
