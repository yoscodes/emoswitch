"use client";

import { listGenerations } from "@/lib/generation-storage";
import { loadGhostSettings } from "@/lib/ghost-storage";
import { supabase } from "@/lib/supabase/client";
import type { CreditSummary, GenerationRecord, GhostSettings, UserProfileSettings } from "@/lib/types";

const STORAGE_MIGRATION_FLAG = "emoswitch_supabase_migrated_v1";
export const DATA_SYNC_EVENT = "emoswitch:data-sync";

let bootstrapPromise: Promise<void> | null = null;

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

export function notifyDataSync(): void {
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

export async function saveGenerationRecord(
  payload: Omit<GenerationRecord, "id" | "createdAt">,
): Promise<GenerationRecord> {
  await ensureDemoWorkspace();
  const data = await requestJson<{ row: GenerationRecord }>("/api/generations", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  notifyDataSync();
  return data.row;
}

export async function patchGenerationRecord(
  id: string,
  payload: Partial<Pick<GenerationRecord, "selectedIndex" | "likes" | "memo">>,
): Promise<GenerationRecord> {
  await ensureDemoWorkspace();
  const data = await requestJson<{ row: GenerationRecord }>(`/api/generations/${id}`, {
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

export async function fetchGhostSettings(): Promise<GhostSettings> {
  await ensureDemoWorkspace();
  const data = await requestJson<{ settings: GhostSettings }>("/api/ghost-settings");
  return data.settings;
}

export async function updateGhostSettings(settings: GhostSettings): Promise<GhostSettings> {
  await ensureDemoWorkspace();
  const data = await requestJson<{ settings: GhostSettings }>("/api/ghost-settings", {
    method: "PUT",
    body: JSON.stringify(settings),
  });
  notifyDataSync();
  return data.settings;
}

export async function fetchCreditSummary(): Promise<CreditSummary> {
  await ensureDemoWorkspace();
  const data = await requestJson<{ summary: CreditSummary }>("/api/credits");
  return data.summary;
}

export async function fetchUserProfile(): Promise<UserProfileSettings> {
  const data = await requestJson<{ profile: UserProfileSettings }>("/api/profile");
  return data.profile;
}

export async function saveUserProfile(
  payload: Pick<UserProfileSettings, "displayName" | "defaultEmotion" | "writingStyle" | "sentenceStyle">,
): Promise<UserProfileSettings> {
  const data = await requestJson<{ profile: UserProfileSettings }>("/api/profile", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
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
