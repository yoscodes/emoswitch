/**
 * 用途別フェーズ（探索・構築・研磨・伝達）の単一ソースは `@/lib/usage-purpose-step-plan`。
 * Lab UI・generate-triple から参照する場合はここを経由してもよい。
 */
export {
  USAGE_PURPOSE_PHASE_PLAN,
  buildSeriesSlotLabelForPurpose,
  buildUsagePurposeStepPlanPromptBlock,
  getUsagePurposePreviewGoalByStep,
  getUsagePurposeStepRoleLines,
  type UsagePurposeKey,
} from "@/lib/usage-purpose-step-plan";
