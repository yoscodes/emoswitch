import { DATA_SYNC_EVENT } from "@/lib/data-sync";
import { coercePlanItemBodyAndImmediate } from "@/lib/plan-item-coerce";
import { findPlanBodyImmediateSplit, PLAN_IMMEDIATE_ACTION_MARK, storedBodyContainsImmediateMarker } from "@/lib/plan-immediate-mark";

const DEPLOY_CTX_KEY = "emoswitch_roadmap_deploy_ctx_v1";
const FIELD_LOG_KEY = "emoswitch_identity_field_buffer_v1";
const FIRST_ACTION_DONE_KEY = "emoswitch_roadmap_first_action_done_v1";
const CHECKLIST_KEY = "emoswitch_roadmap_checklist_v1";

export const STORED_IMMEDIATE_ACTION_MARK = PLAN_IMMEDIATE_ACTION_MARK;

export type RoadmapDeployProtocolLineV1 = {
  hat: string;
  short: string;
  line: string;
};

export type RoadmapDeployContextV1 = {
  v: 1;
  seriesId: string;
  planTitle: string;
  usagePurposeLabel: string;
  usagePurposePhase: string;
  weaponLabel: string;
  firstAction: string;
  finalGoal: string;
  protocolLines: RoadmapDeployProtocolLineV1[];
  dnaAlignmentReason: string | null;
  /** Lab 生成時点の Identity 共鳴度（0–100）。Roadmap のリアルタイム整合のベースライン */
  identityResonancePercent: number | null;
  deployedAt: string;
};

export type IdentityFieldLogEntryV1 = {
  at: string;
  seriesId: string;
  itemId: string;
  quickFeedback: "hot" | "cold" | null;
  likes: number | null;
  memo: string | null;
};

/** Roadmap 下部アラート: バッファ件数がこの数以上なら Identity 再調整を推奨 */
export const IDENTITY_FIELD_BUFFER_ALERT_TOTAL = 3;
/** Roadmap 下部アラート: Hot のみの積み上げがこの数以上でも推奨 */
export const IDENTITY_FIELD_BUFFER_ALERT_HOT = 2;

function isIdentityFieldLogEntry(value: unknown): value is IdentityFieldLogEntryV1 {
  if (typeof value !== "object" || value === null) return false;
  const o = value as Record<string, unknown>;
  return (
    typeof o.at === "string" &&
    typeof o.seriesId === "string" &&
    typeof o.itemId === "string" &&
    (o.quickFeedback === "hot" || o.quickFeedback === "cold" || o.quickFeedback === null || o.quickFeedback === undefined) &&
    (typeof o.likes === "number" || o.likes === null || o.likes === undefined) &&
    (typeof o.memo === "string" || o.memo === null || o.memo === undefined)
  );
}

export function readIdentityFieldLog(): IdentityFieldLogEntryV1[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(FIELD_LOG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isIdentityFieldLogEntry);
  } catch {
    return [];
  }
}

export function summarizeIdentityFieldBuffer(logs: readonly IdentityFieldLogEntryV1[]): {
  total: number;
  hot: number;
  cold: number;
  withMemo: number;
} {
  let hot = 0;
  let cold = 0;
  let withMemo = 0;
  for (const e of logs) {
    if (e.quickFeedback === "hot") hot += 1;
    if (e.quickFeedback === "cold") cold += 1;
    if (e.memo?.trim()) withMemo += 1;
  }
  return { total: logs.length, hot, cold, withMemo };
}

export function summarizeIdentityFieldBufferBySeries(
  logs: readonly IdentityFieldLogEntryV1[],
): Record<string, { total: number; hot: number; cold: number; withMemo: number }> {
  const out: Record<string, { total: number; hot: number; cold: number; withMemo: number }> = {};
  for (const e of logs) {
    const key = e.seriesId;
    if (!key) continue;
    if (!out[key]) {
      out[key] = { total: 0, hot: 0, cold: 0, withMemo: 0 };
    }
    out[key].total += 1;
    if (e.quickFeedback === "hot") out[key].hot += 1;
    if (e.quickFeedback === "cold") out[key].cold += 1;
    if (e.memo?.trim()) out[key].withMemo += 1;
  }
  return out;
}

/** Lab の Scrap 先頭へ貼る用。Roadmap 検証バッファをそのまま Raw Context に混ぜられる */
export function formatIdentityFieldBufferForLabScrap(entries: readonly IdentityFieldLogEntryV1[]): string {
  if (entries.length === 0) return "";
  const lines = entries.map((e, i) => {
    const fb =
      e.quickFeedback === "hot" ? "手応えあり" : e.quickFeedback === "cold" ? "違和感あり" : "反応ラベル未設定";
    const parts: string[] = [`${i + 1}. [${fb}]`];
    if (e.likes != null && e.likes > 0) parts.push(`数値: ${e.likes}`);
    if (e.memo?.trim()) parts.push(`想定とのズレ: ${e.memo.trim()}`);
    return parts.join(" ");
  });
  return `【前回の検証からの学び（Roadmap・${entries.length}件）】\n${lines.join("\n")}\n`;
}

