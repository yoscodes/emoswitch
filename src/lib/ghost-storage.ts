import type { GhostSettings } from "@/lib/types";

const KEY = "emoswitch_ghost_v1";

const defaultSettings: GhostSettings = {
  profileUrl: "",
  ngWords: [],
  stylePrompt: "",
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
    };
  } catch {
    return defaultSettings;
  }
}

export function saveGhostSettings(settings: GhostSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(settings));
}
