/**
 * @jest-environment node
 */
jest.mock('server-only', () => ({}), { virtual: true });

const settings: { chatId?: string; admins: Record<string, string> } = { admins: {} };
const state: { pending?: Record<string, string>; sent?: Record<string, number>; summaryDay?: string; checkedAt?: number } = {};
jest.mock('@/lib/bot-store', () => ({
  getBotSettings: async () => ({ ...settings, admins: { ...settings.admins } }),
  saveBotSettings: async (v: typeof settings) => Object.assign(settings, v),
  getBotState: async () => state,
  patchBotState: async (p: typeof state) => Object.assign(state, p, { pending: { ...state.pending, ...p.pending } }),
  forgetSent: async () => {},
}));

const calls: { method: string; body: Record<string, any> }[] = [];
jest.mock('@/lib/telegram-api', () => ({
  botToken: () => '42:gizli',
  tg: async (method: string, body: Record<string, any>) => { calls.push({ method, body }); return { ok: true, result: {} }; },
}));

const TOKEN = 'cd'.repeat(16);
let saved: any;
let job: { status: string } | null;
jest.mock('@/lib/siparis', () => ({
  getOrderRequest: async (t: string) => (t === TOKEN ? saved : null),
  findOrderByCode: async (c: string) => (c === saved.code ? saved : null),
  getProduction: async (o: any) => (o.orderId ? job : null),
  listOpenOrderRequests: async () => [saved],
  claimOrder: async (_t: string, name: string) => { saved.claimedBy ??= name; return saved.claimedBy; },
  setShipping: jest.fn(async (_t: string, s: unknown) => { saved.shipping = s; }),
  setOrderAdmin: jest.fn(async (_t: string, p: object) => Object.assign(saved, p)),
}));
jest.mock('@/lib/siparis-uretim', () => ({ sendToMachine: jest.fn(async () => { saved.orderId = 'is1'; saved.status = 'siparis'; job = { status: 'yeni' }; return 'is1'; }) }));
jest.mock('@/lib/orders', () => ({ listOrders: async () => [], setOrderStatus: jest.fn(async (_id: string, status: string) => { job = { status }; }) }));
jest.mock('@/lib/reviews', () => ({ getReview: jest.fn(), getReviewStats: async () => ({ pending: 0 }), setReviewStatus: jest.fn() }));
jest.mock('@/lib/machine-store', () => ({ machineReportText: async () => 'rapor' }));
jest.mock('@/lib/social-run', () => ({ getAllSocialStatus: async () => [{ platform: 'instagram', configured: true, enabled: false }] }));
jest.mock('@/lib/social-settings', () => ({ setSocialSettings: jest.fn() }));

import { handleUpdate, runBotStep } from '@/lib/bot';
import { setupCode } from '@/lib/bot-utils';
import { sendToMachine } from '@/lib/siparis-uretim';
import { setOrderStatus } from '@/lib/orders';
import { OrderRequestSchema } from '@/lib/siparis-types';
import { trTime } from '@/lib/tr-time';

const SERHAT = { id: 1, first_name: 'Serhat' };
const IHSAN = { id: 2, first_name: 'İhsan' };
const YABANCI = { id: 99, first_name: 'Yabancı' };
const GROUP = { id: -100500, type: 'supergroup', title: 'Yönetim' };
let id = 0;
const say = (from: typeof SERHAT, text: string, chat = GROUP) => handleUpdate({ update_id: ++id, message: { message_id: id, chat, from, text } });
const tap = (from: typeof SERHAT, data: string, chat = GROUP) => handleUpdate({ update_id: ++id, callback_query: { id: `q${id}`, from, data, message: { message_id: 7, chat } } });
const texts = (method = 'sendMessage') => calls.filter((c) => c.method === method).map((c) => String(c.body.text));
const answers = () => texts('answerCallbackQuery');

beforeEach(() => {
  calls.length = 0;
  jest.clearAllMocks();
  job = null;
  saved = OrderRequestSchema.parse({ token: TOKEN, code: 'KB7H3QMW2PXZ9', createdAt: 1, updatedAt: 1, status: 'yeni', items: [], total: 0, name: 'Ali', phone: '0555 000 00 00' });
});

