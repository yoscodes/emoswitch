/**
 * Gemini / Google Generative Language のクォータ・レート制限に対する待機と、
 * Vercel AI SDK の短い指数バックオフ（デフォルト maxRetries: 2）による連打を避けるためのユーティリティ。
 */

function flattenAiErrorMessage(error: unknown): string {
  if (error == null) return "";
  if (error instanceof Error) {
    const chunks: string[] = [error.message];
    const rec = error as { errors?: unknown[]; lastError?: unknown };
    if (Array.isArray(rec.errors)) {
      for (const inner of rec.errors) {
        if (inner instanceof Error) chunks.push(inner.message);
        else if (inner != null) chunks.push(String(inner));
      }
    }
    if (rec.lastError instanceof Error) chunks.push(rec.lastError.message);
    else if (rec.lastError != null) chunks.push(String(rec.lastError));
    return chunks.join(" ");
  }
  return String(error);
}

/** メッセージ内の「Please retry in 11.87s」等から待機 ms を推定。無ければ汎用クォータ用の待機。 */
export function parseGeminiQuotaRetryDelayMs(text: string): number | null {
  const joined = text.replace(/\s+/g, " ");
  const explicit = /please\s+retry\s+in\s+([\d.]+)\s*s/i.exec(joined);
  if (explicit) {
    const sec = Number.parseFloat(explicit[1] ?? "");
    if (!Number.isNaN(sec) && sec >= 0) {
      return Math.min(120_000, Math.ceil(sec * 1000) + 750);
    }
  }
  if (/exceeded your current quota|quota exceeded|Quota exceeded|rate.?limit|resource.?exhausted|\b429\b/i.test(joined)) {
    return 15_000;
  }
  return null;
}

function sleep(ms: number, abortSignal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (abortSignal?.aborted) {
      reject(new Error("Aborted"));
      return;
    }
    const id = setTimeout(() => {
      abortSignal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(id);
      abortSignal?.removeEventListener("abort", onAbort);
      reject(new Error("Aborted"));
    };
    abortSignal?.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * `generateObject({ maxRetries: 0 })` などを渡し、クォータ時は API が示す秒数だけ待ってから再試行する。
 * SDK 既定の maxRetries: 2 では待機が短く、無料枠の「retry in 12s」を踏まえられないことがある。
 */
export async function withGeminiQuotaAwareRetry<T>(
  run: () => Promise<T>,
  options?: { maxAttempts?: number; abortSignal?: AbortSignal },
): Promise<T> {
  const maxAttempts = options?.maxAttempts ?? 5;
  const signal = options?.abortSignal;
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      lastError = error;
      const text = flattenAiErrorMessage(error);
      const waitMs = parseGeminiQuotaRetryDelayMs(text);
      if (waitMs == null || attempt === maxAttempts) {
        throw error;
      }
      await sleep(waitMs, signal);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/** クライアント向けの短文（日本語）。クォータ時は待ち秒の目安と公式ドキュメントへ誘導。 */
export function formatAiGatewayErrorForClient(error: unknown): string {
  let raw = flattenAiErrorMessage(error);
  const retryWrapper = /^Failed after \d+ attempts\.\s*Last error:\s*/i;
  if (retryWrapper.test(raw)) {
    raw = raw.replace(retryWrapper, "").trim();
  }
  if (/exceeded your current quota|quota exceeded|Quota exceeded/i.test(raw)) {
    const delay = parseGeminiQuotaRetryDelayMs(raw);
    const sec = delay != null ? Math.max(1, Math.round(delay / 1000)) : 15;
    return `Gemini API の利用上限に達しています（無料枠のリクエスト数など）。約${sec}秒待ってから再度お試しください。枠の確認: https://ai.google.dev/gemini-api/docs/rate-limits`;
  }
  if (/rate.?limit|resource.?exhausted|429/i.test(raw)) {
    return `Gemini API のレート制限に達しています。しばらく待ってから再度お試しください。https://ai.google.dev/gemini-api/docs/rate-limits`;
  }
  return raw.length > 500 ? `${raw.slice(0, 500)}…` : raw;
}

export function getAiGatewayErrorHttpStatus(error: unknown): number {
  const t = flattenAiErrorMessage(error);
  if (/exceeded your current quota|quota exceeded|Quota exceeded|rate.?limit|resource.?exhausted|\b429\b/i.test(t)) {
    return 429;
  }
  return 400;
}
