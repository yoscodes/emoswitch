"use client";

import { listGenerations } from "@/lib/generation-storage";
import { loadGhostSettings } from "@/lib/ghost-storage";
import { supabase } from "@/lib/supabase/client";
import type {
  ArchiveInsights,
  ArchiveOverview,
  CreditSummary,
  GenerationRecord,
  GenerationSeriesItemRecord,
  GenerationSeriesRecord,
  GhostSettings,
  UserProfileSettings,
} from "@/lib/types";
import type { SeriesSlotKey } from "@/lib/series";

const STORAGE_MIGRATION_FLAG = "emoswitch_supabase_migrated_v1";
export const DATA_SYNC_EVENT = "emoswitch:data-sync";

let bootstrapPromise: Promise<void> | null = null;

type CachedResource<T> = {
  value: T | null;
  expiresAt: number;
  promise: Promise<T> | null;
};

function createCachedResource<T>(): CachedResource<T> {
  return {
    value: null,
    expiresAt: 0,
    promise: null,
  };
}

function readCachedResource<T>(resource: CachedResource<T>, ttlMs: number): T | null {
  if (ttlMs <= 0) return null;
  if (resource.value == null) return null;
  if (Date.now() >= resource.expiresAt) return null;
  return resource.value;
}

async function loadCachedResource<T>(
  resource: CachedResource<T>,
  ttlMs: number,
  loader: () => Promise<T>,
): Promise<T> {
  const cached = readCachedResource(resource, ttlMs);
  if (cached != null) {
    return cached;
  }

  if (resource.promise) {
    return resource.promise;
  }

  resource.promise = loader()
    .then((value) => {
      resource.value = value;
      resource.expiresAt = Date.now() + ttlMs;
      return value;
    })
    .finally(() => {
      resource.promise = null;
    });

  return resource.promise;
}

function invalidateCachedResource<T>(resource: CachedResource<T>): void {
  resource.value = null;
  resource.expiresAt = 0;
}

const archiveOverviewResource = createCachedResource<ArchiveOverview>();
const archiveInsightsResource = createCachedResource<ArchiveInsights>();
const ghostSettingsResource = createCachedResource<GhostSettings>();
const userProfileResource = createCachedResource<UserProfileSettings>();
const creditSummaryResource = createCachedResource<CreditSummary>();
const hypothesisCanvasResourceByKey = new Map<string, CachedResource<HypothesisCanvasResponse>>();

const ARCHIVE_OVERVIEW_TTL_MS = 30_000;
const GHOST_SETTINGS_TTL_MS = 30_000;
const USER_PROFILE_TTL_MS = 60_000;
const HYPOTHESIS_CANVAS_TTL_MS = 20_000;

async function getAccessToken(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session?.access_token ?? null;
}

async function requestJson<T>(input: string, init?: RequestInit): Promise<T> {
  const accessToken = await getAccessToken();
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(init?.headers ?? {}),
    },
  });

  const data = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(data.error ?? "通信に失敗しました");
  }

  return data;
}

export type GenerateTriplePayload = {
  draft: string;
  generationMode: "single" | "series";
  strategyGoal: "awareness" | "education" | "engagement";
  emotion: "empathy" | "toxic" | "mood" | "useful" | "minimal";
  speedMode: "flash" | "pro";
  intensity: number;
  ngWords?: string[];
  stylePrompt?: string;
  personaKeywords?: string[];
  personaSummary?: string;
  audience?: string;
  pain?: string;
  whyMe?: string;
  firstExperiment?: string;
};

export type GenerateSingleResponse = {
  variants: string[];
  variantFocuses: string[];
  hashtags: string[];
  adviceHint?: string;
  ghostWhisper?: string;
  memoryTags?: string[];
};

export type GenerateSeriesItem = {
  slotKey: SeriesSlotKey;
  slotLabel: string;
  body: string;
  hashtags: string[];
  validationMetric?: string;
};

export type GenerateSeriesResponse = {
  seriesTitle: string;
  items: GenerateSeriesItem[];
  adviceHint?: string;
  ghostWhisper?: string;
  memoryTags?: string[];
};

export type GenerateTripleResponse = GenerateSingleResponse | GenerateSeriesResponse;