describe('grup bağlama', () => {
  it('yanlış kodla ya da özel sohbette bağlanmaz', async () => {
    await say(YABANCI, '/kur 0000000000');
    await say(SERHAT, `/kur ${setupCode('42:gizli')}`, { id: 5, type: 'private', title: '' });
    expect(settings.chatId).toBeUndefined();
  });

  it('bağlanmadan önce komutlar sessizce yok sayılır', async () => {
    await say(SERHAT, '/siparisler');
    expect(calls).toHaveLength(0);
  });

  it('doğru kod grubu bağlar; diğerleri onayla yönetici olur', async () => {
    await say(SERHAT, `/kur ${setupCode('42:gizli')}`);
    expect(settings).toMatchObject({ chatId: '-100500', admins: { 1: 'Serhat' } });
    await say(IHSAN, '/katil');
    expect(texts().pop()).toContain('İhsan yönetici olmak istiyor');
    await tap(IHSAN, 'j:2');
    expect(answers().pop()).toContain('yönetici olmalısınız');
    await tap(SERHAT, 'j:2');
    expect(settings.admins).toMatchObject({ 2: 'İhsan' });
  });

  it('kodu bilen yabancı botu başka gruba taşıyamaz', async () => {
    await say(YABANCI, `/kur ${setupCode('42:gizli')}`, { id: -999, type: 'group', title: 'Başka' });
    expect(settings.chatId).toBe('-100500');
  });
});

describe('yetki', () => {
  it('yönetici olmayan komut ve düğme kullanamaz; başka grup yok sayılır', async () => {
    await say(YABANCI, '/siparisler');
    expect(texts()).toEqual([expect.stringContaining('yönetici olmalısınız')]);
    await tap(YABANCI, `m:${TOKEN}`);
    await tap(SERHAT, `m:${TOKEN}`, { id: -999, type: 'group', title: '' });
    expect(sendToMachine).not.toHaveBeenCalled();
    calls.length = 0;
    await say(SERHAT, '/siparisler', { id: -999, type: 'group', title: '' });
    expect(calls).toHaveLength(0);
  });
});

describe('sipariş işlemleri', () => {
  it('ilk ilgilenen sahiplenir, ikinci kişiye adı söylenir', async () => {
    await tap(SERHAT, `c:${TOKEN}`);
    await tap(IHSAN, `c:${TOKEN}`);
    expect(answers()).toEqual(['Sipariş sizde.', 'Serhat zaten ilgileniyor.']);
  });

  it('üretime bir kez aktarır ve kartta kimin yaptığını yazar', async () => {
    await tap(IHSAN, `m:${TOKEN}`);
    await tap(SERHAT, `m:${TOKEN}`);
    expect(sendToMachine).toHaveBeenCalledTimes(1);
    expect(texts('editMessageText')[0]).toContain('İhsan üretime aldı');
    expect(answers()).toEqual(['Üretime aktarıldı.', 'Zaten üretimde.']);
  });

  it('eski karttaki düğme aşamayı iki kez ilerletmez', async () => {
    saved.orderId = 'is1'; saved.status = 'siparis'; job = { status: 'tasarim' };
    await Promise.all([tap(SERHAT, `a:${TOKEN}:tasarim`), tap(IHSAN, `a:${TOKEN}:tasarim`)]);
    expect(setOrderStatus).toHaveBeenCalledTimes(1);
    expect(setOrderStatus).toHaveBeenCalledWith('is1', 'baski');
    expect(answers()).toContain('Aşama değişmiş; kart güncellendi.');
  });

  it('teslim ikinci onay olmadan yazılmaz', async () => {
    saved.orderId = 'is1'; saved.status = 'siparis'; job = { status: 'kargoda' };
    await tap(SERHAT, `a:${TOKEN}:kargoda`);
    expect(setOrderStatus).not.toHaveBeenCalled();
    expect(calls.find((c) => c.method === 'editMessageReplyMarkup')!.body.reply_markup.inline_keyboard[0][0].callback_data).toBe(`t:${TOKEN}:kargoda`);
    await tap(SERHAT, `t:${TOKEN}:kargoda`);
    expect(setOrderStatus).toHaveBeenCalledWith('is1', 'teslim');
    expect(saved.status).toBe('tamamlandi');
  });

  it('kargo komutu bilgiyi kaydeder, hatalı yazımı anlatır', async () => {
    await say(SERHAT, '/kargo KB7H3QMW2PXZ9 Aras Kargo 55555');
    expect(saved.shipping).toEqual({ carrier: 'Aras Kargo', trackingNo: '55555' });
    await say(SERHAT, '/kargo');
    expect(texts().pop()).toContain('Sipariş kodu geçersiz');
  });

  it('aynı güncelleme ikinci kez işlenmez', async () => {
    const update = { update_id: 9999, message: { message_id: 1, chat: GROUP, from: SERHAT, text: '/rapor' } };
    await handleUpdate(update);
    await handleUpdate(update);
    expect(texts()).toEqual(['rapor']);
  });
});

describe('zamanlanmış tur', () => {
  it('sabah özetini günde bir gönderir ve bekleyen siparişi hatırlatır', async () => {
    const at = trTime('2026-11-27', 9, 30);
    saved.createdAt = at - 5 * 3600_000;
    expect(await runBotStep(at)).toEqual({ summary: true, reminders: 1 });
    expect(await runBotStep(at + 30 * 60_000)).toEqual({ summary: false, reminders: 0 });
    expect(texts()[0]).toContain('Günün özeti');
    expect(texts()[1]).toContain('Hatırlatma');
  });
});
