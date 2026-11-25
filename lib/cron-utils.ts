// Cron rotaları için saf yardımcılar (Firebase/Next bağımlılığı yok → test edilebilir).

/** CRON_SECRET tanımlıysa `Authorization: Bearer <secret>` şart; tanımlı değilse REDDEDİLİR (sunucu Oracle'da, açık uç bırakılmaz). */
export function isCronAuthorized(secret: string | undefined, authorizationHeader: string | null): boolean {
  if (!secret) return false;
  return authorizationHeader === `Bearer ${secret}`;
}

export interface StepResult { name: string; ok: boolean; value?: unknown; error?: string }

/**
 * Adımları sırayla çalıştırır; bir adımın hatası diğerlerini ENGELLEMEZ.
 * Sıra önemlidir: müşteriye görünen iş (blog yayını) en başa konur.
 */
export async function runSteps(steps: [string, () => Promise<unknown>][]): Promise<StepResult[]> {
  const out: StepResult[] = [];
  for (const [name, fn] of steps) {
    try {
      out.push({ name, ok: true, value: await fn() });
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      console.error(`[cron ${name}]`, e);
      out.push({ name, ok: false, error: error.slice(0, 200) });
    }
  }
  return out;
}
