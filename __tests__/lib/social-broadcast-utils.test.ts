import { PHONE_DISPLAY } from '@/lib/constants';
import { SITE_URL } from '@/lib/site';
import {
  ALL_SOCIAL_PLATFORMS,
  BROADCAST_KINDS,
  type BroadcastTargetResult,
  type SocialBroadcast,
} from '@/lib/social-broadcast-types';
import {
  computeBroadcastStatus,
  defaultBroadcastSettings,
  generateBroadcastCaptions,
  mergeCaptions,
  parseBroadcastSettings,
  pickQueuedBroadcasts,
  sanitizeBroadcastImageIds,
} from '@/lib/social-broadcast-utils';
import { hashtagCount } from '@/lib/social-content-utils';

const NOW = Date.UTC(2026, 10, 25, 12, 0);

function makeBroadcast(over: Partial<SocialBroadcast> & { id: string }): SocialBroadcast {
  return {
    kind: 'musteri',
    note: 'Test notu',
    rawImageIds: ['karta-baski/sosyal/a'],
    finalImageIds: ['karta-baski/sosyal/a'],
    studioEnhance: false,
    instagramStory: false,
    platforms: ['instagram', 'facebook'],
    captions: {
      title: 'Test Başlık',
      mainCaption: 'Test ana açıklama',
      shortCaption: 'Test kısa açıklama',
      linkUrl: SITE_URL,
    },
    status: 'queued',
    targets: {},
    createdAt: 1000,
    updatedAt: 1000,
    ...over,
  };
}

function target(status: BroadcastTargetResult['status']): BroadcastTargetResult {
  return { status, updatedAt: NOW };
}

describe('defaultBroadcastSettings', () => {
  it('beklenen varsayılanları ve kopya platform dizisini döndürür', () => {
    const a = defaultBroadcastSettings();
    const b = defaultBroadcastSettings();

    expect(a).toEqual({
      instantOnUpload: false,
      defaultMode: 'instant',
      defaultPlatforms: ['instagram', 'facebook', 'threads', 'telegram', 'pinterest', 'tiktok'],
      defaultKind: 'musteri',
      defaultStudioEnhance: false,
      defaultStudioSceneId: 'ahsap-masa',
      defaultInstagramStory: false,
      queuePerCycle: 1,
    });

    a.defaultPlatforms.pop();
    expect(b.defaultPlatforms).toHaveLength(ALL_SOCIAL_PLATFORMS.length);
  });
});

describe('parseBroadcastSettings', () => {
  it('geçersiz kök değerlerde varsayılanlara düşer', () => {
    const def = defaultBroadcastSettings();
    expect(parseBroadcastSettings(null)).toEqual(def);
    expect(parseBroadcastSettings(undefined)).toEqual(def);
    expect(parseBroadcastSettings('bozuk')).toEqual(def);
    expect(parseBroadcastSettings(42)).toEqual(def);
    expect(parseBroadcastSettings([])).toEqual(def);
  });

  it('geçerli ayarları korur, bozuk alanları varsayılana düşürür', () => {
    const parsed = parseBroadcastSettings({
      instantOnUpload: true,
      defaultMode: 'queue',
      defaultPlatforms: ['instagram', 'gecersiz', 'instagram', 'tiktok'],
      defaultKind: 'bozuk-tur',
      defaultStudioEnhance: true,
      defaultStudioSceneId: '   ',
      defaultInstagramStory: true,
      queuePerCycle: 2,
    });

    expect(parsed).toEqual({
      instantOnUpload: true,
      defaultMode: 'queue',
      defaultPlatforms: ['instagram', 'tiktok'],
      defaultKind: 'musteri',
      defaultStudioEnhance: true,
      defaultStudioSceneId: 'ahsap-masa',
      defaultInstagramStory: true,
      queuePerCycle: 2,
    });
  });

  it('queuePerCycle değerini 1..3 arasında tam sayıya sıkıştırır', () => {
    expect(parseBroadcastSettings({ queuePerCycle: 0 }).queuePerCycle).toBe(1);
    expect(parseBroadcastSettings({ queuePerCycle: -10 }).queuePerCycle).toBe(1);
    expect(parseBroadcastSettings({ queuePerCycle: 2.4 }).queuePerCycle).toBe(2);
    expect(parseBroadcastSettings({ queuePerCycle: 2.6 }).queuePerCycle).toBe(3);
    expect(parseBroadcastSettings({ queuePerCycle: 99 }).queuePerCycle).toBe(3);
    expect(parseBroadcastSettings({ queuePerCycle: Number.NaN }).queuePerCycle).toBe(1);
    expect(parseBroadcastSettings({ queuePerCycle: Number.POSITIVE_INFINITY }).queuePerCycle).toBe(1);
    expect(parseBroadcastSettings({ queuePerCycle: '2' }).queuePerCycle).toBe(1);
  });

  it('defaultPlatforms boş dizi olabilir, dizi değilse varsayılan 6 platform döner', () => {
    expect(parseBroadcastSettings({ defaultPlatforms: [] }).defaultPlatforms).toEqual([]);
    expect(parseBroadcastSettings({ defaultPlatforms: 'instagram' }).defaultPlatforms).toEqual(
      defaultBroadcastSettings().defaultPlatforms,
    );
  });
});