/** Identity 側で還流を取り込んだあと、バッファを空にする */
export function clearIdentityFieldLog(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(FIELD_LOG_KEY);
  window.dispatchEvent(new Event(DATA_SYNC_EVENT));
}

export function splitStoredPlanBody(body: string): { narrative: string; immediate: string | null } {
  const hit = findPlanBodyImmediateSplit(body);
  if (hit === null) return { narrative: body.trim(), immediate: null };
  return {
    narrative: body.slice(0, hit.idx).trim(),
    immediate: body.slice(hit.idx + hit.mark.length).trim() || null,
  };
}

/** Lab 保存時: API の body + immediateAction を1フィールドに結合（Roadmap 側は splitStoredPlanBody で復元） */
export function mergeStoredPlanBodyForStorage(body: string, immediateAction: string): string {
  const trimmed = immediateAction.trim();
  if (!trimmed && !storedBodyContainsImmediateMarker(body)) {
    return body.trim();
  }
  const { body: b, immediateAction: a } = coercePlanItemBodyAndImmediate(body, immediateAction);
  return `${b.trim()}\n\n${STORED_IMMEDIATE_ACTION_MARK}${a}`;
}

export function readRoadmapDeployContext(): RoadmapDeployContextV1 | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(DEPLOY_CTX_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RoadmapDeployContextV1;
    if (parsed?.v !== 1 || typeof parsed.seriesId !== "string") return null;
    const pct = parsed.identityResonancePercent;
    return {
      ...parsed,
      planTitle: typeof parsed.planTitle === "string" ? parsed.planTitle : "（無題の作戦）",
      identityResonancePercent:
        typeof pct === "number" && !Number.isNaN(pct) ? Math.min(100, Math.max(0, Math.round(pct))) : null,
    };
  } catch {
    return null;
  }
}

export function writeRoadmapDeployContext(ctx: RoadmapDeployContextV1): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(DEPLOY_CTX_KEY, JSON.stringify(ctx));
  window.dispatchEvent(new Event(DATA_SYNC_EVENT));
}

export function clearRoadmapDeployContext(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(DEPLOY_CTX_KEY);
  window.dispatchEvent(new Event(DATA_SYNC_EVENT));
}

export function readFirstActionDone(seriesId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = sessionStorage.getItem(FIRST_ACTION_DONE_KEY);
    if (!raw) return false;
    const map = JSON.parse(raw) as Record<string, boolean>;
    return Boolean(map[seriesId]);
  } catch {
    return false;
  }
}

export function writeFirstActionDone(seriesId: string, done: boolean): void {
  if (typeof window === "undefined") return;
  try {
    const raw = sessionStorage.getItem(FIRST_ACTION_DONE_KEY);
    const map = (raw ? JSON.parse(raw) : {}) as Record<string, boolean>;
    map[seriesId] = done;
    sessionStorage.setItem(FIRST_ACTION_DONE_KEY, JSON.stringify(map));
  } catch {
    sessionStorage.setItem(FIRST_ACTION_DONE_KEY, JSON.stringify({ [seriesId]: done }));
  }
}

/** First Action + 各STEP + Final Goal の 5 項目チェック（未設定は false） */
export function readRoadmapChecklist(seriesId: string): boolean[] {
  if (typeof window === "undefined") return [false, false, false, false, false];
  try {
    const raw = sessionStorage.getItem(CHECKLIST_KEY);
    const map = (raw ? JSON.parse(raw) : {}) as Record<string, boolean[]>;
    const row = map[seriesId];
    if (!Array.isArray(row) || row.length !== 5) return [false, false, false, false, false];
    return row.map(Boolean);
  } catch {
    return [false, false, false, false, false];
  }
}

export function writeRoadmapChecklist(seriesId: string, checks: boolean[]): void {
  if (typeof window === "undefined") return;
  const next = checks.slice(0, 5);
  while (next.length < 5) next.push(false);
  try {
    const raw = sessionStorage.getItem(CHECKLIST_KEY);
    const map = (raw ? JSON.parse(raw) : {}) as Record<string, boolean[]>;
    map[seriesId] = next;
    sessionStorage.setItem(CHECKLIST_KEY, JSON.stringify(map));
    const first = Boolean(next[0]);
    writeFirstActionDone(seriesId, first);
  } catch {
    sessionStorage.setItem(CHECKLIST_KEY, JSON.stringify({ [seriesId]: next }));
  }
}

export function appendIdentityFieldLog(entry: IdentityFieldLogEntryV1): void {
  if (typeof window === "undefined") return;
  try {
    const raw = sessionStorage.getItem(FIELD_LOG_KEY);
    const list = (raw ? JSON.parse(raw) : []) as IdentityFieldLogEntryV1[];
    const next = [...list.filter(isIdentityFieldLogEntry), entry].slice(-40);
    sessionStorage.setItem(FIELD_LOG_KEY, JSON.stringify(next));
  } catch {
    sessionStorage.setItem(FIELD_LOG_KEY, JSON.stringify([entry]));
  }
  window.dispatchEvent(new Event(DATA_SYNC_EVENT));
}