export type HypothesisCanvasPayload = {
  draft: string;
  refinementAnswer?: string;
  generationMode: "single" | "series";
  emotion: "empathy" | "toxic" | "mood" | "useful" | "minimal";
  intensity: number;
  personaKeywords?: string[];
  personaSummary?: string;
  strategyLabel?: string;
};

export type HypothesisCanvasResponse = {
  summary: string;
  previewTitle: string;
  question: string;
  dnaAlignment: number;
  dnaReason: string;
  warning: string | null;
};

export type SaveSinglePayload = Omit<GenerationRecord, "id" | "createdAt">;
export type SaveSeriesPayload = Omit<GenerationSeriesRecord, "id" | "createdAt" | "items" | "generationMode"> & {
  generationMode: "series";
  items: Array<Pick<GenerationSeriesItemRecord, "slotKey" | "slotLabel" | "body" | "hashtags">>;
};

export function notifyDataSync(): void {
  invalidateCachedResource(archiveOverviewResource);
  invalidateCachedResource(archiveInsightsResource);
  invalidateCachedResource(creditSummaryResource);
  invalidateCachedResource(ghostSettingsResource);
  invalidateCachedResource(userProfileResource);
  window.dispatchEvent(new Event(DATA_SYNC_EVENT));
}

async function migrateLegacyStorageOnce(): Promise<void> {
  if (typeof window === "undefined") return;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return;

  const migrationKey = `${STORAGE_MIGRATION_FLAG}:${session.user.id}`;
  if (localStorage.getItem(migrationKey) === "1") return;

  const generations = listGenerations();
  const ghostSettings = loadGhostSettings();

  await requestJson<{ importedCount: number }>("/api/migrate-local", {
    method: "POST",
    body: JSON.stringify({
      generations,
      ghostSettings,
    }),
  });

  localStorage.setItem(migrationKey, "1");
  notifyDataSync();
}

export async function ensureDemoWorkspace(): Promise<void> {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      await requestJson("/api/bootstrap-demo");
      await migrateLegacyStorageOnce();
    })().catch((error) => {
      bootstrapPromise = null;
      throw error;
    });
  }

  await bootstrapPromise;
}

export async function migrateCurrentLocalDataAfterLogin(): Promise<void> {
  await ensureDemoWorkspace();
}

export async function fetchGenerations(): Promise<GenerationRecord[]> {
  await ensureDemoWorkspace();
  const data = await requestJson<{ rows: GenerationRecord[] }>("/api/generations");
  return data.rows;
}

export async function fetchArchiveOverview(): Promise<ArchiveOverview> {
  await ensureDemoWorkspace();
  return loadCachedResource(archiveOverviewResource, ARCHIVE_OVERVIEW_TTL_MS, () =>
    requestJson<ArchiveOverview>("/api/archive/insights"),
  );
}

export async function fetchArchiveInsights(): Promise<ArchiveInsights> {
  await ensureDemoWorkspace();
  return loadCachedResource(archiveInsightsResource, ARCHIVE_OVERVIEW_TTL_MS, async () => {
    const data = await requestJson<Pick<ArchiveOverview, "insights">>("/api/archive/insights?summaryOnly=1");
    return data.insights;
  });
}