describe('sanitizeBroadcastImageIds', () => {
  it('yalnızca güvenli Cloudinary public_id değerlerini tekrarsız ve max sınırlı döndürür', () => {
    const input = [
      'karta-baski/urunler/kupa-1',
      'karta-baski/studio/sahne_2/cikti-a',
      'karta-baski/sosyal/gorsel-3',
      'karta-baski/urunler/kupa-1', // tekrar
      '/karta-baski/urunler/basinda-slash',
      'karta-baski/urunler/../gizli',
      'karta-baski/urunler//cift-slash',
      'karta-baski/urunler/sonu-slash/',
      'karta-baski/diger/izin-yok',
      'https://res.cloudinary.com/demo/image/upload/a.jpg',
      `karta-baski/urunler/${'a'.repeat(161)}`,
      123,
      null,
      'karta-baski/sosyal/fazla-olan',
    ];

    expect(sanitizeBroadcastImageIds(input, 3)).toEqual([
      'karta-baski/urunler/kupa-1',
      'karta-baski/studio/sahne_2/cikti-a',
      'karta-baski/sosyal/gorsel-3',
    ]);
  });

  it('geçersiz giriş veya max <= 0 için boş dizi döndürür', () => {
    expect(sanitizeBroadcastImageIds('not-array')).toEqual([]);
    expect(sanitizeBroadcastImageIds(['karta-baski/urunler/a'], 0)).toEqual([]);
    expect(sanitizeBroadcastImageIds(['karta-baski/urunler/a'], -2)).toEqual([]);
  });
});

