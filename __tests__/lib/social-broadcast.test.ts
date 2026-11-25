jest.mock('server-only', () => ({}));

// ── Bellek içi Firestore sahtesi (Admin SDK) ─────────────────────────────────
const store = new Map<string, Map<string, Record<string, unknown>>>();
let autoSeq = 0;

function ensureCol(name: string): Map<string, Record<string, unknown>> {
  let col = store.get(name);
  if (!col) {
    col = new Map();
    store.set(name, col);
  }
  return col;
}

function assertNoUndefined(val: unknown, path = 'root'): void {
  if (val === undefined) {
    throw new Error(`Firestore undefined kabul etmez: ${path}`);
  }
  if (Array.isArray(val)) {
    val.forEach((item, i) => assertNoUndefined(item, `${path}[${i}]`));
    return;
  }
  if (val && typeof val === 'object') {
    for (const [k, v] of Object.entries(val)) {
      assertNoUndefined(v, `${path}.${k}`);
    }
  }
}

const mockAdminDb = {
  collection: (colName: string) => ({
    doc: (docId?: string) => {
      const id = docId ?? `auto_${++autoSeq}`;
      return {
        id,
        get: async () => {
          const data = ensureCol(colName).get(id);
          return {
            id,
            exists: data !== undefined,
            data: () => (data ? { ...data } : undefined),
          };
        },
        set: async (data: Record<string, unknown>) => {
          assertNoUndefined(data, `${colName}/${id}`);
          ensureCol(colName).set(id, JSON.parse(JSON.stringify(data)) as Record<string, unknown>);
        },
        delete: async () => {
          ensureCol(colName).delete(id);
        },
      };
    },
    orderBy: (field: string, dir: 'asc' | 'desc' = 'asc') => ({
      limit: (n: number) => ({
        get: async () => {
          const entries = Array.from(ensureCol(colName).entries()).sort((a, b) => {
            const av = Number(a[1][field] ?? 0);
            const bv = Number(b[1][field] ?? 0);
            return dir === 'desc' ? bv - av : av - bv;
          });
          const sliced = entries.slice(0, n);
          return {
            docs: sliced.map(([id, data]) => ({
              id,
              exists: true,
              data: () => ({ ...data }),
            })),
          };
        },
      }),
    }),
  }),
};

jest.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: (colName: string) => mockAdminDb.collection(colName),
  },
}));

// ── Dış servis mockları ──────────────────────────────────────────────────────
const mockIg = {
  isConnected: jest.fn(),
  refreshTokenIfNeeded: jest.fn(),
  publishSinglePost: jest.fn(),
  publishCarousel: jest.fn(),
  publishStory: jest.fn(),
};
jest.mock('@/lib/instagram', () => ({
  isConnected: (...args: unknown[]) => mockIg.isConnected(...args),
  refreshTokenIfNeeded: (...args: unknown[]) => mockIg.refreshTokenIfNeeded(...args),
  publishSinglePost: (...args: unknown[]) => mockIg.publishSinglePost(...args),
  publishCarousel: (...args: unknown[]) => mockIg.publishCarousel(...args),
  publishStory: (...args: unknown[]) => mockIg.publishStory(...args),
}));

const mockFb = {
  getFacebookConfig: jest.fn(),
  publishToFacebookPage: jest.fn(),
};
jest.mock('@/lib/facebook-page', () => ({
  getFacebookConfig: (...args: unknown[]) => mockFb.getFacebookConfig(...args),
  publishToFacebookPage: (...args: unknown[]) => mockFb.publishToFacebookPage(...args),
}));

const mockThreads = {
  threadsConfigured: jest.fn(),
  refreshThreadsTokenIfNeeded: jest.fn(),
  publishThreadsMedia: jest.fn(),
};
jest.mock('@/lib/threads', () => ({
  threadsConfigured: (...args: unknown[]) => mockThreads.threadsConfigured(...args),
  refreshThreadsTokenIfNeeded: (...args: unknown[]) => mockThreads.refreshThreadsTokenIfNeeded(...args),
  publishThreadsMedia: (...args: unknown[]) => mockThreads.publishThreadsMedia(...args),
}));

