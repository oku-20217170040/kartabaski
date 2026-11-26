import { ADMIN_GROUPS, ADMIN_LINKS, SOCIAL_LINKS, adminPageTitle, filterAdminLinks, inSocial, isLinkActive } from '@/lib/admin-nav';
import { isCronAuthorized, runSteps } from '@/lib/cron-utils';
import { trDayKey, trHour, trTime, trWeekday } from '@/lib/tr-time';

describe('admin-nav', () => {
  it('istenen tüm modüller menüde, kaldırılanlar yok', () => {
    const hrefs = ADMIN_GROUPS.flatMap((g) => g.items).map((l) => l.href);
    for (const h of ['/admin', '/admin/istatistik', '/admin/muhasebe', '/admin/products', '/admin/makine', '/admin/studio',
      '/admin/siparisler', '/admin/yorumlar', '/admin/sosyal-medya', '/admin/blog', '/admin/seo']) {
      expect(hrefs).toContain(h);
    }
    for (const h of ['/admin/sanal-depo', '/admin/satis-talepleri', '/admin/sepet-talepleri', '/admin/tasarimlar', '/admin/etiketler', '/admin/yonlendirme']) {
      expect(hrefs).not.toContain(h);
    }
    expect(SOCIAL_LINKS).toHaveLength(8);
    expect(SOCIAL_LINKS.map((l) => l.href)).toContain('/admin/sosyal-medya/paylas');
  });

  it('aktiflik: exact ve önek', () => {
    expect(isLinkActive('/admin/products/abc', { href: '/admin/products' })).toBe(true);
    expect(isLinkActive('/admin/products', { href: '/admin', exact: true })).toBe(false);
    expect(isLinkActive('/admin/sosyal-medya/paylas', { href: '/admin/sosyal-medya', exact: true })).toBe(false);
    expect(inSocial('/admin/sosyal-medya/paylas')).toBe(true);
    expect(inSocial('/admin/tiktok')).toBe(true);
    expect(inSocial('/admin/blog')).toBe(false);
  });

  it('başlık en uzun eşleşmeden gelir; arama Türkçe duyarlı', () => {
    expect(adminPageTitle('/admin/instagram')).toBe('Instagram');
    expect(adminPageTitle('/admin/sosyal-medya/paylas')).toBe('Hızlı Paylaşım');
    expect(adminPageTitle('/admin/bilinmeyen')).toBe('Yönetim');
    expect(filterAdminLinks('İSTATİSTİK').map((l) => l.href)).toContain('/admin/istatistik');
    expect(filterAdminLinks('  ')).toEqual([]);
    expect(ADMIN_LINKS.some((l) => l.socialGroup)).toBe(false);
  });
});

describe('cron-utils', () => {
  it('secret yoksa reddeder, doğru Bearer ile geçer', () => {
    expect(isCronAuthorized(undefined, 'Bearer x')).toBe(false);
    expect(isCronAuthorized('s', 'Bearer s')).toBe(true);
    expect(isCronAuthorized('s', 'Bearer t')).toBe(false);
  });

  it('bir adımın hatası diğerlerini durdurmaz', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const out = await runSteps([
      ['a', async () => { throw new Error('patladı'); }],
      ['b', async () => 2],
    ]);
    expect(out).toEqual([{ name: 'a', ok: false, error: 'patladı' }, { name: 'b', ok: true, value: 2 }]);
    spy.mockRestore();
  });
});

describe('tr-time', () => {
  it('UTC+3 gün/saat', () => {
    const t = Date.UTC(2026, 10, 24, 22, 30); // 25 Kasım 01:30 TSİ
    expect(trDayKey(t)).toBe('2026-11-25');
    expect(trHour(t)).toBe(1);
    expect(trWeekday(t)).toBe(3);
    expect(trTime('2026-11-25', 1, 30)).toBe(t);
  });
});
