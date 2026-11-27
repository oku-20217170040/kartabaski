import { NextRequest, NextResponse } from 'next/server';
import { isCronAuthorized, runSteps } from '@/lib/cron-utils';
import { runBlogStep } from '@/lib/blog-auto';
import { runMachineStep } from '@/lib/machine-store';
import { runAllSocialCycles } from '@/lib/social-run';
import { runPhotoStep } from '@/lib/photo-auto';
import { runBroadcastStep } from '@/lib/social-broadcast';
import { cleanupOrderRequests, syncClosedOrders } from '@/lib/siparis';
import { notifyCronFailures, runBotStep } from '@/lib/bot';
import { runIndexNowStep } from '@/lib/indexnow';

// Tek otomasyon kapısı. Çağıran: sunucudaki zamanlayıcı (tools/sunucu/zamanlayici.sh, 30 dakikada bir);
// GitHub Actions yalnız elle çalıştırma içindir. CRON_SECRET zorunlu: Authorization: Bearer <secret>.
// Sıra: blog yayını (müşteriye görünen iş) → makine özeti/haftalık rapor → ürün fotoğrafı üretimi (tur başına 1 iş) → hızlı paylaşım kuyruğu → 6 sosyal platform → yarım kalan siparişlerin ve süresi dolan sipariş fotoğraflarının silinmesi → Telegram sabah özeti ve hatırlatmalar → değişen sayfaların IndexNow bildirimi.
// Bir adımın hatası diğerlerini engellemez.
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(process.env.CRON_SECRET, req.headers.get('authorization'))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const steps = await runSteps([
    ['blog', () => runBlogStep()],
    ['machine', () => runMachineStep()],
    ['photos', () => runPhotoStep()],
    ['broadcast', () => runBroadcastStep()],
    ['social', () => runAllSocialCycles()],
    ['orderSync', () => syncClosedOrders()],
    ['orders', () => cleanupOrderRequests()],
    ['bot', () => runBotStep()],
    ['indexnow', () => runIndexNowStep()],
  ]);
  await notifyCronFailures(steps);
  return NextResponse.json({ ok: steps.every((s) => s.ok), steps });
}