const mockTg = {
  channelConfigured: jest.fn(),
  tgChannel: jest.fn(),
};
jest.mock('@/lib/telegram-channel', () => ({
  channelConfigured: (...args: unknown[]) => mockTg.channelConfigured(...args),
  tgChannel: (...args: unknown[]) => mockTg.tgChannel(...args),
}));

const mockPinterest = {
  pinterestConfigured: jest.fn(),
  refreshPinterestTokenIfNeeded: jest.fn(),
  listBoards: jest.fn(),
  createBoard: jest.fn(),
  createPin: jest.fn(),
};
jest.mock('@/lib/pinterest', () => ({
  pinterestConfigured: (...args: unknown[]) => mockPinterest.pinterestConfigured(...args),
  refreshPinterestTokenIfNeeded: (...args: unknown[]) => mockPinterest.refreshPinterestTokenIfNeeded(...args),
  listBoards: (...args: unknown[]) => mockPinterest.listBoards(...args),
  createBoard: (...args: unknown[]) => mockPinterest.createBoard(...args),
  createPin: (...args: unknown[]) => mockPinterest.createPin(...args),
}));

const mockTikTok = {
  tiktokConfigured: jest.fn(),
  getTikTokState: jest.fn(),
  sendPhotoDraft: jest.fn(),
};
jest.mock('@/lib/tiktok', () => ({
  tiktokConfigured: (...args: unknown[]) => mockTikTok.tiktokConfigured(...args),
  getTikTokState: (...args: unknown[]) => mockTikTok.getTikTokState(...args),
  sendPhotoDraft: (...args: unknown[]) => mockTikTok.sendPhotoDraft(...args),
}));

const mockCloudinary = {
  uploadToCloudinary: jest.fn(),
  deleteCloudinaryImages: jest.fn(),
};
jest.mock('@/lib/cloudinary-admin', () => ({
  uploadToCloudinary: (...args: unknown[]) => mockCloudinary.uploadToCloudinary(...args),
  deleteCloudinaryImages: (...args: unknown[]) => mockCloudinary.deleteCloudinaryImages(...args),
}));

const mockProviderGenerate = jest.fn();
const mockPickProvider = jest.fn();
jest.mock('@/lib/image-gen/registry', () => ({
  pickProvider: (...args: unknown[]) => mockPickProvider(...args),
}));

const mockLogActivity = jest.fn();
jest.mock('@/lib/social-settings', () => ({
  logActivity: (...args: unknown[]) => mockLogActivity(...args),
}));

import {
  createBroadcast,
  deleteBroadcast,
  getBroadcast,
  getBroadcastSettings,
  listBroadcasts,
  publishBroadcast,
  runBroadcastStep,
  saveBroadcastSettings,
  updateBroadcast,
} from '@/lib/social-broadcast';
import { ALL_SOCIAL_PLATFORMS } from '@/lib/social-broadcast-types';