describe('generateBroadcastCaptions', () => {
  it('tüm 5 gönderi türü için geçerli, Türkçe ve sınırlar içinde çıktı üretir', () => {
    for (const kind of BROADCAST_KINDS) {
      const res = generateBroadcastCaptions({
        kind,
        note: 'Müşterimiz için isimli kupa hazırladık.',
        productTitle: 'SİHİRLİ KUPA KALP — Kişiye Özel Baskı',
        productSlug: 'sihirli-kupa-kalp',
        productCategory: 'Sihirli Kupa',
        priceMin: 150,
        priceMax: 250,
      });

      expect(res.title.length).toBeGreaterThan(0);
      expect(res.title.length).toBeLessThanOrEqual(90);
      expect(res.title).not.toContain('#');
      expect(res.title).toContain('Sihirli Kupa Kalp');

      expect(res.mainCaption.length).toBeLessThanOrEqual(2000);
      expect(res.mainCaption).toContain('Sihirli Kupa Kalp');
      expect(res.mainCaption).toContain('150₺ – 250₺');
      expect(res.mainCaption).toContain('Müşterimiz için isimli kupa hazırladık.');
      expect(res.mainCaption).toContain(`Sipariş ve tasarım için WhatsApp: ${PHONE_DISPLAY}`);
      expect(res.mainCaption).toContain(`${SITE_URL}/urun/sihirli-kupa-kalp`);
      expect(res.mainCaption).toContain('#sihirlikupa');

      expect(res.shortCaption.length).toBeLessThanOrEqual(500);
      expect(res.shortCaption).toContain(PHONE_DISPLAY);
      expect(res.shortCaption).toContain(`${SITE_URL}/urun/sihirli-kupa-kalp`);
      expect(hashtagCount(res.shortCaption)).toBeLessThanOrEqual(3);

      expect(res.linkUrl).toBe(`${SITE_URL}/urun/sihirli-kupa-kalp`);
    }
  });

  it('aynı girdi için deterministik, farklı seed ile farklı metin üretir', () => {
    const base = {
      kind: 'atolye' as const,
      note: 'Sabah baskıları hazır',
      seed: 'seed-1',
    };
    expect(generateBroadcastCaptions(base)).toEqual(generateBroadcastCaptions(base));

    const outputs = new Set(
      ['seed-a', 'seed-b', 'seed-c', 'seed-d', 'seed-e', 'seed-f'].map(
        (seed) => generateBroadcastCaptions({ kind: 'atolye', note: 'Sabah baskıları hazır', seed }).mainCaption,
      ),
    );
    expect(outputs.size).toBeGreaterThan(1);
  });

  it('çok uzun not ve başlıkta dahi title <= 90, mainCaption <= 2000, shortCaption <= 500 sınırını korur', () => {
    const res = generateBroadcastCaptions({
      kind: 'serbest',
      note: `Harika bir #etiketli not. ${'Çok uzun açıklama cümlesi '.repeat(120)}`,
      productTitle: `Özel Tasarım Kupa ${'Uzun Başlık '.repeat(15)}`,
    });

    expect(res.title.length).toBeLessThanOrEqual(90);
    expect(res.title).not.toContain('#');
    expect(res.mainCaption.length).toBeLessThanOrEqual(2000);
    expect(res.shortCaption.length).toBeLessThanOrEqual(500);
    expect(res.shortCaption).toContain(PHONE_DISPLAY);
    expect(res.shortCaption).toContain(SITE_URL);
    expect(res.linkUrl).toBe(SITE_URL);
  });

  it('fiyat yoksa fiyat satırı eklemez ve nottan hashtag temizlenmiş başlık üretir', () => {
    const res = generateBroadcastCaptions({
      kind: 'kampanya',
      note: 'Hafta sonuna özel baskı indirimi! #kampanya #indirim',
      priceMin: 0,
      priceMax: 0,
    });

    expect(res.title).toBe('Hafta sonuna özel baskı indirimi');
    expect(res.title).not.toContain('#');
    expect(res.mainCaption).not.toContain('Fiyat:');
    expect(res.mainCaption).toContain('#kampanya');
    expect(res.mainCaption).toContain('#fırsat');
  });
});

describe('mergeCaptions', () => {
  const generated = generateBroadcastCaptions({
    kind: 'urun',
    productTitle: 'Latte Fincanı',
    productSlug: 'latte-fincani',
    priceMin: 180,
    priceMax: 180,
  });

  it('custom verilmezse veya alanlar boşsa generated değerlerini korur', () => {
    expect(mergeCaptions(generated)).toEqual(generated);
    expect(mergeCaptions(generated, { title: '   ', shortCaption: '' })).toEqual(generated);
  });

  it('dolu custom alanları sınırlar içinde korur, boş alanları tamamlar', () => {
    const merged = mergeCaptions(generated, {
      title: 'T'.repeat(120),
      shortCaption: 'K'.repeat(650),
      linkUrl: `${SITE_URL}/ozel`,
    });

    expect(merged.title.length).toBeLessThanOrEqual(90);
    expect(merged.shortCaption.length).toBeLessThanOrEqual(500);
    expect(merged.mainCaption).toBe(generated.mainCaption);
    expect(merged.linkUrl).toBe(`${SITE_URL}/ozel`);
  });
});

