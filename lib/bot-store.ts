import 'server-only';

import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from './firebase-admin';

// Botun bağlı olduğu grup ve yöneticiler: Firestore `bot/ayar`. Zamanlanmış işlerin hafızası: `bot/durum`.
// İkisi de yalnız Admin SDK ile erişilir (firestore.rules varsayılan olarak kapalı).

export interface BotSettings {
  chatId?: string;
  title?: string;
  /** Telegram kullanıcı kimliği → görünen ad. */
  admins: Record<string, string>;
}

export interface BotState {
  summaryDay?: string;
  checkedAt?: number;
  /** Gönderilen hatırlatma ve hata uyarıları: anahtar → zaman. */
  sent?: Record<string, number>;
  /** Yönetici olmayı bekleyenler: kullanıcı kimliği → ad. */
  pending?: Record<string, string>;
}

const settingsRef = () => adminDb.collection('bot').doc('ayar');
const stateRef = () => adminDb.collection('bot').doc('durum');
const TTL_MS = 60_000;
let cache: { at: number; value: BotSettings } | null = null;

export async function getBotSettings(fresh = false): Promise<BotSettings> {
  if (!fresh && cache && Date.now() - cache.at < TTL_MS) return cache.value;
  const raw = (await settingsRef().get()).data() as Partial<BotSettings> | undefined;
  const value: BotSettings = { chatId: raw?.chatId, title: raw?.title, admins: raw?.admins ?? {} };
  cache = { at: Date.now(), value };
  return value;
}

/** Grubu bağlar; yazılan yönetici listesi öncekinin yerine geçer. */
export async function saveBotSettings(value: BotSettings): Promise<void> {
  await settingsRef().set({ chatId: value.chatId ?? '', title: value.title ?? '', admins: value.admins, updatedAt: Date.now() });
  cache = null;
}

export async function getBotState(): Promise<BotState> {
  return ((await stateRef().get()).data() as BotState | undefined) ?? {};
}

export async function patchBotState(patch: Partial<BotState>): Promise<void> {
  await stateRef().set(patch, { merge: true });
}

/** Eskimiş hatırlatma kayıtlarını siler (belge büyümesin). */
export async function forgetSent(keys: string[]): Promise<void> {
  if (!keys.length) return;
  await stateRef().update(Object.fromEntries(keys.map((k) => [`sent.${k}`, FieldValue.delete()])));
}