function setupAllPlatformsConnected() {
  mockIg.isConnected.mockResolvedValue(true);
  mockIg.refreshTokenIfNeeded.mockResolvedValue({ refreshed: false });
  mockIg.publishSinglePost.mockResolvedValue('ig_single_1');
  mockIg.publishCarousel.mockResolvedValue('ig_carousel_1');
  mockIg.publishStory.mockResolvedValue('ig_story_1');

  mockFb.getFacebookConfig.mockReturnValue({ pageId: 'pg1', token: 'fb_tok' });
  mockFb.publishToFacebookPage.mockResolvedValue('fb_post_1');

  mockThreads.threadsConfigured.mockReturnValue(true);
  mockThreads.refreshThreadsTokenIfNeeded.mockResolvedValue({ refreshed: false });
  mockThreads.publishThreadsMedia.mockResolvedValue({
    id: 'th_1',
    permalink: 'https://www.threads.net/@kartabaskii/post/th_1',
  });

  mockTg.channelConfigured.mockReturnValue(true);
  mockTg.tgChannel.mockResolvedValue({ ok: true, messageId: 42 });

  mockPinterest.pinterestConfigured.mockResolvedValue(true);
  mockPinterest.refreshPinterestTokenIfNeeded.mockResolvedValue({ refreshed: false });
  mockPinterest.listBoards.mockResolvedValue([{ id: 'b_1', name: 'Kişiye Özel Kupalar' }]);
  mockPinterest.createBoard.mockResolvedValue({ id: 'b_new', name: 'Kişiye Özel Kupalar' });
  mockPinterest.createPin.mockResolvedValue('pin_1');

  mockTikTok.tiktokConfigured.mockReturnValue(true);
  mockTikTok.getTikTokState.mockResolvedValue({ accessToken: 'tk_tok' });
  mockTikTok.sendPhotoDraft.mockResolvedValue('tk_pub_1');

  mockLogActivity.mockResolvedValue(undefined);
}

beforeEach(() => {
  store.clear();
  autoSeq = 0;
  jest.clearAllMocks();
  setupAllPlatformsConnected();
  mockPickProvider.mockReturnValue(null);
  mockCloudinary.uploadToCloudinary.mockResolvedValue('karta-baski/sosyal/studio_gen_1');
  mockCloudinary.deleteCloudinaryImages.mockResolvedValue(undefined);
});

describe('getBroadcastSettings & saveBroadcastSettings', () => {
  it('kayıt yokken varsayılan ayarları döndürür ve kaydedileni okur', async () => {
    const def = await getBroadcastSettings();
    expect(def.queuePerCycle).toBe(1);
    expect(def.defaultPlatforms).toEqual(ALL_SOCIAL_PLATFORMS);

    const saved = await saveBroadcastSettings({
      instantOnUpload: true,
      defaultMode: 'queue',
      defaultPlatforms: ['instagram', 'telegram'],
      queuePerCycle: 3,
    });
    expect(saved.instantOnUpload).toBe(true);
    expect(saved.defaultPlatforms).toEqual(['instagram', 'telegram']);
    expect(saved.queuePerCycle).toBe(3);

    const readBack = await getBroadcastSettings();
    expect(readBack).toEqual(saved);
  });
});

describe('createBroadcast', () => {
  it('geçerli fotoğraf yoksa Türkçe hata fırlatır', async () => {
    await expect(
      createBroadcast({
        imageIds: ['../kotu-yol', 'https://dis-adres.com/a.jpg'],
        kind: 'serbest',
        platforms: ['instagram'],
        mode: 'queue',
      }),
    ).rejects.toThrow('En az bir fotoğraf yükleyin.');
  });

  it('productId verilmişse ürün bilgisini okuyup metinleri üretir ve queued kaydeder', async () => {
    ensureCol('products').set('prod_1', {
      title: 'KİŞİYE ÖZEL SERAMİK KUPA — Kişiye Özel Baskı',
      slug: 'seramik-kupa',
      category: 'Seramik Kahve Fincanı',
      priceMin: 250,
      priceMax: 350,
    });

    const created = await createBroadcast(
      {
        imageIds: ['karta-baski/sosyal/foto1'],
        kind: 'urun',
        note: 'Yeni renkler stokta!',
        productId: 'prod_1',
        platforms: ['instagram', 'facebook'],
        mode: 'queue',
      },
      1_700_000_000_000,
    );

    expect(created.status).toBe('queued');
    expect(created.productId).toBe('prod_1');
    expect(created.productTitle).toBe('Kişiye Özel Seramik Kupa');
    expect(created.captions.linkUrl).toContain('/urun/seramik-kupa');
    expect(created.captions.mainCaption).toContain('Yeni renkler stokta!');
    expect(created.finalImageIds).toEqual(['karta-baski/sosyal/foto1']);

    const fromDb = await getBroadcast(created.id);
    expect(fromDb?.id).toBe(created.id);
  });

  it('mode instant iken oluşturduktan hemen sonra yayınlar', async () => {
    const res = await createBroadcast(
      {
        imageIds: ['karta-baski/sosyal/aninda1'],
        kind: 'musteri',
        note: 'Mutlu müşteri',
        platforms: ['instagram', 'facebook'],
        mode: 'instant',
      },
      1_700_000_000_000,
    );

    expect(res.status).toBe('done');
    expect(res.targets.instagram?.status).toBe('posted');
    expect(res.targets.facebook?.status).toBe('posted');
  });
});

