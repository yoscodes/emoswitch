import { describe, expect, it } from "vitest";

import { STRATEGY_GOALS } from "@/lib/strategy-goal";
import { buildUsagePurposeStrategyComboDirective } from "@/lib/usage-purpose-strategy-combo";
import type { UsagePurposeKey } from "@/lib/usage-purpose-step-plan";

const PURPOSES: UsagePurposeKey[] = ["discovery", "blueprint", "refinement", "communication"];

describe("buildUsagePurposeStrategyComboDirective", () => {
  it("12パターンすべて生成でき、過剰な最優先表現を含まない", () => {
    for (const purpose of PURPOSES) {
      for (const goal of STRATEGY_GOALS) {
        const line = buildUsagePurposeStrategyComboDirective(purpose, goal);
        expect(line.length).toBeGreaterThan(40);
        expect(line).not.toContain("【最優先");
        expect(line).toContain("用途×武器");
      }
    }
  });
});
