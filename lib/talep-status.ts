// Sepet talebi durumları: istemci ve sunucu ortak kullanır (server-only değil).
export const TALEP_STATUSES = ['yeni', 'incelendi', 'siparis', 'tamamlandi', 'iptal'] as const;
export type TalepStatus = (typeof TALEP_STATUSES)[number];

export type TalepTone = 'new' | 'info' | 'order' | 'ok' | 'off';

export const TALEP_LABELS: Record<TalepStatus, { label: string; tone: TalepTone }> = {
  yeni: { label: 'Yeni', tone: 'new' },
  incelendi: { label: 'İncelendi', tone: 'info' },
  siparis: { label: 'Siparişe alındı', tone: 'order' },
  tamamlandi: { label: 'Tamamlandı', tone: 'ok' },
  iptal: { label: 'İptal', tone: 'off' },
};

export function isTalepStatus(v: unknown): v is TalepStatus {
  return typeof v === 'string' && (TALEP_STATUSES as readonly string[]).includes(v);
}
