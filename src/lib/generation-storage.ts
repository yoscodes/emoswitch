import type { GenerationRecord } from "@/lib/types";

const KEY = "emoswitch_generations_v1";

function loadRaw(): GenerationRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as GenerationRecord[]) : [];
  } catch {
    return [];
  }
}

export function listGenerations(): GenerationRecord[] {
  return loadRaw().sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function saveGeneration(entry: Omit<GenerationRecord, "id" | "createdAt"> & { id?: string }): GenerationRecord {
  const list = loadRaw();
  const id = entry.id ?? crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const row: GenerationRecord = {
    id,
    createdAt,
    draft: entry.draft,
    emotion: entry.emotion,
    intensity: entry.intensity,
    speedMode: entry.speedMode,
    variants: entry.variants,
    hashtags: entry.hashtags,
    selectedIndex: entry.selectedIndex ?? null,
    likes: entry.likes ?? null,
    memo: entry.memo ?? null,
    adviceHint: entry.adviceHint ?? null,
  };
  const next = [row, ...list.filter((g) => g.id !== id)];
  localStorage.setItem(KEY, JSON.stringify(next));
  return row;
}

export function updateGeneration(
  id: string,
  patch: Partial<Pick<GenerationRecord, "selectedIndex" | "likes" | "memo">>,
): void {
  const list = loadRaw();
  const next = list.map((g) => (g.id === id ? { ...g, ...patch } : g));
  localStorage.setItem(KEY, JSON.stringify(next));
}

export function deleteGeneration(id: string): void {
  const list = loadRaw();
  const next = list.filter((g) => g.id !== id);
  localStorage.setItem(KEY, JSON.stringify(next));
}
