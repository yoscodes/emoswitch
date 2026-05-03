import { findPlanBodyImmediateSplit } from "@/lib/plan-immediate-mark";

const FALLBACK_IMMEDIATE =
  "今日、このSTEPの狙いを一言にし、声に出して読み直して言い回しを1箇所だけ直す。";

/**
 * LLM が本文末尾に「【すぐやること】:」行を付けた場合、叙述から外して immediateAction へ寄せる。
 * immediate が空／短すぎる場合はフォールバックで splitStoredPlanBody を壊さない。
 */
export function coercePlanItemBodyAndImmediate(body: string, immediateAction: string): {
  body: string;
  immediateAction: string;
} {
  let b = body.trim();
  let a = immediateAction.trim();
  const hit = findPlanBodyImmediateSplit(b);
  if (hit !== null) {
    const tail = b.slice(hit.idx + hit.mark.length).trim();
    b = b.slice(0, hit.idx).trim();
    if (tail) {
      if (!a) a = tail;
      else {
        const head = tail.slice(0, 28);
        if (!a.includes(head)) {
          a = `${a} ${tail}`.replace(/\s+/g, " ").trim();
        }
      }
    }
  }
  if (a.length < 10) {
    a = FALLBACK_IMMEDIATE;
  }
  if (a.length > 180) {
    a = a.slice(0, 180).trim();
  }
  if (!b.trim()) {
    b = "このステップの市場への見せ方・検証の焦点・観測したい反応を、簡潔に記す。";
  }
  return { body: b, immediateAction: a };
}
