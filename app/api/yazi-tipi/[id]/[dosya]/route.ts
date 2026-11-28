import { mkdir, readFile, rename, writeFile } from 'fs/promises';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { fontInfo, isKnownFont } from '@/lib/tasarim/yazi-tipleri';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Diskte tutulur (Docker'da ayrı birim): siparişte kullanılan tip kaynak kapansa da basılabilir. */
const CACHE_DIR = path.join(process.cwd(), '.next', 'cache', 'yazi-tipleri');
const FILE_RE = /^(latin|latin-ext)-([1-9]00)-(normal|italic)\.woff2$/;

const send = (body: Buffer) =>
  new NextResponse(new Uint8Array(body), {
    headers: { 'Content-Type': 'font/woff2', 'Cache-Control': 'public, max-age=31536000, immutable' },
  });

const missing = (status: number) => new NextResponse(null, { status, headers: { 'Cache-Control': 'no-store' } });

/** Listedeki bir yazı tipinin dosyası: ziyaretçi dış adrese bağlanmaz, sunucu bir kez indirip saklar. */
export async function GET(_req: NextRequest, { params }: { params: { id: string; dosya: string } }) {
  const { id, dosya } = params;
  const parts = FILE_RE.exec(dosya);
  if (!parts || id === 'duz' || id === 'el' || !isKnownFont(id)) return missing(404);
  const font = fontInfo(id);
  const weight = Number(parts[2]);
  if ((weight !== font.n && weight !== font.b) || (parts[3] === 'italic' && !font.i)) return missing(404);

  const file = path.join(CACHE_DIR, `${id}-${dosya}`);
  const cached = await readFile(file).catch(() => null);
  if (cached) return send(cached);

  try {
    const res = await fetch(`https://cdn.jsdelivr.net/npm/@fontsource/${id}@5/files/${id}-${dosya}`, {
      cache: 'no-store', signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return missing(res.status === 404 ? 404 : 502);
    const body = Buffer.from(await res.arrayBuffer());
    if (body.toString('latin1', 0, 4) !== 'wOF2') return missing(502);
    // Yarım dosya okunmasın: önce geçici ada yazılır. Saklanamazsa yine de gönderilir.
    const temp = `${file}.${process.pid}.${Date.now()}`;
    await mkdir(CACHE_DIR, { recursive: true })
      .then(() => writeFile(temp, body))
      .then(() => rename(temp, file))
      .catch((error) => console.warn('[yazi-tipi] önbelleğe yazılamadı', error?.code));
    return send(body);
  } catch {
    return missing(502);
  }
}
