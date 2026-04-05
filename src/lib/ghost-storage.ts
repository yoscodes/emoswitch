import type { GhostSettings } from "@/lib/types";

const KEY = "emoswitch_ghost_v1";

const defaultSettings: GhostSettings = {
  profileUrl: "",
  ngWords: [],
  stylePrompt: "",
  manualPosts: [],
  personaKeywords: [],
  personaSummary: "",
  personaEvidence: [],
  personaStatus: "empty",
  personaLastAnalyzedHotCount: 0,
};

export function loadGhostSettings(): GhostSettings {
  if (typeof window === "undefined") return defaultSettings;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSettings;
    const parsed = JSON.parse(raw) as Partial<GhostSettings>;
    return {
      profileUrl: typeof parsed.profileUrl === "string" ? parsed.profileUrl : "",
      ngWords: Array.isArray(parsed.ngWords)
        ? parsed.ngWords.filter((w): w is string => typeof w === "string")
        : [],
      stylePrompt: typeof parsed.stylePrompt === "string" ? parsed.stylePrompt : "",
      manualPosts: Array.isArray(parsed.manualPosts)
        ? parsed.manualPosts.filter((post): post is string => typeof post === "string")
        : [],
      personaKeywords: Array.isArray(parsed.personaKeywords)
        ? parsed.personaKeywords.filter((keyword): keyword is string => typeof keyword === "string")
        : [],
      personaSummary: typeof parsed.personaSummary === "string" ? parsed.personaSummary : "",
      personaEvidence: Array.isArray(parsed.personaEvidence)
        ? parsed.personaEvidence.filter((item): item is string => typeof item === "string")
        : [],
      personaStatus:
        parsed.personaStatus === "draft" || parsed.personaStatus === "approved"
          ? parsed.personaStatus
          : "empty",
      personaLastAnalyzedHotCount:
        typeof parsed.personaLastAnalyzedHotCount === "number" && Number.isFinite(parsed.personaLastAnalyzedHotCount)
          ? parsed.personaLastAnalyzedHotCount
          : 0,
    };
  } catch {
    return defaultSettings;
  }
}

export function saveGhostSettings(settings: GhostSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(settings));
}
