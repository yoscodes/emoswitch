import type { ConceptBrief } from "@/lib/types";

const CONCEPT_BRIEF_MARK = "[[concept_brief_v1:";
const CONCEPT_BRIEF_END_MARK = "]]";

function isConceptBrief(value: unknown): value is ConceptBrief {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<keyof ConceptBrief, unknown>;
  return (
    typeof row.oneLiner === "string" &&
    typeof row.audience === "string" &&
    typeof row.pain === "string" &&
    typeof row.valueProposition === "string" &&
    typeof row.whyNow === "string" &&
    typeof row.whyMe === "string" &&
    typeof row.mvp === "string" &&
    typeof row.elevatorPitch === "string"
  );
}

export function stripConceptBriefFromAdviceHint(value: string | null | undefined): string | null {
  if (!value) return value ?? null;
  const start = value.indexOf(CONCEPT_BRIEF_MARK);
  if (start < 0) return value;
  const stripped = value.slice(0, start).trim();
  return stripped.length > 0 ? stripped : null;
}

export function extractConceptBriefFromAdviceHint(value: string | null | undefined): ConceptBrief | null {
  if (!value) return null;
  const start = value.indexOf(CONCEPT_BRIEF_MARK);
  if (start < 0) return null;
  const payloadStart = start + CONCEPT_BRIEF_MARK.length;
  const end = value.indexOf(CONCEPT_BRIEF_END_MARK, payloadStart);
  if (end < 0) return null;
  try {
    const decoded = decodeURIComponent(value.slice(payloadStart, end));
    const parsed = JSON.parse(decoded) as unknown;
    return isConceptBrief(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function embedConceptBriefInAdviceHint(
  adviceHint: string | null | undefined,
  conceptBrief: ConceptBrief | null | undefined,
): string | null {
  const cleanAdvice = stripConceptBriefFromAdviceHint(adviceHint)?.trim() ?? "";
  if (!conceptBrief) return cleanAdvice || null;
  const encoded = encodeURIComponent(JSON.stringify(conceptBrief));
  const marker = `${CONCEPT_BRIEF_MARK}${encoded}${CONCEPT_BRIEF_END_MARK}`;
  return cleanAdvice ? `${cleanAdvice}\n\n${marker}` : marker;
}