describe('publishBroadcast — 6 platform dağıtımı ve hata yalıtımı', () => {
  it('tek görselli gönderiyi 6 platforma da başarıyla dağıtır ve story paylaşır', async () => {
    const item = await createBroadcast(
      {
        imageIds: ['karta-baski/sosyal/kupa1'],
        kind: 'musteri',
        note: 'Müşteri siparişi hazır!',
        platforms: [...ALL_SOCIAL_PLATFORMS],
        instagramStory: true,
        mode: 'queue',
      },
      1_700_000_000_000,
    );

    const published = await publishBroadcast(item.id, {}, 1_700_000_010_000);

    expect(published.status).toBe('done');
    expect(published.publishedAt).toBe(1_700_000_010_000);

    expect(mockIg.publishSinglePost).toHaveBeenCalledTimes(1);
    expect(mockIg.publishCarousel).not.toHaveBeenCalled();
    expect(mockIg.publishStory).toHaveBeenCalledTimes(1);
    expect(published.targets.instagram).toMatchObject({ status: 'posted', remoteId: 'ig_single_1' });
    expect(published.storyStatus).toMatchObject({ status: 'posted', remoteId: 'ig_story_1' });

    expect(mockFb.publishToFacebookPage).toHaveBeenCalledTimes(1);
    expect(published.targets.facebook).toMatchObject({ status: 'posted', remoteId: 'fb_post_1' });

    expect(mockThreads.publishThreadsMedia).toHaveBeenCalledWith(
      expect.any(Array),
      item.captions.shortCaption,
    );
    expect(published.targets.threads).toMatchObject({
      status: 'posted',
      remoteId: 'th_1',
      permalink: 'https://www.threads.net/@kartabaskii/post/th_1',
    });

    expect(mockTg.tgChannel).toHaveBeenCalledWith('sendPhoto', expect.objectContaining({
      photo: expect.stringContaining('karta-baski/sosyal/kupa1'),
    }));
    expect(published.targets.telegram).toMatchObject({ status: 'posted', remoteId: '42' });

    expect(mockPinterest.createPin).toHaveBeenCalledWith(expect.objectContaining({
      boardId: 'b_1',
      title: item.captions.title,
    }));
    expect(published.targets.pinterest).toMatchObject({ status: 'posted', remoteId: 'pin_1' });

    expect(mockTikTok.sendPhotoDraft).toHaveBeenCalledWith(expect.objectContaining({
      title: item.captions.title,
      photoUrls: [expect.stringContaining('/api/tiktok/media/karta-baski~sosyal~kupa1.jpg')],
    }));
    expect(published.targets.tiktok).toMatchObject({ status: 'posted', remoteId: 'tk_pub_1' });

    expect(mockLogActivity).toHaveBeenCalledTimes(6);
  });

  it('çoklu görselde Instagram carousel, Telegram sendMediaGroup ve Pinterest pano oluşturma + çakışma yedeğini kullanır', async () => {
    mockPinterest.listBoards.mockResolvedValue([]);
    mockPinterest.createBoard
      .mockRejectedValueOnce(new Error('You already have a board with this name (kod 58)'))
      .mockResolvedValueOnce({ id: 'b_alt', name: 'Kişiye Özel Kupalar - KAR-TA BASKI' });

    const item = await createBroadcast({
      imageIds: ['karta-baski/sosyal/g1', 'karta-baski/sosyal/g2', 'karta-baski/sosyal/g3'],
      kind: 'atolye',
      platforms: ['instagram', 'telegram', 'pinterest'],
      mode: 'queue',
    });

    const published = await publishBroadcast(item.id);
    expect(published.status).toBe('done');
    expect(mockIg.publishCarousel).toHaveBeenCalledWith(
      expect.arrayContaining([expect.stringContaining('g1'), expect.stringContaining('g3')]),
      item.captions.mainCaption,
    );
    expect(mockTg.tgChannel).toHaveBeenCalledWith('sendMediaGroup', expect.objectContaining({
      media: expect.arrayContaining([
        expect.objectContaining({ type: 'photo', caption: expect.any(String) }),
      ]),
    }));
    expect(mockPinterest.createBoard).toHaveBeenNthCalledWith(1, 'Kişiye Özel Kupalar', 'KAR-TA BASKI');
    expect(mockPinterest.createBoard).toHaveBeenNthCalledWith(2, 'Kişiye Özel Kupalar - KAR-TA BASKI', 'KAR-TA BASKI');
    expect(mockPinterest.createPin).toHaveBeenCalledWith(expect.objectContaining({ boardId: 'b_alt' }));
  });

  it('bağlı olmayan platformları skipped olarak işaretler', async () => {
    mockIg.isConnected.mockResolvedValue(false);
    mockFb.getFacebookConfig.mockReturnValue(null);
    mockThreads.threadsConfigured.mockReturnValue(false);
    mockTg.channelConfigured.mockReturnValue(false);
    mockPinterest.pinterestConfigured.mockResolvedValue(false);
    mockTikTok.tiktokConfigured.mockReturnValue(true);
    mockTikTok.getTikTokState.mockResolvedValue({}); // accessToken yok

    const item = await createBroadcast({
      imageIds: ['karta-baski/sosyal/g1'],
      kind: 'serbest',
      platforms: [...ALL_SOCIAL_PLATFORMS],
      mode: 'queue',
    });

    const res = await publishBroadcast(item.id);
    for (const p of ALL_SOCIAL_PLATFORMS) {
      expect(res.targets[p]?.status).toBe('skipped');
      expect(res.targets[p]?.error).toBe('Bağlı değil');
    }
    expect(mockLogActivity).not.toHaveBeenCalled();
  });

  it('1 platform patladığında diğerleri posted olur ve partial döner; onlyFailedOrPending ile sadece hatalı denenir', async () => {
    mockFb.publishToFacebookPage.mockRejectedValueOnce(new Error('Facebook token geçersiz'));
    mockTg.tgChannel.mockResolvedValueOnce({ ok: false, error: 'Forbidden: bot was kicked' });

    const item = await createBroadcast({
      imageIds: ['karta-baski/sosyal/g1'],
      kind: 'kampanya',
      platforms: ['instagram', 'facebook', 'threads', 'telegram'],
      mode: 'queue',
    });

    const first = await publishBroadcast(item.id, {}, 1000);
    expect(first.status).toBe('partial');
    expect(first.targets.instagram?.status).toBe('posted');
    expect(first.targets.threads?.status).toBe('posted');
    expect(first.targets.facebook).toMatchObject({ status: 'failed', error: 'Facebook token geçersiz' });
    expect(first.targets.telegram).toMatchObject({ status: 'failed', error: 'Forbidden: bot was kicked' });

    jest.clearAllMocks();
    setupAllPlatformsConnected();

    const retried = await publishBroadcast(item.id, { onlyFailedOrPending: true }, 2000);
    expect(retried.status).toBe('done');
    expect(mockIg.publishSinglePost).not.toHaveBeenCalled();
    expect(mockThreads.publishThreadsMedia).not.toHaveBeenCalled();
    expect(mockFb.publishToFacebookPage).toHaveBeenCalledTimes(1);
    expect(mockTg.tgChannel).toHaveBeenCalledTimes(1);
  });
});

