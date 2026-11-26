'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { DAY_KEY, SID_KEY, SN_KEY, firstProductViewToday, getVisitor, ls, sendTrack, ss, todayIstanbul, trackingEnabled } from '@/lib/analytics-client';

/**
 * Anonim ziyaret sayacı: sayfa/ürün/blog görüntüleme, ekranda kalma süresi, trafik kaynağı.
 * Çerez kullanmaz; cihazda rastgele bir kimlik tutar. /admin sayılmaz. Çıktısı yoktur.
 */
export default function SiteTracker() {
  const pathname = usePathname();
  const page = useRef({ path: '', visibleMs: 0, since: 0, first: true });

  // Görünür süre sayacı: sekme arka plana geçince durur, geri gelince devam eder
  const flush = () => {
    const p = page.current;
    if (!p.path) return;
    const total = p.visibleMs + (p.since ? Date.now() - p.since : 0);
    const dur = Math.round(total / 1000);
    if (dur >= 2) {
      const { vid } = getVisitor();
      sendTrack({ t: 'leave', path: p.path, vid, dur: Math.min(dur, 1800), fl: p.first });
      p.first = false;
    }
    p.visibleMs = 0;
    p.since = document.visibilityState === 'visible' ? Date.now() : 0;
  };

  useEffect(() => {
    const onVis = () => {
      const p = page.current;
      if (document.visibilityState === 'hidden') { flush(); p.since = 0; }
      else p.since = Date.now();
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', flush);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!pathname) return;

    flush(); // önceki sayfanın süresini gönder
    if (pathname.startsWith('/admin') || pathname.startsWith('/tasarim') || !trackingEnabled()) { page.current.path = ''; return; }
    const p = page.current;
    p.path = pathname;
    p.visibleMs = 0;
    p.since = document.visibilityState === 'visible' ? Date.now() : 0;
    p.first = true;

    const { vid, isNew } = getVisitor();
    const today = todayIstanbul();
    const nd = ls.get(DAY_KEY) !== today; // bugün ilk kez görüldü
    ls.set(DAY_KEY, today);

    if (!ss.get(SID_KEY)) ss.set(SID_KEY, `${Date.now().toString(36)}`);
    const n = (Number(ss.get(SN_KEY)) || 0) + 1;
    ss.set(SN_KEY, String(n));

    const q = new URLSearchParams(window.location.search);
    const prodSlug = pathname.match(/^\/urun\/([^/]+)\/?$/)?.[1];
    sendTrack({
      t: 'pv',
      path: pathname,
      vid,
      n,
      nv: isNew,
      nd,
      ...(prodSlug && firstProductViewToday(prodSlug, today) ? { pu: true } : {}),
      ...(n === 1 ? {
        ref: document.referrer || undefined,
        utm: q.get('utm_source') ? { s: q.get('utm_source') || undefined, m: q.get('utm_medium') || undefined, c: q.get('utm_campaign') || undefined } : undefined,
      } : {}),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return null;
}