describe('computeBroadcastStatus', () => {
  it('hiç başlanmamışsa queued, pending veya eksik sonuç varsa publishing döner', () => {
    expect(computeBroadcastStatus(['instagram', 'facebook'], {})).toBe('queued');
    expect(
      computeBroadcastStatus(['instagram', 'facebook'], {
        instagram: target('pending'),
        facebook: target('pending'),
      }),
    ).toBe('publishing');
    expect(
      computeBroadcastStatus(['instagram', 'facebook'], {
        instagram: target('posted'),
      }),
    ).toBe('publishing');
  });

  it('en az bir posted ve sıfır failed varsa (skipped olsa bile) done döner', () => {
    expect(
      computeBroadcastStatus(['instagram', 'threads', 'tiktok'], {
        instagram: target('posted'),
        threads: target('skipped'),
        tiktok: target('skipped'),
      }),
    ).toBe('done');
  });

  it('hem posted hem failed varsa partial döner', () => {
    expect(
      computeBroadcastStatus(['instagram', 'facebook', 'threads'], {
        instagram: target('posted'),
        facebook: target('failed'),
        threads: target('skipped'),
      }),
    ).toBe('partial');
  });

  it('hiç posted yoksa (hepsi failed, hepsi skipped veya karışık) ve boş platformlarda failed döner', () => {
    expect(
      computeBroadcastStatus(['instagram', 'facebook'], {
        instagram: target('failed'),
        facebook: target('failed'),
      }),
    ).toBe('failed');
    expect(
      computeBroadcastStatus(['instagram', 'facebook'], {
        instagram: target('skipped'),
        facebook: target('skipped'),
      }),
    ).toBe('failed');
    expect(
      computeBroadcastStatus(['instagram', 'facebook'], {
        instagram: target('failed'),
        facebook: target('skipped'),
      }),
    ).toBe('failed');
    expect(computeBroadcastStatus([], {})).toBe('failed');
  });

  it('seçilmemiş platformdaki hata durumu etkilemez', () => {
    expect(
      computeBroadcastStatus(['instagram'], {
        instagram: target('posted'),
        facebook: target('failed'),
      }),
    ).toBe('done');
  });
});

describe('pickQueuedBroadcasts', () => {
  it('yalnız queued ve zamanı gelmiş kayıtları FIFO sırayla en çok limit adet döndürür', () => {
    const items: SocialBroadcast[] = [
      makeBroadcast({ id: 'done-1', status: 'done', createdAt: 50 }),
      makeBroadcast({ id: 'future-1', status: 'queued', scheduledAt: NOW + 60_000, createdAt: 100 }),
      makeBroadcast({ id: 'q-late', status: 'queued', createdAt: 400 }),
      makeBroadcast({ id: 'q-first', status: 'queued', createdAt: 200 }),
      makeBroadcast({ id: 'q-due', status: 'queued', scheduledAt: NOW, createdAt: 300 }),
      makeBroadcast({ id: 'draft-1', status: 'draft', createdAt: 10 }),
    ];

    const picked = pickQueuedBroadcasts(items, 2, NOW);
    expect(picked.map((b) => b.id)).toEqual(['q-first', 'q-due']);
  });

  it('limit <= 0 ise boş dizi döndürür', () => {
    const items = [makeBroadcast({ id: 'q1', status: 'queued', createdAt: 100 })];
    expect(pickQueuedBroadcasts(items, 0, NOW)).toEqual([]);
    expect(pickQueuedBroadcasts(items, -1, NOW)).toEqual([]);
  });
});