export async function generateTriple(payload: GenerateTriplePayload): Promise<GenerateTripleResponse> {
  await ensureDemoWorkspace();
  return requestJson<GenerateTripleResponse>("/api/generate-triple", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function analyzeHypothesisCanvas(payload: HypothesisCanvasPayload): Promise<HypothesisCanvasResponse> {
  await ensureDemoWorkspace();
  const cacheKey = JSON.stringify({
    ...payload,
    draft: payload.draft.trim(),
    refinementAnswer: payload.refinementAnswer?.trim() ?? "",
    personaSummary: payload.personaSummary?.trim() ?? "",
    strategyLabel: payload.strategyLabel?.trim() ?? "",
  });
  if (hypothesisCanvasResourceByKey.size > 30) {
    hypothesisCanvasResourceByKey.clear();
  }
  const resource =
    hypothesisCanvasResourceByKey.get(cacheKey) ?? createCachedResource<HypothesisCanvasResponse>();

  hypothesisCanvasResourceByKey.set(cacheKey, resource);

  return loadCachedResource(resource, HYPOTHESIS_CANVAS_TTL_MS, () =>
    requestJson<HypothesisCanvasResponse>("/api/hypothesis-canvas", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  );
}

export async function saveGenerationRecord(
  payload: SaveSinglePayload | SaveSeriesPayload,
): Promise<GenerationRecord | GenerationSeriesRecord> {
  await ensureDemoWorkspace();
  const data = await requestJson<{ row: GenerationRecord | GenerationSeriesRecord }>("/api/generations", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  notifyDataSync();
  return data.row;
}

export async function seedArchiveSampleData(): Promise<{ insertedCount: number }> {
  await ensureDemoWorkspace();
  const data = await requestJson<{ insertedCount: number }>("/api/generations/seed", {
    method: "POST",
    body: JSON.stringify({}),
  });
  notifyDataSync();
  return data;
}

export async function patchGenerationRecord(
  id: string,
  payload: Partial<Pick<GenerationRecord, "selectedIndex" | "likes" | "memo" | "quickFeedback">>,
): Promise<GenerationRecord> {
  await ensureDemoWorkspace();
  const data = await requestJson<{ row: GenerationRecord }>(`/api/generations/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  notifyDataSync();
  return data.row;
}

export async function patchSeriesItemRecord(
  id: string,
  payload: Partial<Pick<GenerationSeriesItemRecord, "likes" | "memo" | "quickFeedback">>,
): Promise<GenerationSeriesItemRecord> {
  await ensureDemoWorkspace();
  const data = await requestJson<{ row: GenerationSeriesItemRecord }>(`/api/archive/series-items/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  notifyDataSync();
  return data.row;
}

export async function removeGenerationRecord(id: string): Promise<void> {
  await ensureDemoWorkspace();
  await requestJson(`/api/generations/${id}`, {
    method: "DELETE",
    body: JSON.stringify({}),
  });
  notifyDataSync();
}

export async function removeSeriesRecord(id: string): Promise<void> {
  await ensureDemoWorkspace();
  await requestJson(`/api/archive/series/${id}`, {
    method: "DELETE",
    body: JSON.stringify({}),
  });
  notifyDataSync();
}

export async function fetchGhostSettings(): Promise<GhostSettings> {
  await ensureDemoWorkspace();
  return loadCachedResource(ghostSettingsResource, GHOST_SETTINGS_TTL_MS, async () => {
    const data = await requestJson<{ settings: GhostSettings }>("/api/ghost-settings");
    return data.settings;
  });
}

export async function updateGhostSettings(settings: Partial<GhostSettings>): Promise<GhostSettings> {
  await ensureDemoWorkspace();
  const data = await requestJson<{ settings: GhostSettings }>("/api/ghost-settings", {
    method: "PUT",
    body: JSON.stringify(settings),
  });
  ghostSettingsResource.value = data.settings;
  ghostSettingsResource.expiresAt = Date.now() + GHOST_SETTINGS_TTL_MS;
  notifyDataSync();
  return data.settings;
}

export async function analyzePersona(): Promise<GhostSettings> {
  await ensureDemoWorkspace();
  const data = await requestJson<{ settings: GhostSettings }>("/api/persona/analyze", {
    method: "POST",
    body: JSON.stringify({}),
  });
  notifyDataSync();
  return data.settings;
}

export async function fetchCreditSummary(): Promise<CreditSummary> {
  await ensureDemoWorkspace();
  return loadCachedResource(creditSummaryResource, 0, async () => {
    const data = await requestJson<{ summary: CreditSummary }>("/api/credits");
    return data.summary;
  });
}

export async function fetchUserProfile(): Promise<UserProfileSettings> {
  return loadCachedResource(userProfileResource, USER_PROFILE_TTL_MS, async () => {
    const data = await requestJson<{ profile: UserProfileSettings }>("/api/profile");
    return data.profile;
  });
}

export async function saveUserProfile(
  payload: Pick<UserProfileSettings, "displayName" | "defaultEmotion" | "writingStyle" | "sentenceStyle">,
): Promise<UserProfileSettings> {
  const data = await requestJson<{ profile: UserProfileSettings }>("/api/profile", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  userProfileResource.value = data.profile;
  userProfileResource.expiresAt = Date.now() + USER_PROFILE_TTL_MS;
  notifyDataSync();
  return data.profile;
}

export async function resetArchive(): Promise<{ deletedCount: number }> {
  await ensureDemoWorkspace();
  const data = await requestJson<{ deletedCount: number }>("/api/generations", {
    method: "DELETE",
    body: JSON.stringify({}),
  });
  notifyDataSync();
  return data;
}