describe('studioEnhance köprüsü ve hata yalıtımı', () => {
  it('studioEnhance açıkken ilk fotoğrafı stüdyoya sokar ve Cloudinary sosyal klasörüne yükler', async () => {
    mockPickProvider.mockReturnValue({
      id: 'cloudflare',
      label: 'Cloudflare',
      generate: mockProviderGenerate.mockResolvedValue({
        images: [{ data: new Uint8Array([1, 2, 3]), mimeType: 'image/png' }],
        model: 'flux',
      }),
    });
    mockCloudinary.uploadToCloudinary.mockResolvedValue('karta-baski/sosyal/st_99');

    const item = await createBroadcast({
      imageIds: ['karta-baski/urunler/kupa_ham', 'karta-baski/sosyal/detay2'],
      kind: 'urun',
      studioEnhance: true,
      studioSceneId: 'ahsap-masa',
      platforms: ['instagram', 'tiktok'],
      mode: 'queue',
    });

    const res = await publishBroadcast(item.id);
    expect(mockProviderGenerate).toHaveBeenCalledTimes(1);
    expect(mockCloudinary.uploadToCloudinary).toHaveBeenCalledWith(
      expect.stringMatching(/^data:image\/png;base64,/),
      'karta-baski/sosyal',
    );
    expect(res.finalImageIds).toEqual(['karta-baski/sosyal/st_99', 'karta-baski/sosyal/detay2']);
    expect(res.studioError).toBeUndefined();
    expect(res.status).toBe('done');
    expect(mockIg.publishCarousel).toHaveBeenCalledWith(
      expect.arrayContaining([expect.stringContaining('st_99')]),
      expect.any(String),
    );
  });

  it('stüdyo sağlayıcısı hata verse bile gönderiyi durdurmaz, studioError yazar ve ham fotoğrafla paylaşır', async () => {
    mockPickProvider.mockReturnValue({
      id: 'cloudflare',
      label: 'Cloudflare',
      generate: mockProviderGenerate.mockRejectedValue(new Error('Günlük kota doldu')),
    });

    const item = await createBroadcast({
      imageIds: ['karta-baski/sosyal/ham_foto'],
      kind: 'urun',
      studioEnhance: true,
      studioSceneId: 'beyaz-fon',
      platforms: ['facebook'],
      mode: 'queue',
    });

    const res = await publishBroadcast(item.id);
    expect(res.studioError).toBe('Günlük kota doldu');
    expect(res.finalImageIds).toEqual(['karta-baski/sosyal/ham_foto']);
    expect(res.status).toBe('done');
    expect(res.targets.facebook?.status).toBe('posted');
    expect(mockFb.publishToFacebookPage).toHaveBeenCalledWith(
      [expect.stringContaining('karta-baski/sosyal/ham_foto')],
      expect.any(String),
      expect.any(Object),
    );
  });
});

