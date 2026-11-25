import 'server-only';

// İsteğe bağlı LLM yolu (ücretsiz katman): GEMINI_API_KEY tanımlıysa Gemini REST ile yazı üretilir.
// Anahtar yoksa ya da çağrı başarısızsa null döner; çağıran şablon tabanlı üretime düşer.

const DEFAULT_MODEL = 'gemini-2.5-flash';

export const geminiConfigured = (): boolean => !!process.env.GEMINI_API_KEY;

/** Gemini'den JSON metni ister. Hata/zaman aşımında null (hata fırlatmaz). */
export async function generateWithGemini(prompt: string, timeoutMs = 45_000): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 4096, responseMimeType: 'application/json' },
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      console.warn('[blog-llm] Gemini', res.status, (await res.text()).slice(0, 200));
      return null;
    }
    const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    return text.trim() || null;
  } catch (err) {
    console.warn('[blog-llm] Gemini hata', err);
    return null;
  }
}