describe('updateBroadcast, listBroadcasts & deleteBroadcast', () => {
  it('taslak/sıradaki yayını günceller ve listeler', async () => {
    const b1 = await createBroadcast({
      imageIds: ['karta-baski/sosyal/a1'],
      kind: 'serbest',
      platforms: ['instagram'],
      mode: 'draft',
    }, 100);
    await createBroadcast({
      imageIds: ['karta-baski/sosyal/a2'],
      kind: 'serbest',
      platforms: ['facebook'],
      mode: 'queue',
    }, 200);

    const updated = await updateBroadcast(b1.id, {
      captions: { title: 'Güncel Başlık' },
      platforms: ['instagram', 'threads'],
      status: 'queued',
    });
    expect(updated.captions.title).toBe('Güncel Başlık');
    expect(updated.platforms).toEqual(['instagram', 'threads']);
    expect(updated.status).toBe('queued');

    const list = await listBroadcasts(10);
    expect(list.map((x) => x.createdAt)).toEqual([200, 100]);
  });

  it('deleteBroadcast(id, true) yalnızca karta-baski/sosyal/ görsellerini siler, ürün görsellerini korur', async () => {
    mockPickProvider.mockReturnValue({
      id: 'cloudflare',
      label: 'Cloudflare',
      generate: mockProviderGenerate.mockResolvedValue({
        images: [{ url: 'https://tmp.example/gen.png' }],
        model: 'flux',
      }),
    });
    mockCloudinary.uploadToCloudinary.mockResolvedValue('karta-baski/sosyal/uretildi_1');

    const item = await createBroadcast({
      imageIds: [
        'karta-baski/urunler/urun_gorseli_1',
        'karta-baski/studio/onayli_2',
        'karta-baski/sosyal/yuklenen_3',
      ],
      kind: 'urun',
      studioEnhance: true,
      platforms: ['facebook'],
      mode: 'instant',
    });

    await deleteBroadcast(item.id, true);

    expect(await getBroadcast(item.id)).toBeNull();
    expect(mockCloudinary.deleteCloudinaryImages).toHaveBeenCalledTimes(1);
    const deletedIds = mockCloudinary.deleteCloudinaryImages.mock.calls[0][0] as string[];
    expect(deletedIds.sort()).toEqual([
      'karta-baski/sosyal/uretildi_1',
      'karta-baski/sosyal/yuklenen_3',
    ]);
    expect(deletedIds).not.toContain('karta-baski/urunler/urun_gorseli_1');
    expect(deletedIds).not.toContain('karta-baski/studio/onayli_2');
  });

  it('deleteBroadcast(id, false) Cloudinary silme çağırmaz', async () => {
    const item = await createBroadcast({
      imageIds: ['karta-baski/sosyal/yuklenen_1'],
      kind: 'serbest',
      platforms: ['facebook'],
      mode: 'draft',
    });

    await deleteBroadcast(item.id, false);
    expect(await getBroadcast(item.id)).toBeNull();
    expect(mockCloudinary.deleteCloudinaryImages).not.toHaveBeenCalled();
  });
});

describe('runBroadcastStep', () => {
  it('kuyruktaki zamanı gelmiş gönderileri queuePerCycle kadar FIFO sırayla işler', async () => {
    await saveBroadcastSettings({ queuePerCycle: 2 });

    const b1 = await createBroadcast({
      imageIds: ['karta-baski/sosyal/q1'],
      kind: 'serbest',
      platforms: ['facebook'],
      mode: 'queue',
    }, 1000);
    const b2 = await createBroadcast({
      imageIds: ['karta-baski/sosyal/q2'],
      kind: 'serbest',
      platforms: ['facebook'],
      mode: 'queue',
    }, 2000);
    const b3 = await createBroadcast({
      imageIds: ['karta-baski/sosyal/q3'],
      kind: 'serbest',
      platforms: ['facebook'],
      mode: 'queue',
    }, 3000);
    await createBroadcast({
      imageIds: ['karta-baski/sosyal/d1'],
      kind: 'serbest',
      platforms: ['facebook'],
      mode: 'draft',
    }, 500);

    mockFb.publishToFacebookPage
      .mockResolvedValueOnce('fb_q1')
      .mockRejectedValueOnce(new Error('Ağ hatası'));

    const summary = await runBroadcastStep(5000);
    expect(summary.processed).toBe(2);
    expect(summary.posted).toBe(1);
    expect(summary.failed).toBe(1);
    expect(summary.errors).toEqual([`${b2.id} (facebook): Ağ hatası`]);

    expect((await getBroadcast(b1.id))?.status).toBe('done');
    expect((await getBroadcast(b2.id))?.status).toBe('failed');
    expect((await getBroadcast(b3.id))?.status).toBe('queued');
  });
});
